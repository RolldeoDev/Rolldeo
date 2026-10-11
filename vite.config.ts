import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'favicon-16x16.png', 'favicon-32x32.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'Rolldeo - Share the Perfect Random Table',
        short_name: 'Rolldeo',
        description: 'Share the perfect random table. Create, share, and roll on random tables with fellow GMs.',
        theme_color: '#1a1a2e',
        background_color: '#1a1a2e',
        display: 'standalone',
        icons: [
          {
            src: 'android-chrome-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'android-chrome-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'android-chrome-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json,zip,woff,woff2,ttf}'],
        // The locally bundled editor and language worker exceed Workbox's 2 MiB default.
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        navigateFallback: 'index.html',
        // Match application routes explicitly: collection/item IDs can contain dots.
        // Workbox matches pathname + query; ?kind=template must keep working offline.
        // Downloads and unknown asset URLs must never receive the HTML app shell.
        navigateFallbackAllowlist: [
          /^\/(?:\?.*)?$/,
          /^\/library\/?(?:\?.*)?$/,
          /^\/roll(?:\/[^/?]+\/[^/?]+)?\/?(?:\?.*)?$/,
          /^\/editor(?:\/[^/?]+)?\/?(?:\?.*)?$/,
          /^\/guide(?:\/(?:quickstart|spec|schema|using-rolldeo))?\/?(?:\?.*)?$/,
        ],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-font-files',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 365
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      '@': '/src'
    }
  }
})
