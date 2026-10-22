import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  Search,
  Sun,
  Moon,
  Languages,
  Type,
  Contrast,
  LogOut,
  Menu,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useI18n } from '../context/I18nContext';
import { Segmented } from './ui/Primitives';

export default function Navbar({ onOpenCommandPalette }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme, largeText, setLargeText, highContrast, setHighContrast } = useTheme();
  const { lang, setLang, t } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const roleTabs = [];
  if (user) {
    if (user.role === 'patient') {
      roleTabs.push({ value: '/app/patient', label: t('nav.patient') });
    }
    if (user.role === 'physician') {
      roleTabs.push({ value: '/app/physician', label: t('nav.physician') });
    }
    if (user.role === 'triage' || user.role === 'physician') {
      roleTabs.push({ value: '/app/triage', label: t('nav.triage') });
    }
    roleTabs.push({ value: '/app/analytics', label: t('nav.analytics') });
  }

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[120] focus:px-4 focus:py-2 focus:rounded-full focus:bg-[#0071e3] focus:text-white"
      >
        {t('nav.skipToContent')}
      </a>
      <header
        className={`sticky top-0 z-40 h-12 w-full apple-glass transition-all ${
          scrolled ? 'hairline-b' : 'border-b border-transparent'
        }`}
      >
        <div className="max-w-apple mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              to={user ? roleTabs[0]?.value || '/' : '/'}
              className="flex items-center gap-2 text-apple-text font-semibold text-sm tracking-tight"
            >
              <Activity className="w-4 h-4 text-[#0071e3]" />
              <span>{t('brand')}</span>
            </Link>
            <span className="hidden md:inline-block text-[11px] text-apple-textSecondary pl-2 border-l border-apple-border">
              {t('ministryTag')}
            </span>
          </div>

          {!user ? (
            <nav className="hidden md:flex items-center gap-7 text-xs font-normal text-apple-textSecondary">
              <a href="#overview" className="hover:text-apple-text transition">
                {t('nav.overview')}
              </a>
              <a href="#journey" className="hover:text-apple-text transition">
                {t('nav.journey')}
              </a>
              <a href="#capabilities" className="hover:text-apple-text transition">
                {t('nav.capabilities')}
              </a>
            </nav>
          ) : (
            <div className="hidden md:flex items-center">
              <Segmented
                idPrefix="global_nav"
                options={roleTabs}
                value={location.pathname}
                onChange={path => navigate(path)}
              />
            </div>
          )}

          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={onOpenCommandPalette}
              aria-label="Open Command Palette"
              className="inline-flex items-center gap-2 h-8 px-3 rounded-full bg-apple-bgSecondary hairline-border text-xs text-apple-textSecondary hover:text-apple-text transition"
            >
              <Search className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Search</span>
              <kbd className="hidden sm:inline-block text-[10px] font-mono opacity-75">⌘K</kbd>
            </button>

            <button
              type="button"
              onClick={() => setLang(lang === 'en' ? 'hi' : 'en')}
              aria-label="Switch Language"
              title="Switch English / Hindi"
              className="h-8 px-2.5 rounded-full hover:bg-apple-bgSecondary text-xs font-medium text-apple-textSecondary hover:text-apple-text inline-flex items-center gap-1 transition"
            >
              <Languages className="w-3.5 h-3.5" />
              <span>{lang === 'en' ? 'HI' : 'EN'}</span>
            </button>

            <button
              type="button"
              onClick={() => setLargeText(!largeText)}
              aria-label={t('nav.largeText')}
              title={t('nav.largeText')}
              className={`h-8 w-8 rounded-full inline-flex items-center justify-center transition ${
                largeText
                  ? 'bg-[#0071e3] text-white'
                  : 'hover:bg-apple-bgSecondary text-apple-textSecondary hover:text-apple-text'
              }`}
            >
              <Type className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => setHighContrast(!highContrast)}
              aria-label={t('nav.highContrast')}
              title={t('nav.highContrast')}
              className={`h-8 w-8 rounded-full inline-flex items-center justify-center transition ${
                highContrast
                  ? 'bg-[#0071e3] text-white'
                  : 'hover:bg-apple-bgSecondary text-apple-textSecondary hover:text-apple-text'
              }`}
            >
              <Contrast className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? t('nav.lightMode') : t('nav.darkMode')}
              className="h-8 w-8 rounded-full hover:bg-apple-bgSecondary text-apple-textSecondary hover:text-apple-text inline-flex items-center justify-center transition"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {user ? (
              <button
                type="button"
                onClick={() => {
                  logout();
                  navigate('/');
                }}
                aria-label={t('nav.signOut')}
                title={`${user.name} — ${t('nav.signOut')}`}
                className="hidden sm:inline-flex items-center gap-1.5 h-8 px-3 rounded-full hover:bg-apple-bgSecondary text-xs font-medium text-apple-textSecondary hover:text-apple-text transition"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>{t('nav.signOut')}</span>
              </button>
            ) : (
              <Link
                to="/login"
                className="hidden sm:inline-flex items-center h-8 px-3.5 rounded-full bg-[#0071e3] hover:bg-[#0077ed] text-white text-xs font-medium transition"
              >
                {t('nav.signIn')}
              </Link>
            )}

            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle Menu"
              className="md:hidden h-8 w-8 rounded-full hover:bg-apple-bgSecondary inline-flex items-center justify-center text-apple-text"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="fixed inset-x-0 top-12 bottom-0 z-30 bg-apple-bg p-6 md:hidden flex flex-col justify-between"
          >
            <div className="space-y-4">
              {user ? (
                roleTabs.map(tab => (
                  <button
                    key={tab.value}
                    type="button"
                    onClick={() => {
                      navigate(tab.value);
                      setMobileMenuOpen(false);
                    }}
                    className="block w-full text-left py-3 text-2xl font-semibold text-apple-text hairline-b"
                  >
                    {tab.label}
                  </button>
                ))
              ) : (
                <>
                  <Link
                    to="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block py-3 text-2xl font-semibold text-apple-text hairline-b"
                  >
                    {t('nav.signIn')}
                  </Link>
                </>
              )}
            </div>
            {user && (
              <button
                type="button"
                onClick={() => {
                  logout();
                  setMobileMenuOpen(false);
                  navigate('/');
                }}
                className="w-full py-3 rounded-full bg-[#ff3b30] text-white font-semibold text-sm"
              >
                {t('nav.signOut')}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
