import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { BrandingProvider } from '@/contexts/BrandingContext'
import { ToastProvider } from '@/components/ui/ToastProvider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'EduSmart - College Management System',
  description: 'A comprehensive college management system',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className={inter.className} suppressHydrationWarning>
        <ThemeProvider>
          <BrandingProvider>
            <ToastProvider>
              {children}
            </ToastProvider>
          </BrandingProvider>
        </ThemeProvider>
      </body>
    </html>
  )
} 