// Tailwind CSS v4 is configured entirely via `@theme` in globals.css.
// The PostCSS plugin is the only build wiring needed — no tailwind.config.js.
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}

export default config
