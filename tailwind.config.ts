import type { Config } from 'tailwindcss';
import tailwindcssAnimate from 'tailwindcss-animate';

export default {
  darkMode: ['class'],
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      colors: {
        // Wrapped as rgb(var(--x) / <alpha-value>) so opacity modifiers (bg-primary/10, ...) work
        // — see the comment above the token declarations in globals.css. border/input/sidebar-border
        // are the exception: they're read as plain var() because dark mode bakes their own alpha in.
        background: 'rgb(var(--background) / <alpha-value>)',
        foreground: 'rgb(var(--foreground) / <alpha-value>)',
        card: { DEFAULT: 'rgb(var(--card) / <alpha-value>)', foreground: 'rgb(var(--card-foreground) / <alpha-value>)' },
        popover: { DEFAULT: 'rgb(var(--popover) / <alpha-value>)', foreground: 'rgb(var(--popover-foreground) / <alpha-value>)' },
        primary: { DEFAULT: 'rgb(var(--primary) / <alpha-value>)', foreground: 'rgb(var(--primary-foreground) / <alpha-value>)' },
        secondary: { DEFAULT: 'rgb(var(--secondary) / <alpha-value>)', foreground: 'rgb(var(--secondary-foreground) / <alpha-value>)' },
        muted: { DEFAULT: 'rgb(var(--muted) / <alpha-value>)', foreground: 'rgb(var(--muted-foreground) / <alpha-value>)' },
        accent: { DEFAULT: 'rgb(var(--accent) / <alpha-value>)', foreground: 'rgb(var(--accent-foreground) / <alpha-value>)' },
        destructive: { DEFAULT: 'rgb(var(--destructive) / <alpha-value>)', foreground: 'rgb(var(--destructive-foreground) / <alpha-value>)' },
        border: 'var(--border)',
        input: 'var(--input)',
        ring: 'rgb(var(--ring) / <alpha-value>)',
        chart: {
          '1': 'rgb(var(--chart-1) / <alpha-value>)', '2': 'rgb(var(--chart-2) / <alpha-value>)', '3': 'rgb(var(--chart-3) / <alpha-value>)', '4': 'rgb(var(--chart-4) / <alpha-value>)', '5': 'rgb(var(--chart-5) / <alpha-value>)',
        },
        sidebar: {
          DEFAULT: 'rgb(var(--sidebar) / <alpha-value>)', foreground: 'rgb(var(--sidebar-foreground) / <alpha-value>)', primary: 'rgb(var(--sidebar-primary) / <alpha-value>)',
          'primary-foreground': 'rgb(var(--sidebar-primary-foreground) / <alpha-value>)', accent: 'rgb(var(--sidebar-accent) / <alpha-value>)',
          'accent-foreground': 'rgb(var(--sidebar-accent-foreground) / <alpha-value>)', border: 'var(--sidebar-border)', ring: 'rgb(var(--sidebar-ring) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        heading: ['var(--font-heading)', 'var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        tactile: '3px 3px 0px 0px var(--shadow-tactile-color)',
        'tactile-accent': '3px 3px 0px 0px var(--shadow-tactile-accent-color)',
        // Phase 43: "keycap" press for tactile buttons — lifted on hover, pressed flat on click.
        'tactile-lift': '4px 4px 0px 0px var(--shadow-tactile-color)',
        'tactile-press': '1px 1px 0px 0px var(--shadow-tactile-color)',
        'tactile-accent-lift': '4px 4px 0px 0px var(--shadow-tactile-accent-color)',
        'tactile-accent-press': '1px 1px 0px 0px var(--shadow-tactile-accent-color)',
      },
      // Phase 43 (docs/exec-plans/active/phase-43-storefront-motion.md). Every use is gated with
      // `motion-safe:`; globals.css also shortens all animations under prefers-reduced-motion.
      keyframes: {
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        // SVG path with pathLength="1" + stroke-dasharray 1: 1 = hidden, 0 = fully drawn.
        'draw-line': { from: { strokeDashoffset: '1' }, to: { strokeDashoffset: '0' } },
        'badge-pop': { '0%': { transform: 'scale(1)' }, '40%': { transform: 'scale(1.25)' }, '100%': { transform: 'scale(1)' } },
        'soft-ping': { '0%': { transform: 'scale(1)', opacity: '0.45' }, '70%, 100%': { transform: 'scale(1.45)', opacity: '0' } },
        // Ends on `transform: none` so a finished page never keeps a containing block for fixed children.
        'page-enter': { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'none' } },
      },
      animation: {
        shimmer: 'shimmer 1.6s ease-in-out infinite',
        'draw-line': 'draw-line 1.1s cubic-bezier(0.65, 0, 0.35, 1) 0.2s both',
        'badge-pop': 'badge-pop 320ms ease-out',
        'soft-ping': 'soft-ping 2.4s cubic-bezier(0, 0, 0.2, 1) infinite',
        'page-enter': 'page-enter 220ms ease-out both',
      },
      transitionTimingFunction: {
        // iOS sheet curve — the panel/drawer curve fixed by the ui-ux skill (500ms in, 350ms out).
        sheet: 'cubic-bezier(0.32, 0.72, 0, 1)',
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config;
