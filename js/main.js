import { gramsToCubes, makeBasisText } from './utils.js';
import { LOCAL_PRODUCTS } from './products.js';
import { initAR, renderSugarPyramid, clearAR } from './ar.js';
import { VisualDetector, BarcodeScanner } from './detection.js';

const els = {
  video: document.getElementById('camera'),
  overlay: document.getElementById('overlay'),
  status: document.getElementById('status-badge'),
  source: document.getElementById('source-badge'),
  name: document.getElementById('product-name'),
  grams: document.getElementById('sugar-grams'),
  cubes: document.getElementById('sugar-cubes'),
  basis: document.getElementById('basis-line'),
  toggleMode: document.getElementById('toggle-mode'),
  switchCam: document.getElementById('switch-camera'),
  torchBtn: document.getElementById('toggle-torch')
};

let mode = 'auto'; // 'auto' | 'barcode'
let visual, barcode;
let lastAnchor = { x: 0, y: 0, w: 200, h: 200 };
let scanning = false;
let known = null; // { name, grams, cubes, basis, ean }

function setStatus(text, cls=''){
  els.status.textContent = text;
  els.status.className = cls ? cls : '';
}

function setSource(text){
  els.source.textContent = text;
}

function displayProduct(p){
  known = p;
  els.name.textContent = p?.name ?? '—';
  els.grams.textContent = p?.grams?.toFixed?.(0) ?? '—';
  els.cubes.textContent = p?.cubes ?? '—';
  els.basis.textContent = p?.basisText ?? '—';
  if (p?.cubes > 0) renderSugarPyramid(p.cubes, lastAnchor); else clearAR();
}

async function fetchOFFByEAN(ean){
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(ean)}.json`;
  const resp = await fetch(url, { mode: 'cors' });
  if (!resp.ok) throw new Error('OFF error');
  const data = await resp.json();
  if (data.status !== 1) return null;
  const p = data.product;
  const nutri = p.nutriments || {};
  const quantity = p.quantity || p.product_quantity || p.packaging_quantity || null;
  // calcul
  const est = window.AppUtils.estimateUnitSugar(nutri, quantity);
  if (!est) return null;
  const grams = est.grams;
  const cubes = gramsToCubes(grams);
  return {
    name: p.product_name || p.generic_name || 'Produit',
    grams, cubes,
    basisText: makeBasisText(est),
    ean
  };
}

async function lookupByEAN(ean){
  // 1) OFF
  try {
    const off = await fetchOFFByEAN(ean);
    if (off) return { ...off, source: 'OpenFoodFacts' };
  } catch {}
  // 2) Local
  if (LOCAL_PRODUCTS[ean]) {
    const lp = LOCAL_PRODUCTS[ean];
    const grams = lp.sugar_g_unit;
    const cubes = gramsToCubes(grams);
    return { name: lp.name, grams, cubes, basisText: makeBasisText(lp.basis), ean, source: 'Local' };
  }
  return null;
}

async function start(){
  setStatus('Demande d’accès caméra…');
  visual = new VisualDetector(els.video, (box)=> { lastAnchor = { ...box }; });
  barcode = new BarcodeScanner(els.video);

  try {
    await barcode.start(); // démarre le flux vidéo
    setStatus('Caméra OK', 'ok');
    initAR(els.overlay, els.video);
  } catch (e) {
    setStatus('Caméra indisponible', 'err');
    console.error(e);
    return;
  }

  // Capacité torche
  const torchPossible = await (async ()=>{
    const track = barcode.stream?.getVideoTracks?.()[0];
    const caps = track?.getCapabilities?.() || {};
    return 'torch' in caps;
  })();
  els.torchBtn.disabled = !torchPossible;

  // Charge le modèle visuel
  try {
    setSource('Chargement modèle…');
    await visual.load();
    setSource('Prêt');
  } catch (e) {
    console.warn('Visual model failed', e);
    setSource('Reco visuelle indisponible');
  }

  loop();
}

async function loop(){
  if (!scanning) { scanning = true;
    try {
      if (mode === 'auto' && visual?.model) {
        const res = await visual.detect();
        if (res?.boxPx) { lastAnchor = res.boxPx; }
        if (res?.hit) {
          setStatus('Produit reconnu (visuel)', 'ok');
          setSource('Auto');
          const prod = await lookupByEAN(res.hit.ean);
          if (prod) displayProduct(prod);
        } else {
          setStatus('Recherche visuelle…');
          clearAR();
        }
      } else {
        // mode code-barres
        const code = await barcode.scanOnce();
        if (code) {
          setStatus(`Code-barres: ${code}`, 'ok');
          setSource('Code-barres');
          const prod = await lookupByEAN(code);
          if (prod) displayProduct(prod);
        } else {
          setStatus('Recherche code‑barres…');
          clearAR();
        }
      }
    } catch (e) {
      console.error(e);
      setStatus('Erreur', 'err');
    } finally {
      scanning = false;
    }
  }
  requestAnimationFrame(loop);
}

// UI events
els.toggleMode.addEventListener('click', ()=>{
  mode = (mode === 'auto') ? 'barcode' : 'auto';
  els.toggleMode.textContent = `Mode: ${mode === 'auto' ? 'Auto' : 'Code-barres'}`;
  setSource(mode === 'auto' ? 'Auto' : 'Code-barres');
});

els.switchCam.addEventListener('click', async ()=>{
  try {
    await barcode.stop();
    const devices = await barcode.listCameras();
    if (devices.length < 2) {
      await barcode.start(); return;
    }
    // alterne entre les deux premiers
    const currentId = barcode.deviceId;
    const idx = devices.findIndex(d => d.deviceId === currentId);
    const next = devices[(idx + 1) % devices.length];
    await barcode.start(next.deviceId);
  } catch (e) { console.error(e); }
});

els.torchBtn.addEventListener('click', ()=>{
  const ok = barcode.toggleTorch();
  if (ok) {
    els.torchBtn.textContent = barcode.torchOn ? 'Torche ON' : 'Torche';
  }
});

// Expose estimateUnitSugar pour main.js
window.AppUtils = await import('./utils.js');

// go
start();
