export default function manifest() {
  return {
    id: '/',
    name: 'ScopeCheck',
    short_name: 'ScopeCheck',
    description: 'Review requests and manage project scope changes.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#f2f5fc',
    theme_color: '#183bbc',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
