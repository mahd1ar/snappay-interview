// Endless auto-scrolling row on top of native horizontal scroll.
// The track holds several copies of the items; we drift scrollLeft and silently jump by one
// cycle when we drift too far, so the user can still swipe/fling it like any scroller.

export function mountMarquee(row, { direction = 1, speed = 24, resumeAfter = 1800, isPaused = () => false } = {}) {
  const track = row.firstElementChild;
  const count = Number(row.dataset.count);
  let cycle = 0, pos = 0, expected = -1, frame = 0, last = 0, resumeAt = 0;
  let visible = false, hovered = false, focused = false, pointerDown = false, settleTimer = 0, resumeTimer = 0;

  const wrap = () => {
    if (!cycle) return 0;
    const before = pos;
    while (pos < cycle * 0.5) pos += cycle;
    while (pos >= cycle * 1.5) pos -= cycle;
    return pos - before;
  };
  const apply = () => { row.scrollLeft = pos; expected = row.scrollLeft; };
  const measure = () => {
    const slides = track.children;
    if (slides.length <= count) return;
    const fraction = cycle ? (pos - cycle) / cycle : 0;
    cycle = slides[count].offsetLeft - slides[0].offsetLeft;
    pos = cycle * (1 + fraction);
    wrap(); apply();
  };

  const canRun = () => cycle > 0 && visible && !hovered && !focused && !pointerDown && !isPaused()
    && document.visibilityState === 'visible' && performance.now() >= resumeAt;
  const tick = time => {
    frame = 0;
    if (!canRun()) { last = 0; return; }
    const seconds = last ? Math.min(time - last, 64) / 1000 : 0;
    last = time;
    pos += direction * speed * seconds;
    wrap(); apply();
    frame = requestAnimationFrame(tick);
  };
  const sync = () => {
    if (canRun()) { if (!frame) { last = 0; frame = requestAnimationFrame(tick); } }
    else { cancelAnimationFrame(frame); frame = 0; last = 0; }
  };
  const holdFor = ms => {
    resumeAt = performance.now() + ms;
    clearTimeout(resumeTimer); resumeTimer = setTimeout(sync, ms + 20);
    sync();
  };

  // Any scroll we did not cause is the user: follow it, pause, and re-centre once it settles.
  row.addEventListener('scroll', () => {
    if (Math.abs(row.scrollLeft - expected) <= 1.5) return;
    pos = row.scrollLeft; expected = pos;
    holdFor(resumeAfter);
    clearTimeout(settleTimer);
    settleTimer = setTimeout(() => { if (!pointerDown) { pos = row.scrollLeft; if (wrap()) apply(); } }, 160);
  }, { passive: true });

  // Mouse drag (touch already pans natively).
  let drag = null, suppressClickUntil = 0;
  // Swallow the click that ends a drag so it does not open a category.
  row.addEventListener('click', event => {
    if (performance.now() < suppressClickUntil) { event.preventDefault(); event.stopPropagation(); }
  }, { capture: true });
  row.addEventListener('pointerdown', event => {
    pointerDown = true; sync();
    if (event.pointerType === 'mouse' && event.button === 0) drag = { x: event.clientX, start: row.scrollLeft, moved: false, id: event.pointerId };
  });
  row.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.id) return;
    const dx = event.clientX - drag.x;
    if (!drag.moved && Math.abs(dx) < 6) return;
    if (!drag.moved) { drag.moved = true; row.setPointerCapture(event.pointerId); row.classList.add('is-dragging'); }
    pos = drag.start - dx;
    drag.start += wrap();
    apply();
  });
  const release = () => {
    if (!pointerDown) return;
    pointerDown = false;
    if (drag?.moved) {
      row.classList.remove('is-dragging');
      suppressClickUntil = performance.now() + 250;
    }
    drag = null;
    holdFor(resumeAfter);
  };
  row.addEventListener('pointerup', release);
  row.addEventListener('pointercancel', release);
  row.addEventListener('lostpointercapture', release);
  window.addEventListener('pointerup', release, { passive: true });
  row.addEventListener('pointerenter', event => { if (event.pointerType === 'mouse') { hovered = true; sync(); } });
  row.addEventListener('pointerleave', event => { if (event.pointerType === 'mouse') { hovered = false; sync(); } });
  row.addEventListener('focusin', event => { focused = event.target.matches(':focus-visible'); sync(); });
  row.addEventListener('focusout', () => { focused = false; sync(); });
  document.addEventListener('visibilitychange', sync);

  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); }).observe(row);
  new ResizeObserver(measure).observe(track);
  row.classList.add('is-looping');
  measure();

  return { sync };
}
