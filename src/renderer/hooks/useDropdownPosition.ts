import { useEffect, useRef } from 'react';

interface UseDropdownPositionOptions {
  anchorEl: HTMLElement;
  onClose: () => void;
  /** Position dropdown above the anchor instead of below. Default: false. */
  above?: boolean;
}

/**
 * Positions a dropdown relative to an anchor element, handles outside-click
 * and Escape-key dismissal, and adjusts for viewport overflow.
 *
 * Returns a ref to attach to the dropdown container element.
 */
export function useDropdownPosition<T extends HTMLElement = HTMLDivElement>({
  anchorEl,
  onClose,
  above = false,
}: UseDropdownPositionOptions) {
  const ddRef = useRef<T>(null);

  useEffect(() => {
    const dd = ddRef.current;
    if (!dd) return;

    const rect = anchorEl.getBoundingClientRect();

    if (above) {
      dd.style.top = `${rect.top - 4}px`;
      dd.style.left = `${rect.left}px`;
    } else {
      dd.style.top = `${rect.bottom + 4}px`;
      dd.style.left = `${rect.left}px`;
    }

    requestAnimationFrame(() => {
      const ddRect = dd.getBoundingClientRect();
      if (ddRect.right > window.innerWidth) {
        dd.style.left = `${window.innerWidth - ddRect.width - 8}px`;
      }
      if (above) {
        dd.style.top = `${rect.top - ddRect.height - 4}px`;
      } else if (ddRect.bottom > window.innerHeight) {
        dd.style.top = `${rect.top - ddRect.height - 4}px`;
      }
    });

    const handleOutside = (e: MouseEvent) => {
      if (dd && !dd.contains(e.target as Node)) onClose();
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [anchorEl, onClose, above]);

  return ddRef;
}
