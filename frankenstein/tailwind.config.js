/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {
      colors: {
        "primary": "#e0aaff",
        "secondary": "#c77dff",
        "accent": "#9d4edd",
        "accent-dark": "#7b2cbf",
        "accent-darker": "#5a189a",
        "background": "#0a0a0f",
        "surface": "#12121a",
        "surface-light": "#1a1a25",
        "light-primary": "rgb(var(--color-light-primary) / <alpha-value>)",
        "light-secondary": "rgb(var(--color-light-secondary) / <alpha-value>)",
        "light-accent": "rgb(var(--color-light-accent) / <alpha-value>)",
        "light-background": "rgb(var(--color-light-background) / <alpha-value>)",
        "light-surface": "rgb(var(--color-light-surface) / <alpha-value>)",
        "light-surface-hover": "rgb(var(--color-light-surface-hover) / <alpha-value>)",
        "light-text": "rgb(var(--color-light-text) / <alpha-value>)",
        "light-text-muted": "rgb(var(--color-light-text-muted) / <alpha-value>)",
        "light-border": "rgb(var(--color-light-border) / <alpha-value>)",
      },
      fontFamily: {
        "display": ["Space Grotesk", "sans-serif"]
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
  ],
}
