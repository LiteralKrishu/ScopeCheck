import './globals.css';

export const metadata = {
  title: { default: 'ScopeCheck', template: '%s | ScopeCheck' },
  description: 'Review client requests against signed agreements and keep a record of every decision.',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/mark.svg', apple: '/icons/apple-touch-icon.png' },
  appleWebApp: { capable: true, title: 'ScopeCheck', statusBarStyle: 'default' },
};

export const viewport = { themeColor: '#183bbc' };

export default function RootLayout({ children }) {
  return <html lang="en"><body>{children}</body></html>;
}
