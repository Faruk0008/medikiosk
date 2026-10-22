/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Display"',
          '"SF Pro Text"',
          '"Inter Variable"',
          '"Inter"',
          'system-ui',
          'sans-serif'
        ],
        mono: [
          '"SF Mono"',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'Consolas',
          'monospace'
        ]
      },
      colors: {
        apple: {
          bg: 'var(--bg-primary)',
          bgSecondary: 'var(--bg-secondary)',
          surface: 'var(--surface-primary)',
          surfaceElevated: 'var(--surface-elevated)',
          text: 'var(--text-primary)',
          textSecondary: 'var(--text-secondary)',
          border: 'var(--border-hairline)',
          accent: '#0071e3',
          accentHover: '#0077ed',
          danger: '#ff3b30',
          success: '#34c759',
          warning: '#ff9f0a'
        }
      },
      maxWidth: {
        apple: '1080px'
      },
      borderRadius: {
        card: '24px',
        cardLg: '28px',
        pill: '9999px'
      },
      boxShadow: {
        apple: '0 4px 24px -4px rgba(0, 0, 0, 0.06), 0 1px 2px 0 rgba(0, 0, 0, 0.03)',
        appleHover: '0 12px 36px -6px rgba(0, 0, 0, 0.10), 0 2px 6px 0 rgba(0, 0, 0, 0.04)',
        appleModal: '0 24px 64px -12px rgba(0, 0, 0, 0.24)'
      },
      letterSpacing: {
        tightHero: '-0.03em',
        tightHeading: '-0.02em'
      }
    }
  },
  plugins: []
};
