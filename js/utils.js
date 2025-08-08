export const CUBE_GRAMS = 4;

// Convertit grammes de sucre → nombre de “morceaux”
export function gramsToCubes(grams) {
  return Math.max(0, Math.round(grams / CUBE_GRAMS));
}

export function parseGS1DigitalLink(data) {
  // Support basique de QR GS1 Digital Link: .../01/{gtin}[...] ou ?gtin=
  try {
    const url = new URL(data);
    const p = url.pathname.split('/');
    const idx = p.findIndex(x => x === '01');
    if (idx >= 0 && p[idx+1]) return p[idx+1].replace(/\D/g, '').slice(0,14);
    const gtin = url.searchParams.get('gtin');
    if (gtin) return gtin.replace(/\D/g,'').slice(0,14);
  } catch {}
  return null;
}

export function makeBasisText(est) {
  if (!est) return '—';
  if (est.basis === 'serving' && est.serving) return `par portion (${est.serving})`;
  if (est.basis === 'unit' && est.qty) return `par unité (${est.qty})`;
  if (est.basis === '100g') return 'pour 100 g (estimé par poids net)';
  if (est.basis === '100ml') return 'pour 100 ml (estimé par volume net)';
  return '—';
}

// Estime le sucre par unité à partir des nutriments OFF
export function estimateUnitSugar(nutriments, quantity) {
  const n = nutriments || {};
  if (Number.isFinite(n.sugars_serving)) {
    return { grams: n.sugars_serving, basis:'serving', serving: n.serving_size || 'portion' };
  }
  const qty = (quantity || '').toLowerCase();
  const m = qty.match(/([\d.,]+)\s*(g|kg|ml|l)/i);
  let gramsNet = null, mlNet = null;
  if (m) {
    const val = parseFloat(m[1].replace(',', '.'));
    const unit = m[2].toLowerCase();
    if (unit === 'g') gramsNet = val;
    if (unit === 'kg') gramsNet = val * 1000;
    if (unit === 'ml') mlNet = val;
    if (unit === 'l') mlNet = val * 1000;
  }
  if (Number.isFinite(n.sugars_100g) && gramsNet) {
    return { grams: n.sugars_100g * (gramsNet/100), basis:'unit', qty: `${gramsNet} g` };
  }
  if (Number.isFinite(n.sugars_100ml) && mlNet) {
    return { grams: n.sugars_100ml * (mlNet/100), basis:'unit', qty: `${mlNet} ml` };
  }
  if (Number.isFinite(n.sugars_100g)) return { grams: n.sugars_100g, basis:'100g' };
  if (Number.isFinite(n.sugars_100ml)) return { grams: n.sugars_100ml, basis:'100ml' };
  return null;
}
