// Base locale minimale pour quelques produits communs ou si OFF indispo
export const LOCAL_PRODUCTS = {
  // EAN -> metadata
  "5449000000996": { // Coca-Cola 33 cl (exemple courant en FR/BE)
    name: "Coca‑Cola 33 cl",
    sugar_g_unit: 35, // ~10.6 g/100 ml → ~35 g / canette
    basis: { per: 'unit', quantity_ml: 330 }
  },
  "3017620429484": { // Nutella 400 g
    name: "Nutella 400 g",
    sugar_g_unit: 225, // ~56.3 g/100 g → ~225 g / 400 g
    basis: { per: '100g', quantity_g: 400 }
  }
};

// Références visuelles pour la reconnaissance légère via embeddings MobileNet
export const VISUAL_REFERENCES = [
  {
    id: "coca-can",
    name: "Coca‑Cola 33 cl",
    ean: "5449000000996",
    imagePath: "assets/references/coca.jpg"
  },
  {
    id: "nutella-jar",
    name: "Nutella 400 g",
    ean: "3017620429484",
    imagePath: "assets/references/nutella.jpg"
  }
];
