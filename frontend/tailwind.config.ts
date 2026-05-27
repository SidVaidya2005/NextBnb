import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        rausch: {
          DEFAULT: '#ff385c',
          active: '#e00b41',
          disabled: '#ffd1da',
        },
        ink: {
          DEFAULT: '#222222',
          body: '#3f3f3f',
          muted: '#6a6a6a',
          'muted-soft': '#929292',
          'on-primary': '#ffffff',
        },
        surface: {
          canvas: '#ffffff',
          soft: '#f7f7f7',
          strong: '#f2f2f2',
        },
        hairline: {
          DEFAULT: '#dddddd',
          soft: '#ebebeb',
          strong: '#c1c1c1',
        },
        error: {
          DEFAULT: '#c13515',
          hover: '#b32505',
        },
        'legal-link': '#428bff',
        luxe: '#460479',
        plus: '#92174d',
      },
      borderRadius: {
        sm: '8px',
        md: '14px',
        xl: '32px',
        full: '9999px',
      },
      spacing: {
        xxs: '2px',
        xs: '4px',
        sm: '8px',
        md: '12px',
        base: '16px',
        lg: '24px',
        xl: '32px',
        xxl: '48px',
        section: '64px',
      },
      fontFamily: {
        sans: [
          '"Airbnb Cereal VF"',
          'Circular',
          'Inter',
          '-apple-system',
          'system-ui',
          'Roboto',
          '"Helvetica Neue"',
          'sans-serif',
        ],
      },
      boxShadow: {
        card: 'rgba(0,0,0,0.02) 0 0 0 1px, rgba(0,0,0,0.04) 0 2px 6px 0, rgba(0,0,0,0.1) 0 4px 8px 0',
      },
    },
  },
  plugins: [],
};

export default config;
