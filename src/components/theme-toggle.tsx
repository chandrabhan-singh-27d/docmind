'use client';

import { useCallback, useSyncExternalStore } from 'react';

type Theme = 'light' | 'dark';
const STORAGE_KEY = 'docmind-theme';

/**
 * Single source of truth for the theme: the `.dark` / `.light` class on
 * <html>. The pre-hydration head script sets it before first paint;
 * everything else — this toggle, OS preference syncing, the entire
 * Tailwind dark variant — reads from there.
 *
 * Why useSyncExternalStore instead of useState/useEffect:
 *   - The DOM class can change for three reasons (head script, this
 *     toggle, OS preference change) and the icon must reflect reality.
 *   - useState would drift from the DOM whenever a non-React caller
 *     mutated the class. We've fixed that bug twice already by hand.
 *   - useSyncExternalStore subscribes to a MutationObserver on <html>;
 *     any class change triggers a re-render. Impossible to drift.
 */

const applyTheme = (theme: Theme): void => {
  const root = document.documentElement;
  root.classList.remove('light', 'dark');
  root.classList.add(theme);
};

const readTheme = (): Theme =>
  document.documentElement.classList.contains('dark') ? 'dark' : 'light';

const readPreferenceIsExplicit = (): boolean => {
  try {
    return localStorage.getItem(STORAGE_KEY) !== null;
  } catch (err) {
    console.error('[theme-toggle] localStorage read failed', err);
    return false;
  }
};

const subscribe = (notify: () => void): (() => void) => {
  if (typeof document === 'undefined') return () => {};

  // (1) Re-render whenever the <html> class changes — covers manual
  // toggle, head script, and any other future caller.
  const observer = new MutationObserver(notify);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  });

  // (2) When the OS theme changes mid-session, follow it — but only
  // if the user hasn't picked explicitly. The class change will trigger
  // (1), which re-renders.
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const onMediaChange = (): void => {
    if (readPreferenceIsExplicit()) return;
    applyTheme(media.matches ? 'dark' : 'light');
  };
  media.addEventListener('change', onMediaChange);

  return () => {
    observer.disconnect();
    media.removeEventListener('change', onMediaChange);
  };
};

// SSR-safe snapshot: server-rendered HTML doesn't have the class yet
// (it's added by the head script before paint, but after SSR), so we
// render a placeholder during SSR. After hydration the real snapshot
// kicks in and the right icon renders.
const getSnapshot = (): Theme => readTheme();
const getServerSnapshot = (): Theme | null => null;

export default function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggle = useCallback(() => {
    // Read from the DOM, not from React state — the DOM is truth.
    const current = readTheme();
    const next: Theme = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch (err) {
      console.error('[theme-toggle] localStorage write failed', err);
    }
  }, []);

  if (theme === null) {
    return (
      <button
        type="button"
        aria-label="Toggle theme"
        className="h-9 w-9 shrink-0 rounded-md border border-zinc-200 dark:border-zinc-800"
      />
    );
  }

  const isDark = theme === 'dark';
  const label = isDark ? 'Switch to light mode' : 'Switch to dark mode';

  return (
    <button
      type="button"
      onClick={toggle}
      title={label}
      aria-label={label}
      className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md border border-zinc-200 text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
    >
      {isDark ? (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" /></svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
      )}
    </button>
  );
}
