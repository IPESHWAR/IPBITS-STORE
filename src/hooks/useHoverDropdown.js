'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

function canHover() {
  if (typeof window === 'undefined') return false;
  try {
    return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  } catch {
    return false;
  }
}

/**
 * Dropdown open state with hover open/close (debounced leave) + click toggle for touch.
 */
export function useHoverDropdown(closeDelayMs = 160) {
  const [open, setOpen] = useState(false);
  const closeTimerRef = useRef(null);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearCloseTimer(), [clearCloseTimer]);

  const openMenu = useCallback(() => {
    clearCloseTimer();
    setOpen(true);
  }, [clearCloseTimer]);

  const closeMenu = useCallback(() => {
    clearCloseTimer();
    setOpen(false);
  }, [clearCloseTimer]);

  const scheduleClose = useCallback(() => {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      setOpen(false);
      closeTimerRef.current = null;
    }, closeDelayMs);
  }, [clearCloseTimer, closeDelayMs]);

  const onMouseEnter = useCallback(() => {
    if (canHover()) openMenu();
  }, [openMenu]);

  const onMouseLeave = useCallback(() => {
    if (canHover()) scheduleClose();
  }, [scheduleClose]);

  const onClickToggle = useCallback((e) => {
    // On fine-pointer hover devices, click still toggles (fallback / a11y).
    e?.stopPropagation?.();
    clearCloseTimer();
    setOpen((v) => !v);
  }, [clearCloseTimer]);

  return {
    open,
    setOpen,
    openMenu,
    closeMenu,
    onMouseEnter,
    onMouseLeave,
    onClickToggle,
  };
}
