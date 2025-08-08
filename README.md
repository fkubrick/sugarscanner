# SucreCam (code‑barres + Open Food Facts)

Scanner un code‑barres (EAN/UPC) ou un QR GS1 Digital Link, interroger Open Food Facts (OFF) pour récupérer le sucre, et afficher une pyramide de “morceaux de sucre” superposée à la caméra.

Fonctionnement
- Scan: ZXing JS (EAN‑8, EAN‑13, UPC‑A, QR).
- Données: OFF v2 – `https://world.openfoodfacts.org/api/v2/product/{EAN}.json`.
- Estimation sucre par unité:
  1) `sugars_serving` (si présent),
  2) sinon extrapolation depuis `sugars_100g` / `sugars_100ml` + `quantity` (ex: “330 ml”, “400 g”),
  3) à défaut, affichage pour 100 g / 100 ml.
- Visualisation: THREE.js en orthographique. 1 cube = 4 g (modifiable dans `js/utils.js` via `CUBE_GRAMS`).
- Cache: `localStorage` 24 h par EAN.

Déploiement Netlify
1. Déposer ces fichiers dans un repo GitHub.
2. Sur Netlify: New site from Git → Build command: (vide) / Publish directory: “.”.
3. HTTPS fournit par Netlify → autorise `getUserMedia` (caméra).

Compatibilité
- Android Chrome: OK (+ torche sur appareils compatibles).
- iOS Safari (iOS 15+): OK (la torche n’est pas dispo partout).
- Desktop: fonctionne avec webcam, mais l’usage optimal est mobile.

Confidentialité
- Tout tourne dans le navigateur; seules les requêtes OFF sortent du device.

Licence
- Projet d’exemple éducatif, sans garantie.
