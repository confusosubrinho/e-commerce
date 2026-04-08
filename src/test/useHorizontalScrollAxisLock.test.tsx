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

describe('useHorizontalScrollAxisLock', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('aplica lock horizontal e previne o evento quando gesto é majoritariamente horizontal', () => {
    render(<TouchHarness />);
    const scroller = screen.getByTestId('scroller') as HTMLDivElement;
    setScrollableMetrics(scroller, 300, 1200);
    scroller.scrollLeft = 120;

    dispatchTouch(scroller, 'touchstart', 100, 100);
    const moveEvent = dispatchTouch(scroller, 'touchmove', 30, 95);

    expect(moveEvent.defaultPrevented).toBe(true);
    expect(scroller.scrollLeft).toBeGreaterThan(120);
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

  it('bloqueia click acidental após arrastar horizontalmente', () => {
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

