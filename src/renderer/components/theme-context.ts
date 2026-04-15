import { createContext } from 'react';

export type Theme = 'dark' | 'light' | 'system';

/** Shape of the value provided by ThemeProvider. */
export interface ThemeProviderState {
  theme: Theme
  setTheme: (theme: Theme) => void
}

export const ThemeProviderContext = createContext<ThemeProviderState>({
  theme: 'system',
  setTheme: () => null,
});
