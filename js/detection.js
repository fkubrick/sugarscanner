import { VISUAL_REFERENCES } from './products.js';

// Détection visuelle légère: embeddings MobileNet + cosine similarity
export class VisualDetector {
  constructor(videoEl, onBoxUpdate){
    this.video = videoEl;
    this.model = null;
    this.onBoxUpdate = onBoxUpdate || (()=>{});
    this.refTensors = []; // {id, name, ean, emb}
    this.box = { x: 0.2, y: 0.25, w: 0.6, h: 0.5 }; // ROI normalisée (centrale)
    this.enabled = true;
    this.threshold = 0.4; // plus petit = plus strict ; 0 = identique
  }

  async load(){
    this.model = await mobilenet.load({ version: 2, alpha: 1.0 });
    // charge images de référence et fait leurs embeddings
    for (const ref of VISUAL_REFERENCES) {
      const img = await this.loadImage(ref.imagePath);
      const emb = this.model.infer(img, true); // activation intermédiaire
      this.refTensors.push({ ...ref, emb });
    }
  }

  loadImage(src){
    return new Promise((resolve, reject)=>{
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = ()=> resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  // Retourne {hit: {id,name,ean}, score, boxPx}
  async detect(){
    if (!this.enabled || !this.model) return null;
    const { videoWidth: vw, videoHeight: vh } = this.video;
    if (!vw || !vh) return null;

    const sx = this.box.x * vw, sy = this.box.y * vh, sw = this.box.w * vw, sh = this.box.h * vh;
    // création d'un canvas offscreen pour rogner la ROI
    const c = this._canvas || (this._canvas = document.createElement('canvas'));
    c.width = 224; c.height = 224;
    const ctx = c.getContext('2d');
    ctx.drawImage(this.video, sx, sy, sw, sh, 0, 0, c.width, c.height);

    const logits = this.model.infer(c, true);
    let best = null, bestDist = Infinity;
    for (const ref of this.refTensors) {
      const dist = 1 - tf.losses.cosineSimilarity(logits, ref.emb).dataSync()[0]; // distance
      if (dist < bestDist) { bestDist = dist; best = ref; }
    }
    logits.dispose();

    const boxPx = { x: sx, y: sy, w: sw, h: sh };
    if (typeof this.onBoxUpdate === 'function') this.onBoxUpdate(boxPx);

    if (best && bestDist < this.threshold) {
      return { hit: { id: best.id, name: best.name, ean: best.ean }, score: bestDist, boxPx };
    }
    return { hit: null, score: bestDist, boxPx };
  }
}

// Détection code-barres via ZXing
export class BarcodeScanner {
  constructor(videoEl){
    this.video = videoEl;
    this.codeReader = new ZXing.BrowserMultiFormatReader();
    this.enabled = true;
    this.stream = null;
    this.deviceId = null;
    this.torchOn = false;
  }

  async listCameras(){
    const devices = await ZXing.BrowserCodeReader.listVideoInputDevices();
    return devices;
  }

  async start(deviceId){
    this.deviceId = deviceId || this.deviceId;
    const constraints = {
      video: {
        deviceId: this.deviceId ? { exact: this.deviceId } : undefined,
        facingMode: this.deviceId ? undefined : { ideal: "environment" },
        width: { ideal: 1280 }, height: { ideal: 720 },
        advanced: [{ torch: this.torchOn }]
      },
      audio: false
    };
    this.stream = await navigator.mediaDevices.getUserMedia(constraints);
    this.video.srcObject = this.stream;
    await this.video.play();
    return this.stream;
  }

  async stop(){
    if (this.stream) this.stream.getTracks().forEach(t=>t.stop());
    this.stream = null;
    try { await this.codeReader.reset(); } catch {}
  }

  toggleTorch(on){
    this.torchOn = on ?? !this.torchOn;
    const track = this.stream?.getVideoTracks?.()[0];
    if (!track) return false;
    const capabilities = track.getCapabilities?.() || {};
    if (!('torch' in capabilities)) return false;
    track.applyConstraints({ advanced: [{ torch: this.torchOn }] });
    return true;
  }

  // Scan ponctuel (une frame); on le boucle côté main.js
  async scanOnce(){
    if (!this.enabled || !this.stream) return null;
    try {
      const result = await this.codeReader.decodeOnceFromVideoElement(this.video);
      return result?.text || null;
    } catch (e) {
      return null;
    }
  }
}
