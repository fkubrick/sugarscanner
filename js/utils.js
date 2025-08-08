export const CUBE_GRAMS = 4; // 1 morceau de sucre = 4 g (FR). Modifiable.

export function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }

export function gramsToCubes(grams) {
  if (!Number.isFinite(grams) || grams <= 0) return 0;
  return Math.ceil(grams / CUBE_GRAMS);
}

export function makeBasisText({ per, quantity_g, quantity_ml, serving_g, serving_ml }) {
  if (per === 'unit') return 'Base: estimation par unité (poids/volume net).';
  if (per === 'serving') return 'Base: par portion (valeur OFF).';
  if (per === '100g') return 'Base: extrapolation à partir de 100 g.';
  if (per === '100ml') return 'Base: extrapolation à partir de 100 ml.';
  return 'Base: inconnue';
}

export function nicePct(x){
  if (!Number.isFinite(x)) return '—';
  return (Math.round(x * 10) / 10).toLocaleString('fr-FR') + ' %';
}

// Estime sucre par unité à partir des champs OFF
export function estimateUnitSugar(nutri, quantityText) {
  const g100 = nutri['sugars_100g'];
  const ml100 = nutri['sugars_100ml'];
  const serving = nutri['sugars_serving'];
  const servingSizeTxt = nutri['serving_size'];

  // Parsing quantité "330 ml", "400 g"
  let qtyValue = null, qtyUnit = null;
  if (quantityText && typeof quantityText === 'string') {
    const m = quantityText.toLowerCase().match(/([\d,.]+)\s*(ml|l|g)/);
    if (m) {
      qtyValue = parseFloat(m[1].replace(',', '.'));
      qtyUnit = m[2];
      if (qtyUnit === 'l') { qtyUnit = 'ml'; qtyValue *= 1000; }
    }
  }

  if (Number.isFinite(serving)) {
    return { grams: serving, per: 'serving' };
  }
  if (Number.isFinite(g100) && qtyUnit === 'g' && Number.isFinite(qtyValue)) {
    return { grams: (g100 / 100) * qtyValue, per: '100g', quantity_g: qtyValue };
  }
  if (Number.isFinite(ml100) && qtyUnit === 'ml' && Number.isFinite(qtyValue)) {
    return { grams: (ml100 / 100) * qtyValue, per: '100ml', quantity_ml: qtyValue };
  }
  // fallback: si g100 existe et on suppose 1 unité ~ 100 g/100 ml
  if (Number.isFinite(g100)) return { grams: g100, per: '100g' };
  if (Number.isFinite(ml100)) return { grams: ml100, per: '100ml' };
  return null;
}
