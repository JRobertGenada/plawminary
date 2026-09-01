/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        g: {
          primary: '#1F6F3D',
          dark:    '#0F4F2C',
          deep:    '#0A3820',
          light:   '#2A8F52',
          pale:    '#E8F5EE',
        },
        gold: {
          DEFAULT: '#F4C542',
          dark:    '#D4A82A',
          light:   '#FBE08A',
        },
      },
      fontFamily: {
        display: ['"DM Serif Display"', 'serif'],
        body:    ['"Plus Jakarta Sans"', 'sans-serif'],
      },
      borderRadius: {
        sm: '8px',
        md: '14px',
        lg: '22px',
        xl: '32px',
      },
      boxShadow: {
        sm: '0 1px 4px rgba(0,0,0,.08)',
        md: '0 4px 16px rgba(0,0,0,.12)',
        lg: '0 12px 40px rgba(0,0,0,.15)',
      },
    },
  },
  plugins: [],
}
