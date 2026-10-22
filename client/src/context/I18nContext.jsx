import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations } from '../i18n/translations';

const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('medikiosk_lang') || 'en');

  useEffect(() => {
    localStorage.setItem('medikiosk_lang', lang);
    document.documentElement.lang = lang;
  }, [lang]);

  function t(dotPath, fallback = '') {
    const dict = translations[lang] || translations.en;
    const val = dotPath.split('.').reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : undefined), dict);
    return val !== undefined ? val : fallback || dotPath;
  }

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
