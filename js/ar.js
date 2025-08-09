import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

export class SugarAR {
  constructor(canvasEl) {
    this.overlayCanvas = canvasEl;
    this.renderer = new THREE.WebGLRenderer({ canvas: this.overlayCanvas, alpha: true, antialias: true });
    this.onResize();
    window.addEventListener('resize', () => this.onResize());

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(0, this.overlayCanvas.width, this.overlayCanvas.height, 0, -1000, 1000);
    this.scene.add(this.camera);

    const light = new THREE.AmbientLight(0xffffff, 1.0);
    this.scene.add(light);

    this.cubesGroup = new THREE.Group();
    this.scene.add(this.cubesGroup);

    this.animate();
  }

  onResize() {
    const w = this.overlayCanvas.clientWidth = window.innerWidth;
    const h = this.overlayCanvas.clientHeight = window.innerHeight;
    this.renderer.setSize(w, h, false);
    if (this.camera) {
      this.camera.right = w;
      this.camera.top = h;
      this.camera.updateProjectionMatrix();
    }
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    this.renderer.render(this.scene, this.camera);
  }

  clearAR() {
    while (this.cubesGroup.children.length) {
      this.cubesGroup.remove(this.cubesGroup.children[0]);
    }
  }

  renderSugarPyramid(cubes, anchor) {
    this.clearAR();
    if (!cubes || cubes <= 0) return;

    const cols = Math.ceil(Math.sqrt(cubes));
    const size = Math.max(16, Math.min(window.innerWidth, window.innerHeight) / 20);
    const pad = Math.round(size * 0.2);

    let remaining = cubes;
    let xCenter = (anchor?.x ?? (window.innerWidth / 2));
    let yBase = (anchor?.y ?? (window.innerHeight * 0.75));

    for (let row = cols; row >= 1 && remaining > 0; row--) {
      const inRow = Math.min(row, remaining);
      const totalW = inRow * size + (inRow - 1) * pad;
      let x = xCenter - totalW / 2;
      for (let i = 0; i < inRow; i++) {
        const m = this.cubeMesh(size);
        m.position.set(x + size / 2, yBase - size / 2, 0);
        this.cubesGroup.add(m);
        x += size + pad;
        remaining--;
        if (remaining <= 0) break;
      }
      yBase -= size + pad;
    }
  }

  cubeMesh(size) {
    const geo = new THREE.BoxGeometry(size, size, size);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.1, roughness: 0.6 });
    const m = new THREE.Mesh(geo, mat);
    // ombre fake
    const shadowGeo = new THREE.PlaneGeometry(size * 0.9, size * 0.4);
    const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.15 });
    const shadow = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.position.set(0, -size * 0.6, -1);
    m.add(shadow);
    return m;
  }
}
