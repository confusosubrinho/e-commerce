import { useRef, useEffect, useCallback } from 'react';

const AXIS_LOCK_THRESHOLD = 12;
const AXIS_LOCK_BIAS = 1.15;

type AxisLock = 'horizontal' | 'vertical' | null;

/**
 * Hook que aplica "axis lock" em um container com scroll horizontal:
 * - Se o usuário deslizar mais na vertical → scroll da página (vertical) segue normalmente.
 * - Se o usuário deslizar mais na horizontal → só o carrossel/grid horizontal se move.
 * Resolve o bug no mobile em que o scroll vertical trava ao passar por seções com scroll horizontal.
 */
export function useHorizontalScrollAxisLock() {
  const ref = useRef<HTMLDivElement>(null);

  const lock = useRef<AxisLock>(null);
  const pointerDragging = useRef(false);
  const suppressClick = useRef(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const lastX = useRef(0);
  const lastY = useRef(0);

  const resolveLock = useCallback((deltaX: number, deltaY: number): AxisLock => {
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    if (absX < AXIS_LOCK_THRESHOLD && absY < AXIS_LOCK_THRESHOLD) return null;
    if (absX > absY * AXIS_LOCK_BIAS) return 'horizontal';
    if (absY > absX * AXIS_LOCK_BIAS) return 'vertical';
    return null;
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const previousTouchAction = el.style.touchAction;
    const previousSnapType = el.style.scrollSnapType;
    // Deixa o browser lidar naturalmente com pan vertical; o horizontal será controlado no lock.
    el.style.touchAction = 'pan-y pinch-zoom';

    const onTouchStart = (e: TouchEvent) => {
      if (!e.touches[0]) return;
      lock.current = null;
      startX.current = e.touches[0].pageX;
      startY.current = e.touches[0].pageY;
      lastX.current = e.touches[0].pageX;
      lastY.current = e.touches[0].pageY;
      suppressClick.current = false;
      // Disable snap during drag so scrollLeft assignments aren't fought
      el.style.scrollSnapType = 'none';
      el.style.scrollBehavior = 'auto';
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!e.touches[0]) return;
      const touch = e.touches[0];
      const deltaX = touch.pageX - lastX.current;
      const totalX = touch.pageX - startX.current;
      const totalY = touch.pageY - startY.current;
      lastX.current = touch.pageX;
      lastY.current = touch.pageY;

      if (lock.current === null) {
        lock.current = resolveLock(totalX, totalY);
      }

      if (lock.current === 'horizontal') {
        e.preventDefault();
        if (Math.abs(totalX) >= AXIS_LOCK_THRESHOLD) suppressClick.current = true;
        const newScrollLeft = el.scrollLeft - deltaX;
        el.scrollLeft = Math.max(0, Math.min(newScrollLeft, el.scrollWidth - el.clientWidth));
      }
    };

    const onTouchEnd = () => {
      lock.current = null;
      // Re-enable snap after drag ends
      el.style.scrollSnapType = '';
      el.style.scrollBehavior = '';
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      const target = e.target as HTMLElement;
      if (target.closest('a') || target.closest('button')) return;
      lock.current = null;
      pointerDragging.current = true;
      suppressClick.current = false;
      startX.current = e.pageX;
      startY.current = e.pageY;
      lastX.current = e.pageX;
      lastY.current = e.pageY;
      if (e.pointerType === 'mouse') el.setPointerCapture?.(e.pointerId);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      if (!pointerDragging.current) return;
      const deltaX = e.pageX - lastX.current;
      const totalX = e.pageX - startX.current;
      const totalY = e.pageY - startY.current;
      lastX.current = e.pageX;
      lastY.current = e.pageY;

      if (lock.current === null) {
        lock.current = resolveLock(totalX, totalY);
      }

      if (lock.current === 'horizontal') {
        e.preventDefault();
        if (Math.abs(totalX) >= AXIS_LOCK_THRESHOLD) suppressClick.current = true;
        const newScrollLeft = el.scrollLeft - deltaX;
        el.scrollLeft = Math.max(0, Math.min(newScrollLeft, el.scrollWidth - el.clientWidth));
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      el.releasePointerCapture?.(e.pointerId);
      pointerDragging.current = false;
      lock.current = null;
    };

    const onClickCapture = (e: MouseEvent) => {
      if (!suppressClick.current) return;
      e.preventDefault();
      e.stopPropagation();
      suppressClick.current = false;
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('touchcancel', onTouchEnd, { passive: true });

    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointercancel', onPointerUp);
    el.addEventListener('pointerleave', onPointerUp);
    el.addEventListener('click', onClickCapture, true);

    return () => {
      el.style.touchAction = previousTouchAction;
      el.style.scrollSnapType = previousSnapType;
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointercancel', onPointerUp);
      el.removeEventListener('pointerleave', onPointerUp);
      el.removeEventListener('click', onClickCapture, true);
    };
  }, [resolveLock]);

  return ref;
}
