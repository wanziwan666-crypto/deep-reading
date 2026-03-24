import "./globals.css"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "思维训练 MVP",
  description: "LLM 思维训练"
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-gray-50">{children}</body>
    </html>
  )
}
