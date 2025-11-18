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
    },
  },
  plugins: [],
};

export default config;
