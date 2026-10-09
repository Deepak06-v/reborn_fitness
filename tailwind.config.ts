import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  safelist: ['panel-glass', 'hairline', 'glow-cyan', 'glow-lime', 'telemetry-dot'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        canvas: 'rgb(var(--color-canvas) / <alpha-value>)',
        surface: 'rgb(var(--color-surface) / <alpha-value>)',
        card: 'rgb(var(--color-card) / <alpha-value>)',
        'card-alt': 'rgb(var(--color-card-alt) / <alpha-value>)',
        hairline: 'rgb(var(--color-hairline) / <alpha-value>)',
        accent: 'rgb(var(--color-accent) / <alpha-value>)',
        lime: 'rgb(var(--color-lime) / <alpha-value>)',
        white: 'rgb(var(--color-white) / <alpha-value>)',
        muted: 'rgb(var(--color-muted) / <alpha-value>)',
        dim: 'rgb(var(--color-dim) / <alpha-value>)',
      },
      boxShadow: {
        glow: '0 0 24px -4px rgb(var(--color-accent) / 0.25)',
        'glow-lime': '0 0 24px -4px rgb(var(--color-lime) / 0.25)',
        'glow-sm': '0 0 16px -6px rgb(var(--color-accent) / 0.35)',
        lift: '0 18px 40px -24px rgb(0 0 0 / 0.9)',
      },
      transitionTimingFunction: {
        'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      keyframes: {
        'dot-pulse': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.45', transform: 'scale(0.82)' },
        },
        'scan-line': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(400%)' },
        },
        marquee: {
          '0%': { transform: 'translate3d(0, 0, 0)' },
          '100%': { transform: 'translate3d(-50%, 0, 0)' },
        },
        'marquee-reverse': {
          '0%': { transform: 'translate3d(-50%, 0, 0)' },
          '100%': { transform: 'translate3d(0, 0, 0)' },
        },
      },
      animation: {
        'dot-pulse': 'dot-pulse 1.6s ease-in-out infinite',
        'scan-line': 'scan-line 2.4s linear infinite',
        marquee: 'marquee 90s linear infinite',
        'marquee-reverse': 'marquee-reverse 110s linear infinite',
      },
    },
  },
  plugins: [],
}

export default config