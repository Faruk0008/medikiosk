import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('medikiosk_theme');
    if (saved === 'dark' || saved === 'light') return saved;
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  });

  const [largeText, setLargeText] = useState(() => localStorage.getItem('medikiosk_large_text') === 'true');
  const [highContrast, setHighContrast] = useState(() => localStorage.getItem('medikiosk_high_contrast') === 'true');

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('medikiosk_theme', theme);
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('a11y-large-text', largeText);
    localStorage.setItem('medikiosk_large_text', String(largeText));
  }, [largeText]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('a11y-high-contrast', highContrast);
    localStorage.setItem('medikiosk_high_contrast', String(highContrast));
  }, [highContrast]);

  function toggleTheme() {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  }

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        toggleTheme,
        largeText,
        setLargeText,
        highContrast,
        setHighContrast
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
