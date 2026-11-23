// tooltip.js: small hover/focus tooltip for anything with a data-tip attribute.

import { clamp } from './utils.js';

export function initTooltip() {
  const tip = document.getElementById('tip');

  function show(el, x, y) {
    tip.textContent = el.getAttribute('data-tip');
    tip.hidden = false;
    const w = tip.offsetWidth;
    tip.style.left = clamp(x + 12, 8, window.innerWidth - w - 8) + 'px';
    tip.style.top = (y > 48 ? y - 40 : y + 18) + 'px';
  }

  document.addEventListener('pointermove', (e) => {
    const t = e.target.closest && e.target.closest('[data-tip]');
    if (t) show(t, e.clientX, e.clientY);
    else tip.hidden = true;
  });
  document.addEventListener('focusin', (e) => {
    const t = e.target.closest && e.target.closest('[data-tip]');
    if (t) {
      const r = t.getBoundingClientRect();
      show(t, r.left + r.width / 2 - 40, r.top);
    }
  });
  document.addEventListener('focusout', () => { tip.hidden = true; });
  document.addEventListener('scroll', () => { tip.hidden = true; }, true);
}
