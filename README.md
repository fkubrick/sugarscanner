# sugarscanner

# SucreCam (Web AR)

Objectif: quand tu scannes un produit (auto-reconnaissance ou code‑barres), visualiser en surimpression caméra la quantité de sucre sous forme de pyramide de “morceaux”.

Fonctionnalités
- Reco visuelle (MobileNet + matching) pour quelques références connues (fichiers dans assets/references).
- Scan code‑barres (ZXing) EAN/UPC en continu.
- Données sucres via OpenFoodFacts (OFF) si dispo, sinon base locale.
- Visualisation cubes en Three.js ancrée sur la box du produit.
- 1 morceau = 4 g (configurable dans js/utils.js).

Déploiement (Netlify via GitHub)
1. Crée un repo Git avec tous les fichiers à la racine.
2. Push sur GitHub.
3. Sur Netlify: “New site from Git”, connecte ton repo. Build command: (vide). Publish directory: “.”.
4. Donne l’autorisation caméra au premier lancement (HTTPS obligatoire → Netlify fournit).

Ajout de nouvelles références visuelles
1. Ajoute une image nette du produit dans `assets/references/`.
2. Ajoute une entrée dans `VISUAL_REFERENCES` (js/products.js) avec {id,name,ean,imagePath}.
3. Optionnel: ajoute le code-barres et un fallback dans `LOCAL_PRODUCTS` (js/products.js) et `products.json`.

Notes et limites
- Reco visuelle: c’est un “matching d’apparence” léger pour démos. Pour une reco robuste multi‑angles, il faudrait un modèle personnalisé (TF.js/Teachable Machine) ou un backend.
- OFF: la disponibilité des champs varie selon les produits. On estime par portion, par 100g ou par 100ml en priorité selon les données.
- iOS: Safari supporte getUserMedia et fonctionnera. Le réglage de la torche n’est pas disponible sur tous les appareils.
- Confidentialité: tout tourne côté client, sauf la requête OFF.

Licence
- Exemple éducatif; images de référence: utilise des photos dont tu as les droits.
