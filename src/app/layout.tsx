import type { Metadata } from 'next'
import './globals.css'
import ThemeProvider from '@/providers/ThemeProvider'
import { CarrinhoProvider } from '@/contexts/CarrinhoContext'
import PWAManager from '@/components/PWAManager'
import ManifestManager from '@/components/ManifestManager'
import { AppToaster } from '@/components/AppToaster'
import { geist } from '@/lib/fonts'

const URL_SITE = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

export const metadata: Metadata = {
  metadataBase: new URL(URL_SITE),
  title: 'Bar da Ladeira | Delivery',
  description: 'Cardápio digital e pedidos online do Bar da Ladeira.',
  keywords: 'bar da ladeira, delivery, cardápio, pedidos',
  authors: [{ name: 'Bar da Ladeira' }],
  creator: 'Bar da Ladeira',
  publisher: 'Bar da Ladeira',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    url: URL_SITE,
    siteName: 'Bar da Ladeira',
    title: 'Bar da Ladeira | Delivery',
    description: 'Peça pelo cardápio digital do Bar da Ladeira.',
    images: [
      {
        url: '/logo.webp',
        width: 512,
        height: 512,
        alt: 'Bar da Ladeira',
      },
    ],
  },
  twitter: {
    card: 'summary',
    title: 'Bar da Ladeira | Delivery',
    description: 'Peça pelo cardápio digital do Bar da Ladeira.',
    images: ['/logo.webp'],
  },
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
  },
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#0296F9' },
    { media: '(prefers-color-scheme: dark)', color: '#020817' },
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/assets/favicon/favicon.ico" />
        <link rel="apple-touch-icon" sizes="180x180" href="/assets/favicon/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/assets/favicon/favicon-16x16.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Bar da Ladeira" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className={`${geist.variable} ${geist.className} antialiased`}>
        <ThemeProvider>
          <CarrinhoProvider>
            <ManifestManager />
            <PWAManager />
            <AppToaster />
            {children}
          </CarrinhoProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
