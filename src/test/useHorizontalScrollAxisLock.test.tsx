import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useHorizontalScrollAxisLock } from '@/hooks/useHorizontalScrollAxisLock';

function TouchHarness() {
  const ref = useHorizontalScrollAxisLock();
  return (
    <div data-testid="scroller" ref={ref}>
      <a data-testid="item" href="#produto">Item</a>
      <div style={{ width: 1200, height: 30 }} />
    </div>
  );
}

function setScrollableMetrics(el: HTMLDivElement, clientWidth: number, scrollWidth: number) {
  Object.defineProperty(el, 'clientWidth', { configurable: true, value: clientWidth });
  Object.defineProperty(el, 'scrollWidth', { configurable: true, value: scrollWidth });
}

function dispatchTouch(target: HTMLElement, type: 'touchstart' | 'touchmove' | 'touchend', x: number, y: number) {
  const ev = new Event(type, { bubbles: true, cancelable: true });
  const touches = type === 'touchend' ? [] : [{ pageX: x, pageY: y }];
  Object.defineProperty(ev, 'touches', { configurable: true, value: touches });
  Object.defineProperty(ev, 'changedTouches', { configurable: true, value: [{ pageX: x, pageY: y }] });
  target.dispatchEvent(ev);
  return ev;
}

function dispatchPointer(
  target: HTMLElement,
  type: 'pointerdown' | 'pointermove' | 'pointerup',
  x: number,
  y: number,
  pointerType: 'mouse' | 'pen' = 'mouse',
) {
  const ev = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(ev, 'pageX', { configurable: true, value: x });
  Object.defineProperty(ev, 'pageY', { configurable: true, value: y });
  Object.defineProperty(ev, 'pointerType', { configurable: true, value: pointerType });
  Object.defineProperty(ev, 'pointerId', { configurable: true, value: 1 });
  target.dispatchEvent(ev);
  return ev;
}

describe('useHorizontalScrollAxisLock', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('mantém o scroll nativo no toque horizontal sem forçar scroll via JS', () => {
    render(<TouchHarness />);
    const scroller = screen.getByTestId('scroller') as HTMLDivElement;
    setScrollableMetrics(scroller, 300, 1200);
    scroller.scrollLeft = 120;

    dispatchTouch(scroller, 'touchstart', 100, 100);
    const moveEvent = dispatchTouch(scroller, 'touchmove', 30, 95);

    expect(moveEvent.defaultPrevented).toBe(false);
    expect(scroller.scrollLeft).toBe(120);
  });

  it('não força scroll vertical via JS quando gesto é vertical', () => {
    const scrollBySpy = vi.spyOn(window, 'scrollBy').mockImplementation(() => {});
    render(<TouchHarness />);
    const scroller = screen.getByTestId('scroller') as HTMLDivElement;
    setScrollableMetrics(scroller, 300, 1200);
    scroller.scrollLeft = 120;

    dispatchTouch(scroller, 'touchstart', 100, 100);
    const moveEvent = dispatchTouch(scroller, 'touchmove', 95, 20);

    expect(moveEvent.defaultPrevented).toBe(false);
    expect(scroller.scrollLeft).toBe(120);
    expect(scrollBySpy).not.toHaveBeenCalled();
  });

  it('bloqueia click acidental após arrastar horizontalmente no toque', () => {
    render(<TouchHarness />);
    const scroller = screen.getByTestId('scroller') as HTMLDivElement;
    const link = screen.getByTestId('item');
    setScrollableMetrics(scroller, 300, 1200);

    dispatchTouch(scroller, 'touchstart', 180, 100);
    dispatchTouch(scroller, 'touchmove', 60, 98);
    dispatchTouch(scroller, 'touchend', 60, 98);

    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    const dispatchResult = link.dispatchEvent(click);

    expect(dispatchResult).toBe(false);
    expect(click.defaultPrevented).toBe(true);
  });

  it('aplica lock horizontal com pointer drag para desktop', () => {
    render(<TouchHarness />);
    const scroller = screen.getByTestId('scroller') as HTMLDivElement;
    setScrollableMetrics(scroller, 300, 1200);
    scroller.scrollLeft = 120;

    const moveEvent = dispatchPointer(scroller, 'pointerdown', 180, 100);
    expect(moveEvent.defaultPrevented).toBe(false);

    const pointerMoveEvent = dispatchPointer(scroller, 'pointermove', 60, 98);
    dispatchPointer(scroller, 'pointerup', 60, 98);

    expect(pointerMoveEvent.defaultPrevented).toBe(true);
    expect(scroller.scrollLeft).toBeGreaterThan(120);
  });

  it('mantém click normal quando não houve arrasto', () => {
    render(<TouchHarness />);
    const scroller = screen.getByTestId('scroller') as HTMLDivElement;
    const link = screen.getByTestId('item');
    setScrollableMetrics(scroller, 300, 1200);

    dispatchTouch(scroller, 'touchstart', 100, 100);
    dispatchTouch(scroller, 'touchend', 100, 100);

    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    const dispatchResult = link.dispatchEvent(click);

    expect(dispatchResult).toBe(true);
    expect(click.defaultPrevented).toBe(false);
  });
});

