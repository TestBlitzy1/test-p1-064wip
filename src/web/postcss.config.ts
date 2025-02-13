import type { Config } from 'postcss'; // ^8.4.0
import tailwindcss from 'tailwindcss'; // ^3.3.0
import autoprefixer from 'autoprefixer'; // ^10.4.0
import cssnano from 'cssnano'; // ^6.0.0

const config: Config = {
  plugins: [
    // Tailwind CSS configuration for utility-first styling
    tailwindcss({
      content: ['./src/**/*.{ts,tsx}'],
      theme: {
        extend: {
          screens: {
            // Responsive breakpoints aligned with design specifications
            mobile: '320px',
            tablet: '768px',
            desktop: '1200px',
          },
        },
      },
    }),

    // Autoprefixer for cross-browser compatibility
    autoprefixer({
      flexbox: 'no-2009',
      grid: 'autoplace',
      browsers: [
        'last 2 versions',
        '> 1%',
        'not dead'
      ]
    }),

    // CSS optimization for production builds
    cssnano({
      preset: [
        'default',
        {
          discardComments: {
            removeAll: true
          },
          normalizeWhitespace: true,
          minifyFontValues: true,
          colormin: true,
          reduceIdents: true,
          mergeLonghand: true,
          mergeRules: true
        }
      ]
    })
  ]
};

export default config;