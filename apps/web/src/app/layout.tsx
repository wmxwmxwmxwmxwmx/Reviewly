import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'

import { AuthProvider } from '@/features/prism/contexts/auth-context'
import { AuthRouteGuard } from '@/components/auth-route-guard'
import './globals.css'

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: 'PRism — 企业级代码评审平台',
  description: '企业级 Pull Request 代码评审平台，质量分析、风险治理与团队协作',
  generator: 'PRism',
}

export const viewport: Viewport = {
  themeColor: '#09090B',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh" className={`${inter.variable} bg-background`}>
      <body className="font-sans antialiased">
        <AuthProvider>
          <AuthRouteGuard>{children}</AuthRouteGuard>
        </AuthProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
