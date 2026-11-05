import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { X } from 'lucide-react';

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  disabled = false,
  type = 'button',
  onClick,
  ...rest
}) {
  const variants = {
    primary: 'bg-[#0071e3] hover:bg-[#0077ed] text-white shadow-sm',
    secondary: 'bg-apple-bgSecondary hover:opacity-90 text-apple-text hairline-border',
    danger: 'bg-[#ff3b30] hover:opacity-95 text-white',
    ghost: 'bg-transparent hover:bg-apple-bgSecondary text-apple-text'
  };
  const sizes = {
    sm: 'h-9 min-h-[36px] px-3.5 text-xs font-medium',
    md: 'h-11 min-h-[44px] px-5 sm:px-6 text-sm font-medium',
    lg: 'h-12 min-h-[48px] px-6 sm:px-8 text-base font-medium'
  };

  return (
    <motion.button
      whileTap={disabled ? undefined : { scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-full transition-colors select-none disabled:opacity-40 disabled:pointer-events-none touch-manipulation',
        variants[variant] || variants.primary,
        sizes[size] || sizes.md,
        className
      )}
      {...rest}
    >
      {children}
    </motion.button>
  );
}

export function Card({ children, className = '', elevated = false, ...rest }) {
  return (
    <div
      className={clsx(
        'rounded-[20px] sm:rounded-[24px] hairline-border shadow-apple transition-shadow',
        elevated ? 'bg-apple-surfaceElevated' : 'bg-apple-surface',
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function Segmented({ options = [], value, onChange, className = '', idPrefix = 'seg' }) {
  return (
    <div
      role="tablist"
      className={clsx(
        'inline-flex items-center p-1 rounded-full bg-apple-bgSecondary hairline-border max-w-full overflow-x-auto no-scrollbar',
        className
      )}
    >
      {options.map(opt => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={clsx(
              'relative min-h-[36px] px-3 sm:px-4 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-colors z-10 shrink-0 whitespace-nowrap',
              active ? 'text-apple-text' : 'text-apple-textSecondary hover:text-apple-text'
            )}
          >
            {active && (
              <motion.span
                layoutId={`${idPrefix}_pill`}
                transition={{ type: 'spring', stiffness: 450, damping: 34 }}
                className="absolute inset-0 rounded-full bg-apple-surface shadow-sm hairline-border -z-10"
              />
            )}
            <span className="inline-flex items-center gap-1.5">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function Chip({ children, active = false, onClick, className = '' }) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      type="button"
      onClick={onClick}
      className={clsx(
        'min-h-[38px] px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium transition-all hairline-border touch-manipulation',
        active
          ? 'bg-[#0071e3] text-white border-[#0071e3]'
          : 'bg-apple-surface hover:bg-apple-bgSecondary text-apple-text',
        className
      )}
    >
      {children}
    </motion.button>
  );
}

export function Toggle({ checked, onChange, label, description, disabled = false }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 sm:py-3">
      <div className="space-y-0.5 sm:space-y-1">
        {label && <p className="text-sm sm:text-base font-semibold text-apple-text">{label}</p>}
        {description && <p className="text-xs sm:text-sm text-apple-textSecondary max-w-xl">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={clsx(
          'relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full p-0.5 transition-colors duration-200 ease-in-out disabled:opacity-40 touch-manipulation',
          checked ? 'bg-[#34c759]' : 'bg-[#d2d2d7] dark:bg-[#38383a]'
        )}
      >
        <motion.span
          animate={{ x: checked ? 20 : 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 32 }}
          className="inline-block h-6 w-6 rounded-full bg-white shadow-md pointer-events-none"
        />
      </button>
    </div>
  );
}

export function Input({
  label,
  value,
  onChange,
  type = 'text',
  error = '',
  className = '',
  required = false,
  ...rest
}) {
  const [focused, setFocused] = useState(false);
  const floated = focused || (value !== undefined && value !== null && String(value).length > 0);

  return (
    <div className={clsx('w-full', className)}>
      <div
        className={clsx(
          'relative rounded-[16px] bg-apple-surface hairline-border px-4 pt-5 pb-2 transition-all min-h-[52px]',
          focused && 'ring-2 ring-[#0071e3] border-transparent',
          error && 'border-[#ff3b30] ring-1 ring-[#ff3b30]'
        )}
      >
        {label && (
          <label
            className={clsx(
              'pointer-events-none absolute left-4 transition-all duration-150 select-none',
              floated
                ? 'top-1.5 text-[11px] font-medium text-apple-textSecondary'
                : 'top-3.5 text-sm sm:text-base text-apple-textSecondary'
            )}
          >
            {label}
          </label>
        )}
        <input
          type={type}
          value={value}
          onChange={onChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          required={required}
          className="w-full bg-transparent text-[16px] sm:text-base text-apple-text focus:outline-none"
          {...rest}
        />
      </div>
      {error && <p className="mt-1.5 text-xs text-[#ff3b30] font-medium">{error}</p>}
    </div>
  );
}

export function Skeleton({ className = '' }) {
  return (
    <div
      className={clsx(
        'animate-pulse rounded-[18px] bg-[#e8e8ed] dark:bg-[#2c2c2e]',
        className
      )}
    />
  );
}

export function Sheet({ open, onClose, title, children }) {
  useEffect(() => {
    if (!open) return;
    const onKey = e => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end max-sm:items-end">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ x: '100%', y: 0 }}
            animate={{ x: 0, y: 0 }}
            exit={{ x: '100%', y: 0 }}
            transition={{ type: 'spring', stiffness: 360, damping: 34 }}
            className="relative z-10 w-full max-w-lg bg-apple-surface h-full max-sm:h-auto max-sm:max-h-[88vh] max-sm:rounded-t-[28px] max-sm:rounded-b-none shadow-appleModal hairline-border p-5 sm:p-6 overflow-y-auto flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between pb-4 hairline-b">
                <h3 className="text-base sm:text-lg font-semibold tracking-tightHeading text-apple-text">{title}</h3>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close panel"
                  className="p-2 min-h-[44px] min-w-[44px] rounded-full hover:bg-apple-bgSecondary text-apple-textSecondary flex items-center justify-center"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="mt-5">{children}</div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export function Modal({ open, onClose, title, children }) {
  useEffect(() => {
    if (!open) return;
    const onKey = e => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 max-sm:items-end">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ type: 'spring', stiffness: 420, damping: 30 }}
            className="relative z-10 w-full max-w-xl rounded-[24px] sm:rounded-[28px] max-sm:rounded-b-none bg-apple-surface hairline-border shadow-appleModal p-5 sm:p-8 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between pb-3.5 sm:pb-4 hairline-b">
              <h3 className="text-base sm:text-lg font-semibold tracking-tightHeading text-apple-text">{title}</h3>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close modal"
                className="p-1.5 min-h-[44px] min-w-[44px] rounded-full hover:bg-apple-bgSecondary text-apple-textSecondary flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="mt-4 sm:mt-5">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export function AnimatedNumber({ value = 0, suffix = '', decimals = 0 }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const target = Number(value) || 0;
    const duration = 650;
    const startTime = performance.now();

    let raf;
    const step = now => {
      const progress = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(target * eased);
      if (progress < 1) {
        raf = requestAnimationFrame(step);
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return (
    <span>
      {Number(display).toFixed(decimals)}
      {suffix}
    </span>
  );
}
