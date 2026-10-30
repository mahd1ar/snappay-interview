// Small DOM + formatting helpers shared by every section.

const faNumber = new Intl.NumberFormat('fa-IR');

export const formatNumber = value => faNumber.format(value);
export const formatToman = value => `${faNumber.format(value)}`;

/** 500000 → «۵۰۰ هزار تومان», 2500000 → «۲٫۵ میلیون تومان» */
export function formatTomanShort(value) {
  if (value >= 1e6 && value % 1e5 === 0) return `${faNumber.format(value / 1e6)} میلیون تومان`;
  if (value >= 1e3 && value % 1e3 === 0) return `${faNumber.format(value / 1e3)} هزار تومان`;
  return `${faNumber.format(value)} تومان`;
}

export const discountPercent = (price, original) => (original ? Math.round((1 - price / original) * 100) : 0);

export const channelLabel = { online: 'خرید آنلاین', offline: 'خرید حضوری', both: 'آنلاین و حضوری' };

const icons = {
  online: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="2" y="3" width="12" height="8.5" rx="1.5"/><path d="M5.5 14h5"/></svg>',
  offline: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 6.5 3.5 2.5h9l1 4M3 6.5V14h10V6.5M2.5 6.5h11M6.5 14v-3.5h3V14"/></svg>',
  both: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M3 8.5 6.5 12 13 4.5"/></svg>',
  chevron: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m10 3-5 5 5 5"/></svg>',
  copy: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
  phone: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M5 3.5h3.5l1.5 4.5-2.2 1.4a11 11 0 0 0 6.8 6.8l1.4-2.2 4.5 1.5V19a2 2 0 0 1-2 2A17 17 0 0 1 3 5.5a2 2 0 0 1 2-2Z"/></svg>',
  pin: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
  search: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg>',
};
export const icon = name => icons[name] ?? '';

/**
 * Tiny element factory: h('a.sp-card', { href, onclick }, child, 'text').
 * `html` sets trusted markup (icons only); every other string is inserted as text.
 */
export function h(tag, props = {}, ...children) {
  const [name, ...classes] = tag.split('.');
  const node = document.createElement(name || 'div');
  if (classes.length) node.className = classes.join(' ');
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'html') node.innerHTML = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key === 'class') node.classList.add(...String(value).split(/\s+/).filter(Boolean));
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value);
    else if (key in node && typeof value !== 'string') node[key] = value;
    else node.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

/** <img> that swaps itself for a labelled fallback block when the file is missing. */
export function img(src, { alt = '', className, width, height, eager = false, fallback } = {}) {
  const node = h('img', { src, alt, class: className, width, height, loading: eager ? 'eager' : 'lazy', decoding: 'async' });
  node.addEventListener('error', () => {
    node.parentElement?.classList.add('has-no-image');
    if (fallback === false) { node.style.visibility = 'hidden'; return; }
    node.replaceWith(h('span.sp-img-fallback', { 'aria-hidden': 'true' }, fallback ?? alt ?? ''));
  }, { once: true });
  if (!src) queueMicrotask(() => node.dispatchEvent(new Event('error')));
  return node;
}

export function channelBadge(channel) {
  return h('span.sp-channel', { dataset: { channel }, html: `${icon(channel)}<span>${channelLabel[channel]}</span>` });
}

export function skeleton(className, count) {
  return h(`div.${className}`, { 'aria-hidden': 'true' }, Array.from({ length: count }, () => h('span.sp-skeleton')));
}

/** Empty/error state for a section. Never invents content: just says nothing is available. */
export function stateMessage(message, retry) {
  return h('div.sp-state', { role: 'status' }, message, retry && h('button.sp-button', { type: 'button', onclick: retry }, 'تلاش دوباره'));
}

let toastTimer = 0;
export function toast(message) {
  const node = document.getElementById('sp-toast');
  node.textContent = message;
  node.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove('is-visible'), 2200);
}

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch {
    // Older in-app webviews: fall back to a temporary selection.
    const field = h('textarea', { readonly: true, style: 'position:fixed;opacity:0;inset:0' });
    field.value = text; document.body.append(field); field.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    field.remove();
    return ok;
  }
}

/** Keeps ?utm_* from the landing URL on outbound links, without overriding what the CSV already set. */
export function outboundURL(url) {
  if (!url) return '';
  try {
    const target = new URL(url);
    for (const [key, value] of new URLSearchParams(location.search)) {
      if (key.startsWith('utm_') && !target.searchParams.has(key)) target.searchParams.set(key, value);
    }
    return target.href;
  } catch { return ''; }
}
