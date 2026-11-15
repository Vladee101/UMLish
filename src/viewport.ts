/** Wheel-zoom + drag-pan over a stage element. Clicks that follow a drag are swallowed. */
export function createViewport(view: HTMLElement, stage: HTMLElement) {
  let s = 1, tx = 0, ty = 0, moved = false;
  const apply = () => { stage.style.transform = `translate(${tx}px,${ty}px) scale(${s})`; };

  view.addEventListener('wheel', (e) => {
    e.preventDefault();
    const r = view.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
    const ns = Math.min(8, Math.max(0.1, s * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015))));
    tx = px - ((px - tx) / s) * ns; ty = py - ((py - ty) / s) * ns; s = ns;
    apply();
  }, { passive: false });

  view.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const x0 = e.clientX, y0 = e.clientY, tx0 = tx, ty0 = ty;
    moved = false;
    const mv = (m: PointerEvent) => {
      if (Math.hypot(m.clientX - x0, m.clientY - y0) > 3) moved = true;
      if (moved) { tx = tx0 + m.clientX - x0; ty = ty0 + m.clientY - y0; apply(); }
    };
    const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); };
    addEventListener('pointermove', mv); addEventListener('pointerup', up);
  });
  view.addEventListener('click', (e) => { if (moved) { e.stopPropagation(); moved = false; } }, true);

  return {
    /** Scale to fit the pane (never above 100%), centred horizontally. */
    fit(w: number, h: number) {
      const r = view.getBoundingClientRect();
      s = Math.min(1, (r.width - 32) / w, (r.height - 32) / h);
      tx = (r.width - w * s) / 2; ty = 16; apply();
    },
    zoomTo(ns: number) { s = ns; apply(); },
  };
}
