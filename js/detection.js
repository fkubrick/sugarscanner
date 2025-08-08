export class BarcodeScanner {
  constructor(videoEl){
    this.video = videoEl;
    this.codeReader = new ZXing.BrowserMultiFormatReader();
    this.stream = null;
    this.deviceId = null;
    this.torchOn = false;
  }
  async listCameras(){
    const devices = await ZXing.BrowserCodeReader.listVideoInputDevices();
    return devices;
  }
  async start(deviceId){
    this.deviceId = deviceId ?? (await this.listCameras())[0]?.deviceId;
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: {
        deviceId: this.deviceId ? { exact: this.deviceId } : undefined,
        facingMode: this.deviceId ? undefined : { ideal: 'environment' }
      },
      audio: false
    });
    this.video.srcObject = this.stream;
    await this.video.play();
    return true;
  }
  async stop(){
    this.codeReader.reset();
    this.stream?.getTracks?.().forEach(t=>t.stop());
    this.stream = null;
  }
  async scanOnce(){
    try {
      const result = await this.codeReader.decodeOnceFromVideoDevice(this.deviceId, this.video);
      return result?.text || null;
    } catch { return null; }
  }
  toggleTorch(){
    try {
      const track = this.stream?.getVideoTracks?.()[0];
      const caps = track?.getCapabilities?.();
      if (!caps || !('torch' in caps)) return false;
      this.torchOn = !this.torchOn;
      track.applyConstraints({ advanced: [{ torch: this.torchOn }] });
      return true;
    } catch { return false; }
  }
}
