import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Search,
  User,
  FileText,
  Activity,
  Sun,
  Languages,
  ArrowRight,
  LogOut
} from 'lucide-react';
import { apiRequest } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useI18n } from '../context/I18nContext';

export default function CommandPalette({ open, onClose }) {
  const { user, logout } = useAuth();
  const { toggleTheme } = useTheme();
  const { lang, setLang, t } = useI18n();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({ patients: [], cases: [], documents: [] });
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    const onKeyDown = e => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (open) onClose();
      } else if (e.key === 'Escape' && open) {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 40);
    } else {
      setQuery('');
      setResults({ patients: [], cases: [], documents: [] });
      setActiveIndex(0);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !user || query.trim().length < 2) {
      setResults({ patients: [], cases: [], documents: [] });
      return;
    }
    const timer = setTimeout(() => {
      apiRequest(`/api/search?q=${encodeURIComponent(query.trim())}`)
        .then(res => {
          setResults({
            patients: res.patients || [],
            cases: res.cases || [],
            documents: res.documents || []
          });
          setActiveIndex(0);
        })
        .catch(() => {});
    }, 160);
    return () => clearTimeout(timer);
  }, [query, open, user]);

  const quickActions = [
    {
      id: 'act_theme',
      label: 'Toggle Dark / Light Appearance',
      category: 'Action',
      icon: Sun,
      run: () => {
        toggleTheme();
        onClose();
      }
    },
    {
      id: 'act_lang',
      label: lang === 'en' ? 'Switch Interface to Hindi (हिन्दी)' : 'Switch Interface to English',
      category: 'Language',
      icon: Languages,
      run: () => {
        setLang(lang === 'en' ? 'hi' : 'en');
        onClose();
      }
    }
  ];

  if (user) {
    if (user.role === 'patient') {
      quickActions.unshift({
        id: 'nav_patient',
        label: 'Go to Patient Health Kiosk',
        category: 'Navigation',
        icon: Activity,
        run: () => {
          navigate('/app/patient');
          onClose();
        }
      });
    }
    if (user.role === 'physician') {
      quickActions.unshift({
        id: 'nav_physician',
        label: 'Go to Physician Workspace',
        category: 'Navigation',
        icon: Activity,
        run: () => {
          navigate('/app/physician');
          onClose();
        }
      });
    }
    if (user.role === 'triage' || user.role === 'physician') {
      quickActions.unshift({
        id: 'nav_triage',
        label: 'Go to Live Triage Priority Board',
        category: 'Navigation',
        icon: Activity,
        run: () => {
          navigate('/app/triage');
          onClose();
        }
      });
    }
    quickActions.push({
      id: 'nav_analytics',
      label: 'Open MongoDB Telemetry & Analytics',
      category: 'Navigation',
      icon: Activity,
      run: () => {
        navigate('/app/analytics');
        onClose();
      }
    });
    quickActions.push({
      id: 'act_logout',
      label: 'Sign Out of MediKiosk',
      category: 'Account',
      icon: LogOut,
      run: () => {
        logout();
        navigate('/');
        onClose();
      }
    });
  }

  const combinedItems = [
    ...results.cases.map(c => ({
      id: `case_${c._id}`,
      label: `${c.history?.chiefComplaint} (${c.patientName || 'Patient'})`,
      sub: `${c.mode.toUpperCase()} • Priority ${c.priority} • ${c.status}`,
      category: 'Case Record',
      icon: Activity,
      run: () => {
        navigate(user?.role === 'triage' ? '/app/triage' : user?.role === 'physician' ? `/app/physician?caseId=${c._id}` : '/app/patient');
        onClose();
      }
    })),
    ...results.patients.map(p => ({
      id: `pat_${p._id}`,
      label: p.userId?.name || 'Patient Profile',
      sub: `${p.demographics?.age || ''}y • ${p.demographics?.address || ''}`,
      category: 'Patient',
      icon: User,
      run: () => {
        navigate(user?.role === 'physician' ? '/app/physician' : '/app/patient');
        onClose();
      }
    })),
    ...results.documents.map(d => ({
      id: `doc_${d._id}`,
      label: `${d.docType}: ${(d.extracted?.diagnoses || []).join(', ') || 'Medical Record'}`,
      sub: new Date(d.docDate).toLocaleDateString(),
      category: 'Document',
      icon: FileText,
      run: () => {
        navigate(user?.role === 'physician' ? '/app/physician' : '/app/patient');
        onClose();
      }
    })),
    ...quickActions
  ];

  function handleKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(prev => (prev + 1) % Math.max(1, combinedItems.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(prev => (prev - 1 + Math.max(1, combinedItems.length)) % Math.max(1, combinedItems.length));
    } else if (e.key === 'Enter' && combinedItems[activeIndex]) {
      e.preventDefault();
      combinedItems[activeIndex].run();
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            transition={{ type: 'spring', stiffness: 440, damping: 32 }}
            className="relative z-10 w-full max-w-xl rounded-[24px] apple-glass hairline-border shadow-appleModal overflow-hidden"
          >
            <div className="flex items-center gap-3 px-5 py-4 hairline-b">
              <Search className="w-5 h-5 text-apple-textSecondary shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t('nav.searchPlaceholder')}
                className="w-full bg-transparent text-base text-apple-text placeholder:text-apple-textSecondary focus:outline-none"
              />
              <kbd className="text-xs text-apple-textSecondary font-mono px-2 py-0.5 rounded bg-apple-bgSecondary">
                ESC
              </kbd>
            </div>

            <div className="max-h-96 overflow-y-auto p-2">
              {combinedItems.map((item, idx) => {
                const Icon = item.icon;
                const active = idx === activeIndex;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={item.run}
                    className={`w-full text-left px-4 py-3 rounded-[16px] flex items-center justify-between gap-3 transition ${
                      active ? 'bg-[#0071e3] text-white' : 'text-apple-text hover:bg-apple-bgSecondary'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-white' : 'text-[#0071e3]'}`} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{item.label}</p>
                        {item.sub && (
                          <p className={`text-xs truncate ${active ? 'text-white/80' : 'text-apple-textSecondary'}`}>
                            {item.sub}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded-full ${
                          active ? 'bg-white/20 text-white' : 'bg-apple-bgSecondary text-apple-textSecondary'
                        }`}
                      >
                        {item.category}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 opacity-75" />
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
