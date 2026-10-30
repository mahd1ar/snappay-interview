// One <dialog> hosts a stack of in-page views (category → merchant → …).
// Every push adds a history entry, so the phone's back gesture walks back through views and then closes.

export function createPanel() {
  const dialog = document.getElementById('sp-panel');
  const body = document.getElementById('sp-panel-body');
  const title = document.getElementById('sp-panel-title');
  const backButton = document.getElementById('sp-panel-back');
  const stack = [];
  const listeners = new Set();

  const render = (view, enter) => {
    title.textContent = view.title;
    const node = view.render();
    node.classList.add('sp-view');
    if (enter) node.dataset.enter = enter;
    body.replaceChildren(node);
    body.scrollTop = view.scrollTop ?? 0;
    dialog.classList.toggle('is-scrolled', body.scrollTop > 4);
    view.onShow?.(node);
  };

  const finishClose = () => {
    dialog.classList.remove('is-closing');
    if (dialog.open) dialog.close();
    body.replaceChildren();
    listeners.forEach(listener => listener(false));
  };

  const close = () => {
    if (!dialog.open) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { finishClose(); return; }
    dialog.classList.add('is-closing');
    setTimeout(finishClose, 190);
  };

  window.addEventListener('popstate', () => {
    if (!stack.length) return;
    stack.pop();
    if (stack.length) render(stack[stack.length - 1], 'back');
    else close();
  });

  backButton.addEventListener('click', () => history.back());
  dialog.addEventListener('cancel', event => { event.preventDefault(); history.back(); });
  // Clicking the backdrop (visible beside the column on wide screens) closes everything.
  dialog.addEventListener('click', event => { if (event.target === dialog && stack.length) history.go(-stack.length); });
  body.addEventListener('scroll', () => dialog.classList.toggle('is-scrolled', body.scrollTop > 4), { passive: true });

  return {
    /** view: { title, render(): HTMLElement, onShow?(node) } */
    open(view) {
      if (stack.length) stack[stack.length - 1].scrollTop = body.scrollTop;
      stack.push(view);
      history.pushState({ spPanel: stack.length }, '');
      if (!dialog.open) {
        dialog.classList.remove('is-closing');
        dialog.showModal();
        listeners.forEach(listener => listener(true));
        render(view);
      } else render(view, 'forward');
    },
    get isOpen() { return dialog.open; },
    onToggle(listener) { listeners.add(listener); },
  };
}
