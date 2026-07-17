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
        seo: {
          page: '#eef4fb',
          surface: '#ffffff',
          inset: '#f8fafc',
          deep: '#0f172a',
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
        },
        gradientMove: {
          '0%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
          '100%': { backgroundPosition: '0% 50%' },
        },
        scrollBrands: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
      animation: {
        'fade-in-up': 'fadeInUp 0.8s ease-out forwards',
        'fade-in-up-delay-100': 'fadeInUp 0.8s ease-out 0.1s forwards',
        'fade-in-up-delay-200': 'fadeInUp 0.8s ease-out 0.2s forwards',
        'fade-in-up-delay-300': 'fadeInUp 0.8s ease-out 0.3s forwards',
        'fade-in-up-delay-400': 'fadeInUp 0.8s ease-out 0.4s forwards',
        'fade-in-up-delay-500': 'fadeInUp 0.8s ease-out 0.5s forwards',
        'bounce-slow': 'bounceSlow 3s infinite',
        'gradient-move': 'gradientMove 12s ease infinite',
        'scroll-brands': 'scrollBrands 25s linear infinite',
      },
    },
  },
  plugins: [],
};

export default config;
