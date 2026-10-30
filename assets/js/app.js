import { loadLanding } from './data.js';
import { createPanel } from './panel.js';
import { stateMessage } from './ui.js';
import { categoryView, merchantDetailView, merchantListView, productDetailView, productsView } from './views.js';
import {
  skeletons, renderHero, renderSubcategories, renderProducts, renderMerchants, renderCoupons, renderTiles, renderStores, renderFooter,
} from './sections.js';

const regions = Object.fromEntries([...document.querySelectorAll('[data-region]')].map(node => [node.dataset.region, node]));
for (const [id, region] of Object.entries(regions)) region.replaceChildren(skeletons[id]());

const panel = createPanel();
const ctx = { panel, marquees: [], data: null };
panel.onToggle(() => ctx.marquees.forEach(marquee => marquee.sync()));

ctx.openMerchant = merchant => panel.open(merchantDetailView(ctx, merchant));
ctx.openProduct = product => panel.open(productDetailView(ctx, product));
ctx.openCategory = (categoryId, options) => panel.open(categoryView(ctx, categoryId, options));
ctx.openTile = tile => panel.open(tile.merchants.length === 1
  ? merchantDetailView(ctx, tile.merchants[0])
  : merchantListView(ctx, { title: tile.title, merchants: tile.merchants }));

const viewAll = {
  products: () => productsView(ctx),
  merchants: () => merchantListView(ctx, { title: 'فروشگاه‌های خودرو', merchants: ctx.data.merchants }),
  stores: () => merchantListView(ctx, { title: 'همه فروشگاه‌های خودرو', merchants: ctx.data.stores.map(s => s.merchant), layout: 'list' }),
};
document.addEventListener('click', event => {
  const button = event.target.closest('[data-view-all]');
  if (button && ctx.data) panel.open(viewAll[button.dataset.viewAll]());
});
document.getElementById('global-search-open').addEventListener('click', () => {
  if (ctx.data) panel.open(merchantListView(ctx, { title: 'جست‌وجوی فروشگاه‌ها', merchants: ctx.data.merchants, autofocus: true }));
});

// Fade sections in as they first scroll into view (only those that start below the fold).
function revealOnScroll() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const observer = new IntersectionObserver(entries => entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    entry.target.classList.replace('is-pending', 'is-revealed');
    observer.unobserve(entry.target);
  }), { rootMargin: '0px 0px -10% 0px' });
  for (const section of document.querySelectorAll('.sp-section')) {
    if (section.getBoundingClientRect().top > innerHeight) { section.classList.add('is-pending'); observer.observe(section); }
  }
}

// No top-level await: older in-app webviews (Safari 14) cannot parse it.
async function start() {
  try {
    ctx.data = await loadLanding();
    ctx.data.config = ctx.data.config ?? null;
    if (ctx.data.config?.title) document.getElementById('hero-title').textContent = ctx.data.config.title;
    renderHero(ctx);
    renderSubcategories(regions.subcategories, ctx);
    renderProducts(regions.products, ctx);
    renderMerchants(regions.merchants, ctx);
    renderCoupons(regions.coupons, ctx);
    renderTiles(regions.feature_tiles, ctx);
    renderStores(regions.stores, ctx);
    renderFooter(ctx);
    revealOnScroll();
    // Clear any stale panel entries if the page was restored from history.
    if (history.state?.spPanel) history.replaceState(null, '');
    if (Object.keys(ctx.data.errors).length) console.warn('[landing] some sources failed', ctx.data.errors);
  } catch (error) {
    console.error('[landing]', error);
    for (const region of Object.values(regions)) {
      region.removeAttribute('aria-busy');
      region.replaceChildren(stateMessage('دریافت اطلاعات ممکن نشد.', () => location.reload()));
    }
  }
}

start();
