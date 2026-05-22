import type { Metadata } from 'next';
import './globals.css';

const SITE_URL = 'https://page-dep-map.vercel.app';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'page-dep-map · React page dependency analyzer with live inspect',
    template: '%s · page-dep-map',
  },
  description:
    'Statically analyze React/Next.js pages, score complexity, surface risky pages, and highlight any component live on the running app. Open-source CLI + dashboard.',
  keywords: [
    'react',
    'nextjs',
    'static analysis',
    'page dependency',
    'component inspector',
    'refactoring',
    'code review',
  ],
  authors: [{ name: 'Jinseop Shin', url: 'https://github.com/yeo11200' }],
  openGraph: {
    type: 'website',
    url: SITE_URL,
    title: 'page-dep-map · React page dependency analyzer',
    description:
      'Find risky pages, drilled props, and bloated component trees — then highlight the offender live on the running app.',
    images: ['/images/dashboard-overview.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'page-dep-map',
    description:
      'React page dependency analyzer with live component inspect.',
    images: ['/images/dashboard-overview.png'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#050505] text-white antialiased">{children}</body>
    </html>
  );
}
