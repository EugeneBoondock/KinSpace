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
        'brand-primary': '#2A4A42',
        'brand-background': '#eedfc8',
        'brand-accent1': '#B85C3A',
        'brand-accent2': '#D19A58',
        'brand-accent3': '#6B8A83',
        'brand-dark': '#1a3029',
      },
      fontFamily: {
        sans: ['var(--font-manrope)', 'var(--font-noto-sans)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/container-queries'),
  ],
};

export default config;
