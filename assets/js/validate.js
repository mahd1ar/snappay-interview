// Development-only checks from data/schema.json → "validation". Loaded with a dynamic import behind
// import.meta.env.DEV, so it is not part of the production bundle. Problems are reported, never fixed silently.

const titleKey = { hero: 'title', subcategories: 'title', products: 'title', merchants: 'title', coupons: 'title',
  feature_tiles: 'title', stores: 'name', merchants_all: 'name', branches: 'branch_name' };
const imageKeys = ['image', 'logo'];

export async function validate(raw, resolveAsset) {
  const issues = [];
  const rows = id => raw[id]?.rows ?? [];
  const report = (table, id, message) => issues.push({ table, id, message });

  for (const [table, result] of Object.entries(raw)) {
    if (result.error) { report(table, '—', `failed to load: ${result.error.message}`); continue; }
    const seen = new Set();
    for (const row of result.rows) {
      if (seen.has(row.id)) report(table, row.id, 'duplicate id');
      seen.add(row.id);
      if (titleKey[table] && !row[titleKey[table]]) report(table, row.id, `empty ${titleKey[table]} (used as image alt)`);
    }
  }

  const merchantIds = new Set(rows('merchants_all').map(row => row.id));
  const categoryIds = new Set(rows('hero').map(row => row.id));
  for (const table of ['products', 'merchants', 'coupons', 'stores', 'branches']) {
    for (const row of rows(table)) if (!merchantIds.has(row.merchant_id)) report(table, row.id, `unknown merchant_id "${row.merchant_id}"`);
  }
  for (const row of rows('feature_tiles')) {
    for (const id of (row.merchant_ids || '').split(';').filter(Boolean)) if (!merchantIds.has(id)) report('feature_tiles', row.id, `unknown merchant "${id}"`);
  }
  for (const row of rows('subcategories')) if (!categoryIds.has(row.parent_category_id)) report('subcategories', row.id, `unknown parent "${row.parent_category_id}"`);
  for (const row of rows('products')) if (!categoryIds.has(row.category_id)) report('products', row.id, `unknown category "${row.category_id}"`);

  const branchOwners = new Set(rows('branches').map(row => row.merchant_id));
  for (const row of rows('merchants_all')) {
    if (row.channel === 'offline' && row.website_url) report('merchants_all', row.id, 'offline merchant has a website_url (ignored)');
    if (row.channel !== 'online' && !branchOwners.has(row.id)) report('merchants_all', row.id, `${row.channel} merchant has no branches`);
  }
  for (const row of rows('coupons')) {
    if (!row.code || !row.logo) report('coupons', row.id, 'coupon needs both code and logo (hidden)');
    if (row.expires_at && new Date(`${row.expires_at}T23:59:59`) < new Date()) report('coupons', row.id, `expired ${row.expires_at} (hidden)`);
  }

  // Every referenced asset must exist.
  const assets = new Map();
  for (const [table, result] of Object.entries(raw)) {
    for (const row of result.rows ?? []) for (const key of imageKeys) if (row[key]) assets.set(row[key], `${table}/${row.id}`);
  }
  await Promise.all([...assets].map(async ([path, owner]) => {
    const response = await fetch(resolveAsset(path), { method: 'HEAD' }).catch(() => null);
    if (!response?.ok) report(owner.split('/')[0], owner.split('/')[1], `missing asset ${path}`);
  }));

  if (issues.length) {
    console.groupCollapsed(`%c[data] ${issues.length} issue(s) in landing data`, 'color:#b54708;font-weight:700');
    console.table(issues);
    console.groupEnd();
  } else console.info('%c[data] all CSV checks passed', 'color:#0f9d58');
}
