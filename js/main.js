import { gramsToCubes, estimateUnitSugar, makeBasisText, parseGS1DigitalLink } from './utils.js';
import { BarcodeScanner } from './detection.js';
import { initAR, renderSugarPyramid, clearAR } from './ar.js';

const els = {
  video: document.getElementById('camera'),
  overlay: document.getElementById('overlay'),
  status: document.getElementById('status-badge'),
  source: document.getElementById('source-badge'),
  name: document.getElementById('product-name'),
  grams: document.getElementById('sugar-grams'),
  cubes: document.getElementById('sugar-cubes'),
  basis: document.getElementById('basis-line'),
  switchCam: document.getElementById('switch-camera'),
  torchBtn: document.getElementById('toggle-torch')
};

const OFF_BASE = 'https://world.openfoodfacts.org/api/v2/product/';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

let barcode;
let scanning = false;
let lastAnchor = { x: window.innerWidth/2, y: window.innerHeight*0.8 };

function setStatus(text, cls=''){ els.status.textContent = text; els.status.className = `badge ${cls}`; }
function setSource(text){ els.source.textContent = text; }

function cacheGet(key){
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { t, v } = JSON.parse(raw);
    if (Date.now() - t > CACHE_TTL_MS) { localStorage.removeItem(key); return null; }
    return v;
  } catch { return null; }
}
function cacheSet(key, value){ try { localStorage.setItem(key, JSON.stringify({ t: Date.now(), v: value })); } catch {} }

async function fetchOFFJson(url, { retries = 2, backoffMs = 600 } = {}){
  let attempt = 0, lastErr;
  while (attempt <= retries) {
    try {
      const resp = await fetch(url, { mode: 'cors' });
      if (!resp.ok) {
        if (resp.status === 429 || resp.status >= 500) throw new Error('retryable');
        throw new Error(`HTTP ${resp.status}`);
      }
      return await resp.json();
    } catch (e) {
      lastErr = e;
      if (attempt === retries) break;
      await new Promise(r => setTimeout(r, backoffMs * Math.pow(2, attempt)));
      attempt++;
    }
  }
  throw lastErr || new Error('OFF fetch failed');
}

async function fetchOFFByEAN(ean){
  if (!ean) return null;
  const cacheKey = `off:e:${ean}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const data = await fetchOFFJson(`${OFF_BASE}${encodeURIComponent(ean)}.json`);
  if (data.status !== 1 || !data.product) return null;

  const p = data.product;
  const est = estimateUnitSugar(p.nutriments, p.quantity || p.product_quantity || null);
  if (!est || !Number.isFinite(est.grams)) return null;

  const grams = est.grams;
  const cubes = gramsToCubes(grams);
  const result = {
    name: p.product_name || p.generic_name || p.brands_tags?.[0] || 'Produit',
    grams, cubes,
    basisText: makeBasisText(est),
    ean,
    source: 'OpenFoodFacts'
  };
  cacheSet(cacheKey, result);
  return result;
}

function displayProduct(prod){
  els.name.textContent = prod?.name ?? '—';
  els.grams.textContent = prod?.grams?.toFixed?.(0) ?? '—';
  els.cubes.textContent = prod?.cubes ?? '—';
  els.basis.textContent = prod?.basisText ?? '—';
  if (prod?.cubes > 0) renderSugarPyramid(prod.cubes, lastAnchor); else clearAR();
}

async function start(){
  setStatus('Demande d’accès caméra…');
  barcode = new BarcodeScanner(els.video);

  try {
    await barcode.start(); // ouvre le flux
    setStatus('Caméra OK', 'ok');
    initAR(els.overlay);
    setSource('Code‑barres / QR (GS1)');
  } catch (e) {
    console.error(e);
    setStatus('Caméra indisponible', 'err');
    return;
  }

  // Torche dispo ?
  const torchPossible = await (async ()=>{
    const track = barcode.stream?.getVideoTracks?.()[0];
    const caps = track?.getCapabilities?.() || {};
    return 'torch' in caps;
  })();
  els.torchBtn.disabled = !torchPossible;

  loop();
}

async function loop(){
  if (!scanning) {
    scanning = true;
    try {
      const raw = await barcode.scanOnce();
      if (raw) {
        setStatus('Code détecté', 'ok');
        // EAN direct ou GS1 Digital Link
        let ean = raw.replace(/\D/g, '');
        const gs1 = parseGS1DigitalLink(raw);
        if (gs1) ean = gs1;

        // Normaliser: viser EAN-13 quand possible
        if (ean.length === 14) ean = ean.slice(1); // GTIN-14 → EAN-13
        if (ean.length === 12) ean = '0' + ean;    // UPC-A → EAN-13

        if (ean.length === 8 || ean.length === 13) {
          setSource('OpenFoodFacts');
          const prod = await fetchOFFByEAN(ean);
          if (prod) {
            displayProduct(prod);
          } else {
            clearAR();
            els.name.textContent = 'Introuvable dans OFF';
            els.grams.textContent = '—';
            els.cubes.textContent = '—';
            els.basis.textContent = '—';
            setStatus('Produit non trouvé', 'warn');
          }
        } else {
          setStatus('Code non supporté', 'warn');
        }
      } else {
        setStatus('Recherche code‑barres…');
      }
    } catch (e) {
      console.error(e);
      setStatus('Erreur de scan', 'err');
    } finally { scanning = false; }
  }
  requestAnimationFrame(loop);
}

// UI
els.switchCam.addEventListener('click', async ()=>{
  try {
    await barcode.stop();
    const devices = await barcode.listCameras();
    if (devices.length < 2) { await barcode.start(); return; }
    const currentId = barcode.deviceId;
    const idx = devices.findIndex(d => d.deviceId === currentId);
    const next = devices[(idx + 1) % devices.length];
    await barcode.start(next.deviceId);
  } catch (e) { console.error(e); }
});
els.torchBtn.addEventListener('click', ()=>{
  const ok = barcode.toggleTorch();
  if (ok) els.torchBtn.textContent = barcode.torchOn ? 'Torche ON' : 'Torche';
});

// go
start();
