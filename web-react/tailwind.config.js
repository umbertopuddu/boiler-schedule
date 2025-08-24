/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Purdue Official Colors
        'purdue-gold': '#CFB991',
        'purdue-black': '#000000',
        'purdue-gray': '#6B7177',
        'purdue-white': '#FFFFFF',
        // Extended Purdue Palette
        'purdue': {
          gold: {
            light: '#E4D4B8',
            DEFAULT: '#CFB991',
            dark: '#A69574'
          },
          black: {
            DEFAULT: '#000000',
            soft: '#1A1A1A'
          },
          gray: {
            light: '#9FA2A6',
            DEFAULT: '#6B7177',
            dark: '#4A4E52'
          }
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Helvetica Neue', 'Arial', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-gold': 'pulseGold 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        pulseGold: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '.8', backgroundColor: '#CFB991' },
        }
      }
    },
  },
  plugins: [],
}