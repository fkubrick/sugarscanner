// Gestion du rendu Three.js en overlay "écran"
let renderer, scene, camera;
let currentGroup = null;
let canvas, video;

function makeCube(material) {
  const geo = new THREE.BoxGeometry(1,1,1);
  return new THREE.Mesh(geo, material);
}

// Construit une pyramide d'N cubes, base carrée, centrée
function buildPyramid(nCubes, color=0xffffff) {
  const group = new THREE.Group();
  if (nCubes <= 0) return group;
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.1 });
  const light = new THREE.DirectionalLight(0xffffff, 1.0);
  light.position.set(2, 3, 5);
  group.add(light);
  group.add(new THREE.AmbientLight(0xffffff, 0.4));

  let remaining = nCubes;
  let layer = 0;
  const spacing = 1.1; // petite marge
  while (remaining > 0) {
    // dimension de la couche: k x k
    const k = Math.ceil(Math.sqrt(remaining));
    const count = Math.min(k*k, remaining);
    // on remplit rangée par rangée
    let placed = 0;
    for (let ix=0; ix<k && placed<count; ix++) {
      for (let iy=0; iy<k && placed<count; iy++) {
        const cube = makeCube(material);
        cube.position.set(
          (ix - (k-1)/2) * spacing,
          (iy - (k-1)/2) * spacing,
          layer * spacing
        );
        group.add(cube);
        placed++;
      }
    }
    remaining -= count;
    layer++;
  }
  return group;
}

// Initialise le renderer sur le canvas overlay avec caméra ortho égalisant pixels
export function initAR(overlayCanvas, videoEl) {
  canvas = overlayCanvas;
  video = videoEl;
  renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  scene = new THREE.Scene();
  camera = new THREE.OrthographicCamera(0, canvas.width, canvas.height, 0, -1000, 1000);

  function onResize(){
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.left = 0; camera.right = w; camera.top = 0; camera.bottom = h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', onResize);
  onResize();
  animate();
}

function animate(){
  requestAnimationFrame(animate);
  if (currentGroup) {
    // petit effet rotatif pour la lisibilité
    currentGroup.rotation.z += 0.01;
  }
  renderer.render(scene, camera);
}

// Place la pyramide ancrée à une box de détection (x,y,w,h) en pixels (origine: coin haut gauche)
export function renderSugarPyramid(nCubes, anchorBox) {
  if (!renderer || !scene) return;
  // supprime précédent
  if (currentGroup) { scene.remove(currentGroup); currentGroup = null; }
  const group = buildPyramid(nCubes, 0xffffff);
  // échelle: adapte taille des cubes à la largeur de la box
  const baseScale = Math.max(0.8, Math.min(2.5, anchorBox.w / 180)); // heuristique
  group.scale.setScalar(14 * baseScale);

  // position: centré horizontalement sur la box, posé au bas de la box
  const x = anchorBox.x + anchorBox.w / 2;
  const y = anchorBox.y + anchorBox.h + 10; // un peu en dessous
  group.position.set(x, y, 0);

  currentGroup = group;
  scene.add(group);
}

// Permet d'effacer l'overlay quand rien n'est détecté
export function clearAR() {
  if (currentGroup) { scene.remove(currentGroup); currentGroup = null; }
}
