import { BarcodeScanner } from './detection.js';
import { fetchProductByCode, gramsToCubes, formatBasis, clamp, CUBE_GRAMS, computeSugar } from './utils.js';
import { SugarAR } from './ar.js';

const els = {
  video: document.getElementById('camera'),
  canvas: document.getElementById('overlay'),
  status: document.getElementById('status-badge'),
  name: document.getElementById('product-name'),
  sugarG: document.getElementById('sugar-grams'),
  sugarC: document.getElementById('sugar-cubes'),
  basis: document.getElementById('basis-line'),
  switchCam: document.getElementById('switch-camera'),
  torchBtn: document.getElementById('toggle-torch'),
  debug: document.getElementById('debug-output'),
};

const barcode = new BarcodeScanner(els.video);
const ar = new SugarAR(els.canvas);
let scanning = false;
let lastSeenCode = null;

function setStatus(text, kind = '') {
  els.status.textContent = text;
  els.status.className = 'badge ' + (kind ? `badge-${kind}` : '');
}

async function start() {
  setStatus('Accès caméra…');
  try {
    const cams = await barcode.listCameras();
    // Choisir la caméra arrière si possible
    let targetId = cams.find(c => /back|rear|environment/i.test(c.label))?.deviceId ?? cams[0]?.deviceId;
    await barcode.start(targetId);
    setStatus('Prêt (visez un code‑barres)', 'ok');

    // Activer/désactiver le bouton torche selon capacités
    const hasTorch = (() => {
      try {
        const caps = els.video.srcObject?.getVideoTracks?.()[0]?.getCapabilities?.() || {};
        return 'torch' in caps;
      } catch { return false; }
    })();
    els.torchBtn.disabled = !hasTorch;
  } catch (e) {
    console.error(e);
    setStatus('Caméra indisponible', 'err');
  }
  requestAnimationFrame(loop);
}

async function loop() {
  const result = barcode.getLastResult();
  if (result && !scanning) {
    scanning = true;
    const text = result.getText ? result.getText() : result.text || '';
    // Éviter de resoumettre 50x le même code
    if (text && text !== lastSeenCode) {
      lastSeenCode = text;
      await handleCode(text);
    }
    scanning = false;
  }
  requestAnimationFrame(loop);
}

async function handleCode(codeText) {
  els.debug.textContent = '';
  try {
    setStatus(`Code: ${codeText}`);
    const data = await fetchProductByCode(codeText);
    els.debug.textContent = JSON.stringify(data, null, 2);

    if (data.status !== 1 || !data.product) {
      throw new Error('Produit introuvable');
    }

    const product = data.product;
    const { sugarG, sugarPer, basis } = computeSugar(product);

    els.name.textContent = product?.product_name || 'Produit';
    els.sugarG.textContent = sugarG?.toFixed(1) ?? '—';
    els.sugarC.textContent = gramsToCubes(sugarG).toString();
    els.basis.textContent = formatBasis(basis, sugarPer);

    ar.renderSugarPyramid(gramsToCubes(sugarG));
    setStatus('Produit trouvé', 'ok');
  } catch (e) {
    console.error(e);
    setStatus('Introuvable ou erreur réseau', 'warn');
    if (e.message.includes('OFF error')) {
      els.debug.textContent = e.message;
    }
  }
}

// UI
els.switchCam.addEventListener('click', async () => {
  try {
    const devices = await barcode.listCameras();
    if (!devices.length) return;
    const currentId = barcode.deviceId;
    const idx = devices.findIndex(d => d.deviceId === currentId);
    const next = devices[(idx + 1) % devices.length];
    await barcode.setDevice(next.deviceId);
  } catch (e) { console.error(e); }
});

els.torchBtn.addEventListener('click', () => {
  const ok = barcode.toggleTorch();
  if (ok) els.torchBtn.textContent = barcode.torchOn ? 'Torche ON' : 'Torche';
});

// go
start();
