// Panel views. Each returns { title, render } for panel.open().
import { h, img, icon, channelBadge, formatNumber, outboundURL } from './ui.js';
import { productCard, merchantCard, storeCard, couponCard } from './components.js';
import { enableDragScroll } from './drag-scroll.js';

const normaliseText = value => value.toLowerCase().replace(/[‌\s]+/g, ' ').replace(/ي/g, 'ی').replace(/ك/g, 'ک').trim();
const channelFilters = [['all', 'همه'], ['online', 'آنلاین'], ['offline', 'حضوری']];
const matchesChannel = (merchant, filter) => filter === 'all' || merchant.channel === filter || merchant.channel === 'both';

/** Searchable, channel-filtered merchant list. layout: 'grid' (photo cards) or 'list' (store cards). */
export function merchantListView(ctx, { title, merchants, intro, layout = 'grid', autofocus = false, extra }) {
  // Kept outside render() so search text and filter survive coming back from a merchant page.
  let query = '', filter = 'all';
  return {
    title,
    render() {
      const results = h('div', { class: layout === 'grid' ? 'sp-merchant-grid' : 'sp-stores-grid' });
      const count = h('p.sp-result-count', { role: 'status', 'aria-live': 'polite' });
      const input = h('input', { type: 'search', maxlength: '100', placeholder: 'جست‌وجوی نام فروشگاه', autocomplete: 'off', enterkeyhint: 'search' });
      const chips = channelFilters.map(([id, label]) => h('button.sp-chip', { type: 'button', 'aria-pressed': String(id === filter),
        onclick: event => { filter = id; chips.forEach(chip => chip.setAttribute('aria-pressed', String(chip === event.currentTarget))); update(); } },
        label, h('small', {}, formatNumber(merchants.filter(m => matchesChannel(m, id)).length))));

      const update = () => {
        const q = normaliseText(query);
        const found = merchants.filter(m => matchesChannel(m, filter) && (!q || normaliseText(m.name).includes(q)));
        count.textContent = `${formatNumber(found.length)} فروشگاه`;
        results.replaceChildren(...found.map((merchant, index) => layout === 'grid'
          ? merchantCard(merchant, ctx, index)
          // Prefer the merchant's store cover (stores.csv) so the list matches the stores section.
          : storeCard(ctx.data.stores.find(store => store.merchant === merchant)
            ?? { merchant, name: merchant.name, image: merchant.image, logo: merchant.logo }, ctx)));
        if (!found.length) results.replaceChildren(h('p.sp-empty', {}, query ? `فروشگاهی با «${query}» پیدا نشد.` : 'فروشگاهی در این بخش نیست.'));
      };
      input.value = query;
      input.addEventListener('input', () => { query = input.value; update(); });
      update();

      return h('div', {},
        intro && h('p.sp-view-intro', {}, intro),
        h('div.sp-panel-tools', {},
          h('label.sp-search-field', {}, h('span.sp-visually-hidden', {}, 'جست‌وجوی فروشگاه‌ها'), input, h('span', { html: icon('search') })),
          enableDragScroll(h('div.sp-chips', { role: 'group', 'aria-label': 'نوع خرید' }, chips), { snap: false })),
        count, results, extra?.());
    },
    onShow(node) { if (autofocus && !query) node.querySelector('input')?.focus({ preventScroll: true }); },
  };
}

export function categoryView(ctx, categoryId, { subcategory } = {}) {
  const { categoryById, merchants, products, coupons } = ctx.data;
  const category = categoryById.get(categoryId);
  const inCategory = merchants.filter(m => m.categoryIds.includes(categoryId));
  const categoryProducts = products.filter(p => p.categoryId === categoryId);
  const categoryCoupons = coupons.filter(c => c.merchant.categoryIds.includes(categoryId));
  return merchantListView(ctx, {
    title: category?.title ?? 'فروشگاه‌ها',
    merchants: inCategory,
    intro: subcategory ? `«${subcategory.title}» را در فروشگاه‌های دسته‌ی ${category.title} پیدا کنید.` : undefined,
    extra: () => h('div', {},
      categoryProducts.length > 0 && h('section.sp-view-section', {}, h('h3', {}, 'محصولات این دسته'),
        enableDragScroll(h('div.sp-rail', {}, categoryProducts.map(p => h('div.sp-offer-slide', {}, productCard(p)))))),
      categoryCoupons.length > 0 && h('section.sp-view-section', {}, h('h3', {}, 'کدهای تخفیف این دسته'),
        enableDragScroll(h('div.sp-rail.sp-coupon-rail', {}, categoryCoupons.map(c => h('div.sp-coupon-slide', {}, couponCard(c, ctx))))))),
  });
}

export function productsView(ctx) {
  const { products, categories } = ctx.data;
  return {
    title: 'محصولات خودرو',
    render() {
      let active = 'all';
      const grid = h('div.sp-offers-grid');
      const used = categories.filter(c => products.some(p => p.categoryId === c.id));
      const options = [['all', 'همه'], ...used.map(c => [c.id, c.title])];
      const chips = options.map(([id, label]) => h('button.sp-chip', { type: 'button', 'aria-pressed': String(id === active),
        onclick: event => { active = id; chips.forEach(chip => chip.setAttribute('aria-pressed', String(chip === event.currentTarget))); update(); } }, label));
      const update = () => grid.replaceChildren(...products.filter(p => active === 'all' || p.categoryId === active).map(productCard));
      update();
      return h('div', {}, h('div.sp-panel-tools', {}, enableDragScroll(h('div.sp-chips', { role: 'group', 'aria-label': 'دسته محصول' }, chips), { snap: false })), grid);
    },
  };
}

const mapsURL = branch => `https://www.google.com/maps/search/?api=1&query=${branch.lat},${branch.lng}`;

export function merchantDetailView(ctx, merchant) {
  const { categoryById, products, coupons } = ctx.data;
  const merchantProducts = products.filter(p => p.merchant === merchant);
  const merchantCoupons = coupons.filter(c => c.merchant === merchant);
  const hasBranches = merchant.channel !== 'online' && merchant.branches.length > 0;
  return {
    title: merchant.name,
    render: () => h('div', {},
      h('div.sp-detail-hero', {}, img(merchant.image, { alt: '', width: 390, height: 640, eager: true, fallback: false })),
      h('div.sp-detail-summary', {},
        h('div.sp-detail-heading', {},
          img(merchant.logo, { className: 'sp-detail-logo', alt: '', width: 56, height: 56, fallback: false }),
          h('div', {}, h('h3', {}, merchant.name),
            h('div.sp-detail-tags', {}, channelBadge(merchant.channel),
              merchant.categoryIds.map(id => h('span.sp-detail-tag', {}, categoryById.get(id).title))))),
        merchant.description && h('p.sp-detail-desc', {}, merchant.description),
        merchant.url && h('a.sp-button.sp-button--primary', { href: outboundURL(merchant.url), rel: 'noopener' }, 'ورود به فروشگاه آنلاین'),
        merchant.channel !== 'online' && !hasBranches && h('p.sp-detail-desc', {}, 'نشانی شعبه‌ها هنوز ثبت نشده است.')),
      merchantCoupons.length > 0 && h('section.sp-view-section', {}, h('h3', {}, 'کد تخفیف'),
        enableDragScroll(h('div.sp-rail.sp-coupon-rail', {}, merchantCoupons.map(c => h('div.sp-coupon-slide', {}, couponCard(c, ctx)))))),
      merchantProducts.length > 0 && h('section.sp-view-section', {}, h('h3', {}, 'محصولات'),
        enableDragScroll(h('div.sp-rail', {}, merchantProducts.map(p => h('div.sp-offer-slide', {}, productCard(p)))))),
      hasBranches && h('section.sp-view-section', {}, h('h3', {}, `شعبه‌ها (${formatNumber(merchant.branches.length)})`),
        merchant.branches.map(branch => h('article.sp-branch', {},
          h('div.sp-branch-top', {}, h('h4', {}, branch.name),
            h('div.sp-branch-actions', {},
              branch.phone && h('a.sp-branch-action', { href: `tel:${branch.phone}`, 'aria-label': `تماس با ${branch.name}`, html: icon('phone') }),
              Number.isFinite(branch.lat) && h('a.sp-branch-action.sp-branch-action--map', { href: mapsURL(branch), rel: 'noopener', target: '_blank',
                html: `${icon('pin')}<span>مسیریابی</span>` }))),
          h('p', {}, [branch.city, branch.address].filter(Boolean).join('، ')),
          branch.hours && h('p', {}, branch.hours))))),
  };
}
