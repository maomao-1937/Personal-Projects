import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: '#0a0a0f',
          secondary: '#12121a',
          tertiary: '#1a1a26',
        },
        accent: {
          DEFAULT: '#6366f1',
          light: '#818cf8',
          dark: '#4f46e5',
          glow: 'rgba(99, 102, 241, 0.15)',
        },
        gold: '#fbbf24',
        text: {
          primary: '#e8e8f0',
          dim: '#8888a0',
          muted: '#5a5a72',
        },
        border: {
          DEFAULT: '#2a2a3a',
          light: '#3a3a4a',
        },
        /**
         * 风格颜色 - 与 src/config/styles.ts 保持一致
         * 用于需要直接使用颜色值的场景（如内联样式、CSS 变量等）
         */
        styleColors: {
          guofeng: {
            primary: '#b45309',
            secondary: '#7f1d1d',
            bg: '#451a03',
          },
          zhichang: {
            primary: '#2563eb',
            secondary: '#1e293b',
            bg: '#0f172a',
          },
          hunsha: {
            primary: '#f472b6',
            secondary: '#7c3aed',
            bg: '#fdf2f8',
          },
          rixi: {
            primary: '#fda4af',
            secondary: '#0ea5e9',
            bg: '#fff1f2',
          },
          chaoku: {
            primary: '#06b6d4',
            secondary: '#d946ef',
            bg: '#083344',
          },
          fugu: {
            primary: '#f97316',
            secondary: '#92400e',
            bg: '#431407',
          },
          yishu: {
            primary: '#ca8a04',
            secondary: '#44403c',
            bg: '#1c1917',
          },
          xianxia: {
            primary: '#22d3ee',
            secondary: '#14b8a6',
            bg: '#042f2e',
          },
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'PingFang SC', 'Microsoft YaHei', 'sans-serif'],
        serif: ['Noto Serif SC', 'serif'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        'glow': '0 0 20px rgba(99, 102, 241, 0.15)',
        'glow-lg': '0 0 40px rgba(99, 102, 241, 0.3)',
        'card': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
      },
      animation: {
        'fade-in': 'fadeIn 0.6s ease forwards',
        'slide-up': 'slideUp 0.5s ease forwards',
        'glow': 'glow 3s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'spin-slow': 'spin 3s linear infinite',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        glow: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(99, 102, 241, 0.15)' },
          '50%': { boxShadow: '0 0 40px rgba(99, 102, 241, 0.35)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
