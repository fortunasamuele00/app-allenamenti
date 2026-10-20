import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// base relativa: la stessa build funziona in locale e su GitHub Pages sotto /app-allenamenti/.
export default defineConfig({
  base: './',
  // Anche iPhone con iOS non aggiornatissimo: sintassi compatibile con Safari 15.
  build: { target: ['es2020', 'safari15'] },
  server: { allowedHosts: true },
  preview: { allowedHosts: true },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Allenamenti',
        short_name: 'Allenamenti',
        description: 'Programma, sedute e progressione del mesociclo attivo.',
        lang: 'it',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#ECEDF0',
        theme_color: '#ECEDF0',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // I font restano disponibili offline dopo la prima apertura. Le chiamate a GitHub non passano dalla cache.
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\//,
            handler: 'CacheFirst',
            options: { cacheName: 'font', expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
        ],
      },
    }),
  ],
});
