import "./globals.css"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "深度阅读 - 批判性思维训练",
  description: "通过 AI 引导的对话，深入思考你读过的文章"
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body suppressHydrationWarning>{children}</body>
    </html>
  )
}
