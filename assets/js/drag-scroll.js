// Mouse drag-to-scroll for horizontal rails. Touch already swipes natively; this gives desktop the same feel.
// snap: true (cards) switches scroll-snap off while dragging and glides to the nearest card on release;
// snap: false (chip rows) just scrolls freely and stays where it is let go.

const center = node => { const rect = node.getBoundingClientRect(); return rect.left + rect.width / 2; };

export function enableDragScroll(rail, { snap = true } = {}) {
  let drag = null, suppressClickUntil = 0;
  const slides = () => [...rail.children];

  // Horizontal distance (px) to scroll so `slide` sits at its own scroll-snap-align point
  // (start / center / end, honouring scroll-padding and RTL). Works for product, merchant, store and coupon rails alike.
  const alignDelta = slide => {
    const box = slide.getBoundingClientRect(), view = rail.getBoundingClientRect(), style = getComputedStyle(rail);
    const rtl = style.direction === 'rtl';
    const padStart = parseFloat(style.scrollPaddingInlineStart) || 0, padEnd = parseFloat(style.scrollPaddingInlineEnd) || 0;
    const align = getComputedStyle(slide).scrollSnapAlign.split(' ').pop();
    if (align === 'center') return center(slide) - center(rail);
    if (align === 'end') return rtl ? box.left - (view.left + padEnd) : box.right - (view.right - padEnd);
    return rtl ? box.right - (view.right - padStart) : box.left - (view.left + padStart);
  };
  const closest = (list, distance) => list.reduce((best, slide) => (Math.abs(distance(slide)) < Math.abs(distance(best)) ? slide : best));
  const nearest = () => closest(slides(), alignDelta);

  const settle = (dx, startSlide) => {
    let target = nearest();
    // A deliberate flick moves at least one card, in whichever direction the content was pulled (RTL-safe).
    if (target === startSlide && Math.abs(dx) > 40) {
      const from = center(startSlide);
      const candidates = slides().filter(slide => (dx > 0 ? center(slide) < from - 1 : center(slide) > from + 1));
      if (candidates.length) target = closest(candidates, slide => center(slide) - from);
    }
    const restore = () => { rail.style.scrollSnapType = ''; rail.removeEventListener('scrollend', restore); };
    rail.addEventListener('scrollend', restore);
    setTimeout(restore, 700); // browsers without scrollend
    rail.scrollBy({ left: alignDelta(target), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  };

  rail.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    drag = { id: event.pointerId, x: event.clientX, start: rail.scrollLeft, moved: false, slide: snap ? nearest() : null };
  });
  rail.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.id) return;
    const dx = event.clientX - drag.x;
    if (!drag.moved) {
      if (Math.abs(dx) < 6) return;
      drag.moved = true;
      rail.setPointerCapture(event.pointerId);
      if (snap) rail.style.scrollSnapType = 'none';
      rail.classList.add('is-dragging');
    }
    rail.scrollLeft = drag.start - dx;
  });
  const release = event => {
    if (!drag || event.pointerId !== drag.id) return;
    if (drag.moved) {
      rail.classList.remove('is-dragging');
      suppressClickUntil = performance.now() + 250;
      if (snap) settle(event.clientX - drag.x, drag.slide);
    }
    drag = null;
  };
  rail.addEventListener('pointerup', release);
  rail.addEventListener('pointercancel', release);
  // The click that ends a drag must not copy a code or open a merchant.
  rail.addEventListener('click', event => {
    if (performance.now() < suppressClickUntil) { event.preventDefault(); event.stopPropagation(); }
  }, { capture: true });
  rail.addEventListener('dragstart', event => event.preventDefault());
  return rail;
}
