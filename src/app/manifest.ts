import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'FreshHaul',
    short_name: 'FreshHaul',
    description: 'Fresh produce marketplace for farmers, buyers, and refrigerated drivers.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f6f7f3',
    theme_color: '#059669',
    lang: 'en',
    orientation: 'portrait',
    icons: [
      {
        src: '/icons/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
