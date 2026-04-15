import { useEffect, useState } from 'react';
import type { JSX, ReactNode } from 'react';
import { ThemeProviderContext } from './theme-context';
import type { Theme, ThemeProviderState } from './theme-context';

interface ThemeProviderProps {
  children: ReactNode
  defaultTheme?: Theme
  storageKey?: string
}

/** Provides theme state to the component tree via ThemeProviderContext. */
export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = 'vite-ui-theme',
  ...props
}: ThemeProviderProps): JSX.Element {
  const [theme, setThemeState] = useState<Theme>(
    () => (localStorage.getItem(storageKey) ?? defaultTheme) as Theme,
  );

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const systemTheme = mediaQuery.matches ? 'dark' : 'light';
      root.classList.add(systemTheme);

      const listener = (e: MediaQueryListEvent): void => {
        root.classList.remove('light', 'dark');
        root.classList.add(e.matches ? 'dark' : 'light');
      };
      mediaQuery.addEventListener('change', listener);
      return () => { mediaQuery.removeEventListener('change', listener); };
    }

    root.classList.add(theme);
    return undefined;
  }, [theme]);

  const value: ThemeProviderState = {
    theme,
    setTheme: (newTheme: Theme): void => {
      localStorage.setItem(storageKey, newTheme);
      setThemeState(newTheme);
    },
  };

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}
