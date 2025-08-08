// Détection code-barres via ZXing + gestion caméra
// Remplace l’usage obsolète de ZXing.BrowserCodeReader.listVideoInputDevices()

export class BarcodeScanner {
  constructor(videoEl) {
    this.video = videoEl;
    this.reader = new ZXing.BrowserMultiFormatReader(); // support EAN/UPC/QR
    this.deviceId = null;
    this._controls = null;
    this.torchOn = false;
    this._track = null;
  }

  async listCameras() {
    // iOS/Safari: pour obtenir des deviceId/labels fiables, il faut souvent un getUserMedia préalable.
    if (!navigator.mediaDevices?.enumerateDevices) return [];
    try {
      let devices = await navigator.mediaDevices.enumerateDevices();
      let videos = devices.filter(d => d.kind === 'videoinput');

      if (videos.length === 0) {
        // Essayer de “primer” les permissions
        await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        devices = await navigator.mediaDevices.enumerateDevices();
        videos = devices.filter(d => d.kind === 'videoinput');
      }
      return videos;
    } catch (e) {
      console.error('enumerateDevices failed', e);
      return [];
    }
  }

  async start(deviceId = undefined) {
    // Arrêter si déjà en cours
    await this.stop();

    // Lancer le scan sur deviceId (ou par défaut)
    this._controls = await this.reader.decodeFromVideoDevice(
      deviceId ?? null,
      this.video,
      (result, err, controls) => {
        // ZXing appelle ce callback en boucle
        if (result) {
          this._lastResult = result;
          // rien à faire ici: main.js lit via getLastResult()
        }
        // Les erreurs de décodage “normales” sont fréquentes, on les ignore
      }
    );

    // Mémoriser deviceId réellement utilisé
    const stream = this.video.srcObject;
    const [track] = stream ? stream.getVideoTracks() : [];
    this._track = track || null;
    // Certaines implémentations exposent deviceId dans settings
    try {
      const settings = this._track?.getSettings?.() || {};
      this.deviceId = settings.deviceId || deviceId || null;
    } catch {
      this.deviceId = deviceId || null;
    }
  }

  getLastResult() {
    return this._lastResult || null;
  }

  async stop() {
    try {
      if (this._controls) {
        this._controls.stop();
      }
    } catch {}
    this._controls = null;
    this._lastResult = null;
    if (this._track) {
      try { this._track.stop(); } catch {}
    }
    this._track = null;
  }

  async setDevice(deviceId) {
    await this.start(deviceId);
  }

  toggleTorch() {
    // Torche via MediaTrackConstraints (Android Chrome surtout)
    if (!this._track) return false;
    const capabilities = this._track.getCapabilities?.() || {};
    if (!('torch' in capabilities)) return false;
    this.torchOn = !this.torchOn;
    try {
      this._track.applyConstraints({ advanced: [{ torch: this.torchOn }] });
      return true;
    } catch (e) {
      console.warn('Torch not supported/apply failed', e);
      this.torchOn = false;
      return false;
    }
  }
}
