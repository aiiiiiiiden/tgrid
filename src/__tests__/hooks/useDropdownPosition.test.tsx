import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { useDropdownPosition } from '../../renderer/hooks/useDropdownPosition';

function createAnchor(): HTMLElement {
  const el = document.createElement('button');
  el.getBoundingClientRect = () => ({
    top: 40,
    bottom: 60,
    left: 100,
    right: 200,
    width: 100,
    height: 20,
    x: 100,
    y: 40,
    toJSON: () => {},
  });
  document.body.appendChild(el);
  return el;
}

describe('useDropdownPosition', () => {
  it('returns a ref', () => {
    const anchor = createAnchor();
    const onClose = vi.fn();
    const { result } = renderHook(() =>
      useDropdownPosition({ anchorEl: anchor, onClose }),
    );
    expect(result.current).toBeDefined();
    expect(result.current.current).toBeNull(); // no element attached yet
  });

  it('calls onClose on Escape key', () => {
    const anchor = createAnchor();
    const onClose = vi.fn();
    // Create a div element and attach the ref
    const dd = document.createElement('div');
    document.body.appendChild(dd);

    renderHook(() => {
      const ref = useDropdownPosition({ anchorEl: anchor, onClose });
      // Manually set ref since we can't render JSX in renderHook
      (ref as any).current = dd;
      return ref;
    });

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose on outside click', () => {
    const anchor = createAnchor();
    const onClose = vi.fn();
    const dd = document.createElement('div');
    document.body.appendChild(dd);

    renderHook(() => {
      const ref = useDropdownPosition({ anchorEl: anchor, onClose });
      (ref as any).current = dd;
      return ref;
    });

    // Click on body (outside the dropdown)
    const outsideEl = document.createElement('span');
    document.body.appendChild(outsideEl);
    fireEvent.mouseDown(outsideEl);
    expect(onClose).toHaveBeenCalled();
  });
});
