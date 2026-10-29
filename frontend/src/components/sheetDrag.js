// Swipe-down-to-dismiss for bottom sheets. Spread the returned props on the sheet element:
//   <div className="qty-modal" {...sheetDrag(() => setOpen(false))}>
// The sheet follows the finger (only downward), and closes if dragged far enough or flicked; otherwise it springs back.
export function sheetDrag(onClose) {
  let y0 = 0, dy = 0, t0 = 0, on = false;
  const style = (el, ty, anim) => {
    el.style.transition = anim ? "transform .22s cubic-bezier(.2,.8,.2,1)" : "none";
    el.style.transform = ty ? "translate3d(0," + ty + "px,0)" : "";
  };
  return {
    onTouchStart(e) {
      const el = e.currentTarget;
      if (e.touches.length !== 1 || el.scrollTop > 0) return;
      y0 = e.touches[0].clientY;
      dy = 0;
      t0 = Date.now();
      on = true;
    },
    onTouchMove(e) {
      if (!on) return;
      dy = e.touches[0].clientY - y0;
      if (dy <= 0) { dy = 0; return style(e.currentTarget, 0, false); }
      style(e.currentTarget, dy * 0.9, false);
    },
    onTouchEnd(e) {
      if (!on) return;
      on = false;
      const el = e.currentTarget;
      const speed = dy / Math.max(1, Date.now() - t0);
      if (dy > 110 || (dy > 30 && speed > 0.6)) {
        style(el, window.innerHeight, true);
        setTimeout(() => { onClose(); style(el, 0, false); }, 180);
      } else {
        style(el, 0, true);
      }
    },
    onTouchCancel(e) {
      on = false;
      style(e.currentTarget, 0, true);
    },
  };
}
