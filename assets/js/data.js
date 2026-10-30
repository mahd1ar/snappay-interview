// Loads landing.config.json and the CSV sources it points to, then normalises and validates rows.
// Content lives only in the CSVs: replacing values there changes the page without touching code.

// Content sits next to index.html in dev and in the build, so resolve against the page (not this module,
// which Vite moves into a hashed bundle).
const baseURL = new URL(import.meta.env.BASE_URL, document.baseURI);
// Dev re-reads CSVs on every load while you edit them; production revalidates with the server.
const cacheMode = import.meta.env.VITE_DATA_CACHE || 'no-cache';

/** RFC-4180-ish CSV parser: quoted fields, escaped quotes, CRLF, BOM. */
export function parseCSV(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  text = text.replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { row.push(field); field = ''; }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some(cell => cell.trim() !== '')) rows.push(row);
      row = [];
    } else field += char;
  }
  row.push(field);
  if (row.some(cell => cell.trim() !== '')) rows.push(row);
  const [header = [], ...body] = rows;
  const keys = header.map(key => key.trim());
  return body.map(cells => Object.fromEntries(keys.map((key, index) => [key, (cells[index] ?? '').trim()])));
}

export function resolveAsset(path) {
  return path ? new URL(path, baseURL).href : '';
}

const list = value => (value ? value.split(';').map(item => item.trim()).filter(Boolean) : []);
const int = value => { const number = Number.parseInt(value, 10); return Number.isFinite(number) ? number : null; };
const isActive = row => row.active === undefined || row.active === '1';
const byOrder = key => (a, b) => (a[key] ?? 0) - (b[key] ?? 0);
const isSafeURL = value => { try { return new URL(value).protocol === 'https:'; } catch { return false; } };

async function fetchTable(path) {
  const response = await fetch(new URL(path, baseURL), { cache: cacheMode });
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return parseCSV(await response.text()).filter(isActive);
}

export async function loadConfig() {
  const response = await fetch(new URL('landing.config.json', baseURL), { cache: cacheMode });
  if (!response.ok) throw new Error(`landing.config.json: HTTP ${response.status}`);
  return response.json();
}

/**
 * Returns { config, tables, errors }. Each table loads independently so one broken file only
 * empties its own section instead of the whole page.
 */
export async function loadLanding() {
  const config = await loadConfig();
  const sources = {
    ...Object.fromEntries(config.sections.map(section => [section.id, section.data_source])),
    merchants_all: config.merchants_source,
    branches: config.branches_source,
  };
  const entries = await Promise.all(Object.entries(sources).map(async ([id, path]) => {
    if (!path) return [id, { error: new Error('no data source') }];
    try { return [id, { rows: await fetchTable(path) }]; }
    catch (error) { return [id, { error }]; }
  }));
  const raw = Object.fromEntries(entries);
  // Dev server and `build:dev` only: report schema problems in the console. Dropped from production builds.
  if (import.meta.env.MODE !== 'production') import('./validate.js').then(({ validate }) => validate(raw, resolveAsset));
  return { config, ...normalise(raw) };
}

function normalise(raw) {
  const errors = {};
  const rows = id => { if (raw[id]?.error) { errors[id] = raw[id].error; return []; } return raw[id]?.rows ?? []; };

  const categories = rows('hero').map(row => ({ id: row.id, title: row.title, image: resolveAsset(row.image), order: int(row.order) }))
    .filter(item => item.id && item.title).sort(byOrder('order'));
  const categoryById = new Map(categories.map(item => [item.id, item]));

  const branches = rows('branches').map(row => ({
    id: row.id, merchantId: row.merchant_id, name: row.branch_name, city: row.city, address: row.address,
    lat: Number.parseFloat(row.latitude), lng: Number.parseFloat(row.longitude), phone: row.phone,
    hours: row.opening_hours, order: int(row.order),
  })).sort(byOrder('order'));

  const merchants = rows('merchants_all').map(row => {
    const channel = ['online', 'offline', 'both'].includes(row.channel) ? row.channel : 'online';
    return {
      id: row.id, name: row.name, channel,
      categoryIds: list(row.category_ids).filter(id => categoryById.has(id)),
      logo: resolveAsset(row.logo), image: resolveAsset(row.image),
      // schema: never link an offline merchant to a website.
      url: channel !== 'offline' && isSafeURL(row.website_url) ? row.website_url : '',
      city: row.city, description: row.short_description, order: int(row.order),
      branches: branches.filter(branch => branch.merchantId === row.id),
    };
  }).filter(item => item.id && item.name).sort(byOrder('order'));
  const merchantById = new Map(merchants.map(item => [item.id, item]));
  const withMerchant = item => item.merchant || !item.merchantId ? item : null;

  const subcategories = rows('subcategories').map(row => ({
    id: row.id, title: row.title, categoryId: row.parent_category_id, image: resolveAsset(row.image),
    row: int(row.carousel_row) === 2 ? 2 : 1, order: int(row.order_in_row),
  })).filter(item => item.title && categoryById.has(item.categoryId)).sort(byOrder('order'));

  const products = rows('products').map(row => {
    const price = int(row.price_toman), original = int(row.original_price_toman);
    return {
      id: row.id, title: row.title, categoryId: row.category_id, merchantId: row.merchant_id, merchant: merchantById.get(row.merchant_id),
      price, original: original && price && original > price ? original : null,
      image: resolveAsset(row.image), url: isSafeURL(row.url) ? row.url : '', order: int(row.order),
    };
  }).filter(item => item.title && item.price).map(withMerchant).filter(Boolean).sort(byOrder('order'));

  const merchantCarousel = rows('merchants').map(row => {
    const merchant = merchantById.get(row.merchant_id);
    return merchant && { id: row.id, merchant, title: row.title || merchant.name, image: resolveAsset(row.image) || merchant.image,
      logo: resolveAsset(row.logo) || merchant.logo, order: int(row.order) };
  }).filter(Boolean).sort(byOrder('order'));

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const coupons = rows('coupons').map(row => {
    const merchant = merchantById.get(row.merchant_id);
    const expires = row.expires_at ? new Date(`${row.expires_at}T23:59:59`) : null;
    return {
      id: row.id, merchant, title: row.title, code: row.code,
      type: row.discount_type === 'fixed_toman' ? 'fixed' : 'percent', value: int(row.discount_value),
      minOrder: int(row.min_order_toman), maxDiscount: int(row.max_discount_toman),
      expires, daysLeft: expires ? Math.ceil((expires - today) / 864e5) : null,
      image: resolveAsset(row.image), logo: resolveAsset(row.logo) || merchant?.logo,
      url: isSafeURL(row.link) ? row.link : '', order: int(row.order),
    };
  // schema: coupons need a logo and a code; expired codes are hidden rather than shown as dead ends.
  }).filter(item => item.merchant && item.code && item.logo && item.value && (item.daysLeft === null || item.daysLeft >= 0))
    .sort(byOrder('order'));

  const tiles = rows('feature_tiles').map(row => ({
    id: row.id, title: row.title, image: resolveAsset(row.image), order: int(row.order),
    merchants: list(row.merchant_ids).map(id => merchantById.get(id)).filter(Boolean),
  })).filter(item => item.title && item.merchants.length).sort(byOrder('order')).slice(0, 3);

  const stores = rows('stores').map(row => {
    const merchant = merchantById.get(row.merchant_id);
    return merchant && { id: row.id, merchant, name: row.name || merchant.name, image: resolveAsset(row.image) || merchant.image,
      logo: resolveAsset(row.logo) || merchant.logo, order: int(row.order) };
  }).filter(Boolean).sort(byOrder('order'));

  return { categories, categoryById, subcategories, products, merchants, merchantById, merchantCarousel, coupons, tiles, stores, branches, errors };
}
