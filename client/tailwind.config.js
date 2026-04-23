/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Brand colors
        brand: {
          DEFAULT: '#534AB7',
          light: '#EEEDFE',
          mid: '#AFA9EC',
          dark: '#3C3489',
        },
        // Status colors
        status: {
          teal: {
            bg: '#E1F5EE',
            text: '#085041',
          },
          amber: {
            bg: '#FAEEDA',
            text: '#633806',
          },
          coral: {
            bg: '#FAECE7',
            text: '#993C1D',
          },
          gray: {
            bg: '#F1EFE8',
            text: '#5F5E5A',
          },
        },
      },
      fontFamily: {
        sans: ['Pretendard Variable', 'Pretendard', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'Roboto', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['10px', '14px'],
      },
      borderRadius: {
        'xl': '12px',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.2s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
