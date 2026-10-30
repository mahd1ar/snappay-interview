// Card components. Each returns a DOM node; navigation goes through ctx.openMerchant / outbound links.
import {
  h, img, icon, channelBadge, channelLabel, formatToman, formatTomanShort, formatNumber, discountPercent,
  copyText, toast, outboundURL,
} from './ui.js';

export function productCard(product) {
  const percent = discountPercent(product.price, product.original);
  const tag = product.url ? 'a' : 'div';
  return h(`${tag}.sp-offer-card`, { href: product.url ? outboundURL(product.url) : undefined, rel: product.url ? 'noopener' : undefined,
    'aria-label': `${product.title}، ${formatToman(product.price)} تومان${product.merchant ? `، ${product.merchant.name}` : ''}` },
    h('div.sp-offer-surface', {},
      h('div.sp-offer-media', {},
        img(product.image, { className: 'sp-offer-photo', alt: '', width: 640, height: 640, fallback: product.title }),
        percent > 0 && h('span.sp-offer-badge', {}, `${formatNumber(percent)}٪`)),
      h('div.sp-offer-body', {},
        product.merchant && h('div.sp-offer-identity', {},
          img(product.merchant.logo, { className: 'sp-offer-logo', alt: '', width: 22, height: 22, fallback: false }),
          h('span.sp-offer-merchant', {}, product.merchant.name)),
        h('h3.sp-offer-title', {}, product.title),
        h('div.sp-offer-prices', {},
          product.original && h('del.sp-offer-original', { 'aria-label': `قیمت قبل ${formatToman(product.original)} تومان` }, formatToman(product.original)),
          h('div.sp-offer-final', {}, formatToman(product.price), h('small', {}, 'تومان'))))));
}

const merchantLabel = merchant => `${merchant.name}، ${channelLabel[merchant.channel]}`;

/** Tall storefront card for the merchant carousel. */
export function merchantStory(item, ctx) {
  const { merchant } = item;
  const tags = merchant.categoryIds.map(id => ctx.data.categoryById.get(id)?.title).filter(Boolean).slice(0, 2).join(' · ');
  return h('button.sp-merchant-story', { type: 'button', 'aria-haspopup': 'dialog', 'aria-label': merchantLabel(merchant),
    onclick: () => ctx.openMerchant(merchant) },
    img(item.image, { className: 'sp-merchant-story__photo', alt: '', width: 390, height: 640, fallback: false }),
    img(item.logo, { className: 'sp-merchant-story__logo', alt: '', width: 40, height: 40, fallback: false }),
    h('span.sp-merchant-story__content', {},
      channelBadge(merchant.channel),
      h('span.sp-merchant-story__name', {}, item.title),
      tags && h('span.sp-merchant-story__tags', {}, tags)));
}

/** Square photo card used in panel grids. */
export function merchantCard(merchant, ctx, index = 0) {
  return h('button.sp-merchant-card', { type: 'button', 'aria-label': merchantLabel(merchant), style: `--card-delay:${Math.min(index, 8) * 30}ms`,
    onclick: () => ctx.openMerchant(merchant) },
    img(merchant.image, { alt: '', width: 390, height: 640, fallback: false }),
    h('span.sp-merchant-card__content', {},
      img(merchant.logo, { className: 'sp-merchant-card__logo', alt: '', width: 32, height: 32, fallback: false }),
      h('span.sp-merchant-card__name', {}, merchant.name),
      channelBadge(merchant.channel)));
}

export function storeCard(store, ctx) {
  const { merchant } = store;
  return h('button.sp-store-card', { type: 'button', 'aria-label': merchantLabel(merchant), onclick: () => ctx.openMerchant(merchant) },
    h('span.sp-store-cover', {}, img(store.image, { alt: '', width: 72, height: 72, fallback: store.name })),
    h('span.sp-store-content', {},
      h('span.sp-store-identity', {},
        img(store.logo, { className: 'sp-store-logo', alt: '', width: 24, height: 24, fallback: false }),
        h('span.sp-store-name', {}, store.name)),
      h('span.sp-store-meta', {}, channelBadge(merchant.channel), h('span.sp-store-arrow', { html: icon('chevron') }))));
}

const persianDate = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { day: 'numeric', month: 'long', year: 'numeric' });

/** Voucher card in the Snapp Club style: title, eligibility pill, status badges, code bar. */
export function couponCard(coupon, ctx) {
  const { merchant } = coupon;
  const value = coupon.type === 'percent' ? `${formatNumber(coupon.value)}٪` : formatTomanShort(coupon.value);
  const title = `${value} کد تخفیف ${merchant.name}`;
  const days = coupon.daysLeft;
  const urgent = days !== null && days <= 7;
  const expiry = days === null ? '' : urgent
    ? (days === 0 ? 'فقط امروز' : `${formatNumber(days)} روز مانده`)
    : `انقضا تا ${persianDate.format(coupon.expires)}`;

  const copyLabel = 'کپی کردن';
  const copyButton = h('button.sp-coupon__copy', { type: 'button', 'aria-label': `کپی کد ${coupon.code}`,
    html: `${icon('copy')}<span>${copyLabel}</span>` });
  copyButton.addEventListener('click', async () => {
    const ok = await copyText(coupon.code);
    toast(ok ? `کد ${coupon.code} کپی شد` : 'کپی نشد؛ کد را نگه دارید و دستی وارد کنید');
    if (!ok) return;
    copyButton.classList.add('is-copied');
    copyButton.innerHTML = `${icon('check')}<span>کپی شد</span>`;
    setTimeout(() => { copyButton.classList.remove('is-copied'); copyButton.innerHTML = `${icon('copy')}<span>${copyLabel}</span>`; }, 2000);
  });

  return h('article.sp-coupon', { 'aria-label': title },
    h('p.sp-coupon__title', {}, title),
    // Eligibility pill: merchant logo + the order condition; opens the merchant.
    h('button.sp-coupon__pill', { type: 'button', 'aria-haspopup': 'dialog', 'aria-label': `مشاهده ${merchant.name}`,
      onclick: () => ctx.openMerchant(merchant) },
      img(coupon.logo, { alt: '', width: 24, height: 24, fallback: false }),
      h('span', {}, coupon.minOrder ? `حداقل خرید ${formatTomanShort(coupon.minOrder)}` : merchant.name)),
    h('div.sp-coupon__badges', {},
      expiry && h('span.sp-coupon__badge', { class: urgent ? 'sp-coupon__badge--urgent' : undefined }, expiry),
      coupon.type === 'percent' && coupon.maxDiscount > 0 && h('span.sp-coupon__badge.sp-coupon__badge--soft', {}, `سقف ${formatTomanShort(coupon.maxDiscount)}`)),
    h('div.sp-coupon__bar', {},
      h('span.sp-coupon__code', { 'aria-label': `کد تخفیف ${coupon.code}` }, coupon.code),
      copyButton));
}
