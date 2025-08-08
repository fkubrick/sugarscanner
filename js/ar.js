let scene, camera, renderer, cubesGroup;
let overlayCanvas;

export function initAR(canvasEl){
  overlayCanvas = canvasEl;
  renderer = new THREE.WebGLRenderer({ canvas: overlayCanvas, alpha:true, antialias:true });
  onResize();
  window.addEventListener('resize', onResize);

  scene = new THREE.Scene();
  camera = new THREE.OrthographicCamera(0, overlayCanvas.width, overlayCanvas.height, 0, -1000, 1000);
  scene.add(camera);

  const light = new THREE.AmbientLight(0xffffff, 1.0);
  scene.add(light);

  cubesGroup = new THREE.Group();
  scene.add(cubesGroup);

  animate();
}
function onResize(){
  const w = overlayCanvas.clientWidth = window.innerWidth;
  const h = overlayCanvas.clientHeight = window.innerHeight;
  renderer.setSize(w, h, false);
  if (camera) { camera.right = w; camera.top = h; camera.updateProjectionMatrix(); }
}
function animate(){
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}

export function clearAR(){
  while (cubesGroup.children.length) cubesGroup.remove(cubesGroup.children[0]);
}

export function renderSugarPyramid(cubes, anchor){
  clearAR();
  if (!cubes || cubes <= 0) return;

  const cols = Math.ceil(Math.sqrt(cubes));
  const size = Math.max(16, Math.min(window.innerWidth, window.innerHeight)/20);
  const pad = Math.round(size * 0.2);

  let remaining = cubes;
  let xCenter = (anchor?.x ?? (window.innerWidth/2));
  let yBase = (anchor?.y ?? (window.innerHeight*0.75));

  for (let row = cols; row >= 1 && remaining > 0; row--){
    const inRow = Math.min(row, remaining);
    const totalW = inRow * size + (inRow-1)*pad;
    let x = xCenter - totalW/2;
    for (let i=0; i<inRow; i++){
      const m = cubeMesh(size);
      m.position.set(x + size/2, yBase - size/2, 0);
      cubesGroup.add(m);
      x += size + pad;
      remaining--;
      if (remaining <= 0) break;
    }
    yBase -= size + pad;
  }
}

function cubeMesh(size){
  const geo = new THREE.BoxGeometry(size, size, size);
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness:0.1, roughness:0.6 });
  const m = new THREE.Mesh(geo, mat);
  // ombre fake
  const shadowGeo = new THREE.PlaneGeometry(size*0.9, size*0.4);
  const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent:true, opacity:0.15 });
  const shadow = new THREE.Mesh(shadowGeo, shadowMat);
  shadow.position.set(0, -size*0.6, -1);
  m.add(shadow);
  return m;
}
