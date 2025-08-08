// Utilitaires données + formatage pour SucreCam

export const CUBE_GRAMS = 4;

export function gramsToCubes(g) {
  if (!isFinite(g) || g <= 0) return 0;
  return Math.round(g / CUBE_GRAMS);
}

export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

// Détecte si un libellé (quantity ou serving_size) indique des mL vs g
function parseQtyString(s) {
  // Exemples: "330 ml", "1 L", "400g", "0,5 L", "85 g (égoutté 52 g)"
  if (!s || typeof s !== 'string') return null;
  const cleaned = s
    .toLowerCase()
    .replace(',', '.')
    .replace(/$ | $ /g, ' ');
  // Priorité au premier nombre + unité rencontrés
  const m = cleaned.match(/([\d.]+)\s*(ml|l|g)/i);
  if (!m) return null;
  let qty = parseFloat(m[1]);
  let unit = m[2].toLowerCase();
  if (!isFinite(qty)) return null;
  if (unit === 'l') {
    qty = qty * 1000;
    unit = 'ml';
  }
  return { qty, unit }; // unit: 'ml' ou 'g'
}

// Détermine si l’aliment doit être traité comme boisson
function isBeverage(product) {
  // Heuristique simple: quantité en ml ou catégories contenant "beverages"
  const q = parseQtyString(product?.quantity || product?.serving_size || '');
  if (q?.unit === 'ml') return true;
  const cats = (product?.categories_tags || product?.categories || '')
    .toString()
    .toLowerCase();
  return /beverage|boisson|drink/.test(cats);
}

// Calcule sucre pour l’unité (boîte, bouteille…) et par 100 g/ml
function computeSugar(product) {
  const n = product?.nutriments || {};
  // OFF: valeurs possibles: sugars_serving, sugars_100g, sugars_100ml
  const sugarsServing = toNum(n.sugars_serving);
  const sugars100g = toNum(n.sugars_100g);
  const sugars100ml = toNum(n.sugars_100ml);

  // Choix de la base (g vs ml)
  const beverage = isBeverage(product);
  const perUnit = beverage ? '100 ml' : '100 g';
  const sugarsPer = beverage ? (isFinite(sugars100ml) ? sugars100ml : null)
                             : (isFinite(sugars100g) ? sugars100g : null);

  // Quantité de l’unité (ex: canette 330 ml, paquet 400 g)
  const qty = parseQtyString(product?.quantity) || parseQtyString(product?.serving_size);

  // 1) Si OFF donne sugars_serving, on l’utilise comme sucre par unité/portion
  if (isFinite(sugarsServing)) {
    return {
      sugarG: sugarsServing,
      sugarPer: sugarsPer, // peut être null si OFF ne l’a pas
      basis: qty
        ? { type: 'unit', quantity: qty.qty, unit: qty.unit, perUnit }
        : { type: 'serving', perUnit }, // portion sans détail de taille
    };
  }

  // 2) Sinon, si on a sugarsPer (pour 100 g/ml) et une quantité d’unité, extrapoler
  if (isFinite(sugarsPer) && qty?.qty && qty?.unit) {
    const factor = qty.unit === 'ml' ? qty.qty / 100 : qty.qty / 100;
    const sugarG = sugarsPer * factor;
    return {
      sugarG,
      sugarPer: sugarsPer,
      basis: { type: 'unit', quantity: qty.qty, unit: qty.unit, perUnit },
    };
  }

  // 3) À défaut, fallback: afficher la valeur pour 100 g/ml uniquement
  if (isFinite(sugarsPer)) {
    return {
      sugarG: sugarsPer, // on renvoie la base 100 pour affichage
      sugarPer: sugarsPer,
      basis: { type: 'per100', perUnit },
    };
  }

  // 4) Rien d’exploitable
  return {
    sugarG: NaN,
    sugarPer: null,
    basis: { type: 'unknown', perUnit },
  };
}

function toNum(v) {
  const n = typeof v === 'string' ? parseFloat(v.replace(',', '.')) : Number(v);
  return isFinite(n) ? n : NaN;
}

// Formate la “ligne base” visible sous les cubes
export function formatBasis(basis, sugarPer) {
  if (!basis) return '';
  const per = sugarPer != null && isFinite(sugarPer) ? `${sugarPer.toFixed(1)} g/${basis.perUnit}` : '';
  switch (basis.type) {
    case 'unit':
      // ex: "par unité (330 ml) — 10.6 g/100 ml"
      return `par unité (${Math.round(basis.quantity)} ${basis.unit})${per ? ' — ' + per : ''}`;
    case 'serving':
      // taille de portion inconnue
      return `par portion${per ? ' — ' + per : ''}`;
    case 'per100':
      return `pour ${basis.perUnit}`;
    default:
      return per || '';
  }
}

// Appel OFF v2 et extraction
export async function fetchProductByCode(code) {
  if (!code) throw new Error('Code manquant');

  // Cache simple 24 h
  const cacheKey = `off:${code}`;
  const cached = readCache(cacheKey, 24 * 60 * 60 * 1000);
  if (cached) return cached;

  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json`;
  const res = await fetch(url, { mode: 'cors' });
  if (!res.ok) throw new Error('OFF error ' + res.status);
  const data = await res.json();

  const status = data?.status;
  if (status !== 1 || !data?.product) {
    throw new Error('Produit introuvable');
  }

  const product = data.product;
  const { sugarG, sugarPer, basis } = computeSugar(product);

  const result = { product, sugarG, sugarPer, basis };
  writeCache(cacheKey, result);
  return result;
}

// Cache localStorage
function readCache(key, maxAgeMs) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { t, v } = JSON.parse(raw);
    if (!t || Date.now() - t > maxAgeMs) return null;
    return v;
  } catch {
    return null;
  }
}

function writeCache(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify({ t: Date.now(), v: value }));
  } catch {}
}
