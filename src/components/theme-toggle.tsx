'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';

type ThemePreference = 'system' | 'light' | 'dark';
const STORAGE_KEY = 'docmind-theme';

const readPreference = (): ThemePreference => {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === 'light' || value === 'dark') return value;
  } catch {
    // storage unavailable
  }
  return 'system';
};

const readSystemDark = (): boolean =>
  window.matchMedia('(prefers-color-scheme: dark)').matches;

const applyClass = (isDark: boolean): void => {
  const root = document.documentElement;
  root.classList.remove('light', 'dark');
  root.classList.add(isDark ? 'dark' : 'light');
};

const subscribePreference = (callback: () => void): (() => void) => {
  const onStorage = (e: StorageEvent): void => {
    if (e.key === STORAGE_KEY) callback();
  };
  const onCustom = (): void => callback();
  window.addEventListener('storage', onStorage);
  window.addEventListener('docmind-theme-change', onCustom);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener('docmind-theme-change', onCustom);
  };
};

const getServerSnapshot = (): ThemePreference => 'system';

export default function ThemeToggle() {
  const preference = useSyncExternalStore(
    subscribePreference,
    readPreference,
    getServerSnapshot,
  );

  // While in 'system' mode, mirror the OS preference live and react to changes.
  useEffect(() => {
    if (preference !== 'system') {
      applyClass(preference === 'dark');
      return;
    }

    applyClass(readSystemDark());
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent): void => applyClass(e.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [preference]);

  const cycle = useCallback(() => {
    const next: ThemePreference =
      preference === 'system' ? 'light' : preference === 'light' ? 'dark' : 'system';
    try {
      if (next === 'system') localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // storage unavailable — still update for the current session
    }
    window.dispatchEvent(new Event('docmind-theme-change'));
  }, [preference]);

  const label =
    preference === 'system'
      ? 'Theme: system (click to switch to light)'
      : preference === 'light'
        ? 'Theme: light (click to switch to dark)'
        : 'Theme: dark (click to switch to system)';

  return (
    <button
      type="button"
      onClick={cycle}
      title={label}
      aria-label={label}
      className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-zinc-200 text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
    >
      {preference === 'system' ? (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="4" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="22" x2="16" y2="22" /><line x1="12" y1="18" x2="12" y2="22" /></svg>
      ) : preference === 'dark' ? (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" /></svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
      )}
    </button>
  );
}
