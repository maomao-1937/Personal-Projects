import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        canvas: '#F2F0EC',
        paper: '#FFFDF9',
        stage: '#0D0E11',
        ink: '#171612',
        muted: '#68645E',
        line: '#D9D5CE',
        brand: '#C84B31',
        signal: '#B33942',
        success: '#237659',
        bg: {
          primary: '#F2F0EC',
          secondary: '#FFFDF9',
          tertiary: '#E7E3DD',
        },
        accent: {
          DEFAULT: '#C84B31',
          light: '#E6785F',
          dark: '#A83D27',
        },
        text: {
          primary: '#171612',
          dim: '#68645E',
          muted: '#8B8E97',
        },
        border: {
          DEFAULT: '#D9D5CE',
          light: '#E7E3DD',
        },
      },
      fontFamily: {
        sans: ['PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'system-ui', 'sans-serif'],
        serif: ['PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'card': '0 20px 56px rgba(23, 22, 18, 0.12)',
      },
      animation: {
        'fade-in': 'fadeIn 0.6s ease forwards',
        'slide-up': 'slideUp 0.5s ease forwards',
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
