import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          my: '#023D95',
          fng: '#0088E8',
          primary: '#0088E8',
          'primary-hover': '#0367C4',
          secondary: '#023D95',
        },
        background: {
          white: '#FFFFFF',
          grey: '#F5F7FA',
        },
        text: {
          heading: '#023D95',
          body: '#3A3F45',
          link: '#0088E8',
        },
      },
      fontFamily: {
        poppins: ['Poppins', 'sans-serif'],
      },
      keyframes: {
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        bounceSlow: {
          '0%, 100%': { transform: 'translateY(-5%)' },
          '50%': { transform: 'translateY(0)' },
        }
      },
      animation: {
        'fade-in-up': 'fadeInUp 0.8s ease-out forwards',
        'bounce-slow': 'bounceSlow 3s infinite',
      },
    },
  },
  plugins: [],
};

export default config;
