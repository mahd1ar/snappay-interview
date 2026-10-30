// Renders each landing section into its region. Sections never invent content:
// missing or failed data turns into an empty/error state for that section only.
import { h, img, icon, formatNumber, skeleton, stateMessage } from './ui.js';
import { productCard, merchantStory, couponCard, storeCard } from './components.js';
import { mountMarquee } from './marquee.js';
import { enableDragScroll } from './drag-scroll.js';

const reload = () => location.reload();

export const skeletons = {
  subcategories: () => h('div', {}, skeleton('sp-category-skeleton', 5), skeleton('sp-category-skeleton', 5)),
  products: () => skeleton('sp-offers-skeleton', 3),
  merchants: () => skeleton('sp-merchants-skeleton', 3),
  coupons: () => skeleton('sp-coupons-skeleton', 2),
  feature_tiles: () => skeleton('sp-tiles-skeleton', 3),
  stores: () => skeleton('sp-stores-skeleton', 4),
};

/** Shared guard: error → retry state, empty → empty state, otherwise render. */
export function fill(region, { error, items, empty, render }) {
  region.removeAttribute('aria-busy');
  if (error) region.replaceChildren(stateMessage('دریافت اطلاعات این بخش ممکن نشد.', reload));
  else if (!items.length) region.replaceChildren(stateMessage(empty));
  else region.replaceChildren(render());
}

export function renderHero(ctx) {
  const hero = document.getElementById('hero');
  const labels = document.getElementById('hero-labels');
  const image = hero.querySelector('.sp-hero__image');
  const categories = ctx.data.categories.slice(0, 5);
  image.alt = `لوازم خودرو؛ ${categories.map(c => c.title).join('، ')}`;
  labels.replaceChildren(...categories.map((category, index) => h('button.sp-hero-label', {
    type: 'button', dataset: { slot: String(index + 1), categoryId: category.id },
    'aria-haspopup': 'dialog', 'aria-label': `مشاهده فروشگاه‌های ${category.title}`,
    onclick: () => ctx.openCategory(category.id),
  }, h('span.sp-hero-label__icon', { dataset: { tint: String((index % 5) + 1) } }, img(category.image, { alt: '', width: 256, height: 256, eager: true, fallback: false })),
     h('span.sp-hero-label__text', {}, category.title))));
  const ready = () => hero.classList.add('is-ready');
  if (image.complete) ready(); else { image.addEventListener('load', ready, { once: true }); image.addEventListener('error', ready, { once: true }); }
  // Stop the idle wiggle while the hero is off screen.
  new IntersectionObserver(([entry]) => hero.classList.toggle('is-paused', !entry.isIntersecting)).observe(hero);
}

export function renderSubcategories(region, ctx) {
  const items = ctx.data.subcategories;
  fill(region, { error: ctx.data.errors.subcategories, items, empty: 'دسته‌بندی‌ای برای نمایش نیست.', render: () => {
    const container = h('div.sp-category-rows');
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    [1, 2].forEach(rowNumber => {
      const members = items.filter(item => item.row === rowNumber);
      if (!members.length) return;
      // Enough copies to cover a 480px column at least twice over, so the loop never shows a gap.
      const copies = Math.max(3, Math.ceil(560 / (members.length * 100)) + 2);
      const track = h('div.sp-category-track');
      for (let copy = 0; copy < copies; copy++) {
        members.forEach(item => {
          const duplicate = copy !== 1;
          track.append(h('div.sp-category-slide', { dir: 'rtl', dataset: { copy: String(duplicate) }, 'aria-hidden': duplicate ? 'true' : undefined },
            h('button.sp-category__item', { type: 'button', tabindex: duplicate ? '-1' : undefined, 'aria-haspopup': 'dialog',
              'aria-label': `${item.title}، ${ctx.data.categoryById.get(item.categoryId).title}`,
              onclick: () => ctx.openCategory(item.categoryId, { subcategory: item }) },
              h('span.sp-category__media', { dataset: { tint: String((ctx.data.categories.findIndex(c => c.id === item.categoryId) % 5) + 1) } }, img(item.image, { alt: '', width: 256, height: 256, fallback: false })),
              h('span.sp-category__name', {}, item.title))));
        });
      }
      const row = h('div.sp-category-row', { dir: 'ltr', role: 'group', 'aria-label': `ردیف ${formatNumber(rowNumber)} دسته‌بندی‌ها`,
        dataset: { count: String(members.length), row: String(rowNumber) } }, track);
      container.append(row);
      if (!reduceMotion && members.length > 1) {
        // Row 1 drifts one way, row 2 the other (the ec-service look).
        requestAnimationFrame(() => ctx.marquees.push(mountMarquee(row, { direction: rowNumber === 1 ? -1 : 1, speed: 22, isPaused: () => ctx.panel.isOpen })));
      }
    });
    return container;
  } });
}

export function renderProducts(region, ctx) {
  const { products, categories, errors } = ctx.data;
  fill(region, { error: errors.products, items: products, empty: 'فعلاً محصولی برای نمایش نیست.', render: () => {
    let active = 'all';
    const rail = enableDragScroll(h('div.sp-rail', { role: 'list', 'aria-label': 'محصولات' }));
    const used = categories.filter(c => products.some(p => p.categoryId === c.id));
    const options = [['all', 'همه'], ...used.map(c => [c.id, c.title])];
    const chips = options.map(([id, label]) => h('button.sp-chip', { type: 'button', 'aria-pressed': String(id === active),
      onclick: event => {
        active = id;
        chips.forEach(chip => chip.setAttribute('aria-pressed', String(chip === event.currentTarget)));
        update(); rail.scrollTo({ left: 0, behavior: 'instant' });
      } }, label));
    const update = () => rail.replaceChildren(...products.filter(p => active === 'all' || p.categoryId === active)
      .map(p => h('div.sp-offer-slide', { role: 'listitem' }, productCard(p, ctx))));
    update();
    return h('div', {}, used.length > 1 && enableDragScroll(h('div.sp-chips', { role: 'group', 'aria-label': 'فیلتر دسته' }, chips), { snap: false }), rail);
  } });
}

export function renderMerchants(region, ctx) {
  const { merchantCarousel, errors } = ctx.data;
  fill(region, { error: errors.merchants, items: merchantCarousel, empty: 'فروشگاهی برای نمایش نیست.', render: () =>
    enableDragScroll(h('div.sp-rail', { role: 'list', 'aria-label': 'فروشگاه‌های برگزیده' },
      merchantCarousel.map(item => h('div.sp-merchant-slide', { role: 'listitem' }, merchantStory(item, ctx))))) });
}

export function renderCoupons(region, ctx) {
  const { coupons, errors } = ctx.data;
  fill(region, { error: errors.coupons, items: coupons, empty: 'فعلاً کد تخفیف فعالی نیست.', render: () => {
    const slides = coupons.map((coupon, index) => h('div.sp-coupon-slide', { role: 'group', 'aria-roledescription': 'اسلاید',
      'aria-label': `${formatNumber(index + 1)} از ${formatNumber(coupons.length)}` }, couponCard(coupon, ctx)));
    const rail = enableDragScroll(h('div.sp-rail.sp-coupon-rail', { 'aria-label': 'کدهای تخفیف' }, slides));
    if (slides.length < 2) return rail;
    const dots = slides.map((slide, index) => h('button', { type: 'button', 'aria-label': `کد تخفیف ${formatNumber(index + 1)}`,
      onclick: () => slide.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' }) }));
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const index = slides.indexOf(entry.target);
        dots.forEach((dot, i) => dot.setAttribute('aria-current', String(i === index)));
      }
    }, { root: rail, threshold: 0.6 });
    slides.forEach(slide => observer.observe(slide));
    dots[0].setAttribute('aria-current', 'true');
    return h('div', {}, rail, h('div.sp-dots', { role: 'group', 'aria-label': 'انتخاب کد تخفیف' }, dots));
  } });
}

export function renderTiles(region, ctx) {
  const { tiles, errors } = ctx.data;
  fill(region, { error: errors.feature_tiles, items: tiles, empty: 'پیشنهادی برای نمایش نیست.', render: () =>
    h('div.sp-tiles-grid', {}, tiles.map((tile, index) => {
      const wide = index === 2 || (tiles.length === 1);
      return h('button.sp-tile', { type: 'button', class: wide ? 'sp-tile--wide' : undefined, 'aria-haspopup': 'dialog',
        'aria-label': `${tile.title}؛ ${tile.merchants.map(m => m.name).join('، ')}`,
        onclick: () => ctx.openTile(tile) },
        img(tile.image, { alt: '', width: 480, height: 300, fallback: false }),
        h('span.sp-tile__content', {},
          h('span', {}, h('span.sp-tile__title', {}, tile.title),
            h('span.sp-tile__cta', { html: `${tile.merchants.length > 1 ? `${formatNumber(tile.merchants.length)} فروشگاه` : 'مشاهده فروشگاه'} ${icon('chevron').replace('<svg', '<svg width="12" height="12"')}` })),
          h('span.sp-tile__logos', { 'aria-hidden': 'true' }, tile.merchants.slice(0, 3).map(m => img(m.logo, { alt: '', width: 28, height: 28, fallback: false })))));
    })) });
}

export function renderStores(region, ctx) {
  const { stores, errors } = ctx.data;
  fill(region, { error: errors.stores, items: stores, empty: 'فروشگاهی برای نمایش نیست.', render: () =>
    enableDragScroll(h('div.sp-rail.sp-stores-rail', { role: 'list', 'aria-label': 'فروشگاه‌ها' },
      stores.map(store => h('div', { role: 'listitem' }, storeCard(store, ctx))))) });
}

export function renderFooter(ctx) {
  const footer = document.getElementById('sp-footer');
  footer.replaceChildren(
    ctx.data.config?.sample_content ? h('p', { style: 'margin:0' }, 'اطلاعات و لینک‌های این صفحه نمونه و آزمایشی است.') : '',
    h('button', { type: 'button', onclick: () => window.scrollTo({ top: 0 }) }, 'بازگشت به بالا ↑'));
}
