import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'

import { AuthProvider } from '@/features/prism/contexts/auth-context'
import { AuthRouteGuard } from '@/components/auth-route-guard'
import './globals.css'

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: 'PRism — AI 智能代码评审平台',
  description: '企业级 AI 合并请求智能评审平台，深度代码安全分析、风险评估与架构洞察',
  generator: 'PRism',
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
