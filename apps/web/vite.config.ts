import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  server: {
    proxy: {
      '/api': { target: 'http://127.0.0.1:3000' },
    },
  },
  plugins: [react(), VitePWA({
    registerType: 'prompt',
    injectRegister: false,
    manifest: {
      id: '/',
      name: 'purrRoute',
      short_name: 'purrRoute',
      description: 'I tuoi viaggi, con te.',
      lang: 'it',
      start_url: '/trips',
      scope: '/',
      display: 'standalone',
      background_color: '#F5F3EF',
      theme_color: '#F5F3EF',
      icons: [
        { src: '/app-assets/app-192-rosso.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/app-assets/app-512-rosso.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/app-assets/maskable-rosso.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        { src: '/app-assets/monochrome-rosso.png', sizes: '512x512', type: 'image/png', purpose: 'monochrome' },
      ],
    },
    workbox: {
      cacheId: 'purrroute-shell',
      globPatterns: ['**/*.{js,css,html,ttf,png,webmanifest,txt}'],
      navigateFallback: '/index.html',
      navigateFallbackDenylist: [/^\/api(?:\/|$)/],
      cleanupOutdatedCaches: true,
      runtimeCaching: [{
        urlPattern: ({ url }) => url.origin === self.location.origin && url.pathname.startsWith('/api/maps/tiles/'),
        handler: 'CacheFirst',
        options: {
          cacheName: 'purrroute-map-tiles',
          expiration: { maxEntries: 3200, maxAgeSeconds: 30 * 24 * 60 * 60, purgeOnQuotaError: true },
          cacheableResponse: { statuses: [200] },
        },
      }],
    },
  })],
})
