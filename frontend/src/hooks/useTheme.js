import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'qc_theme';
const VALID_THEMES = ['dark-glass', 'light', 'midnight'];

/**
 * useTheme — persistent, functional theme switcher.
 * Writes `data-theme` attribute to the <html> element every time the theme changes.
 * Falls back to `dark-glass` if an unrecognised value is read from localStorage.
 */
export function useTheme() {
    const [theme, setThemeState] = useState(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        return VALID_THEMES.includes(saved) ? saved : 'dark-glass';
    });

    // Apply the theme attribute to <html> whenever it changes
    useEffect(() => {
        const root = document.documentElement;
        if (theme === 'dark-glass') {
            root.removeAttribute('data-theme');   // :root defaults = dark-glass
        } else {
            root.setAttribute('data-theme', theme);
        }
    }, [theme]);

    const setTheme = useCallback((newTheme) => {
        if (!VALID_THEMES.includes(newTheme)) return;
        localStorage.setItem(STORAGE_KEY, newTheme);
        setThemeState(newTheme);
    }, []);

    return { theme, setTheme };
}
