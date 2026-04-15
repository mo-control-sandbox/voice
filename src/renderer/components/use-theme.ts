import { useContext } from 'react';
import { ThemeProviderContext } from './theme-context';
import type { ThemeProviderState } from './theme-context';

/** Returns the current theme and a setter from the nearest ThemeProvider. */
export function useTheme(): ThemeProviderState {
  return useContext(ThemeProviderContext);
}
