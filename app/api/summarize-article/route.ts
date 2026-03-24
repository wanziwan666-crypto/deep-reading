import { NextRequest } from "next/server"
import { completeWithSchema, validateArticleSummary } from "../../../lib/structured"
import { articleSummarySystem, articleSummaryUser } from "../../../lib/prompts/articleSummary"
import type { Message } from "../../../lib/llmClient"

function stripHtml(html: string): { text: string; title: string } {
  let t = html || ""
  const titleMatch = t.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  const title = titleMatch ? titleMatch[1].trim() : ""
  t = t.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
  t = t.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
  t = t.replace(/<[^>]+>/g, " ")
  t = t.replace(/\s+/g, " ").trim()
  return { text: t, title }
}

export async function POST(req: NextRequest) {
  const { url } = await req.json()
  if (!url || typeof url !== "string") {
    return new Response(JSON.stringify({ error: "invalid_url" }), { status: 400 })
  }
  let html = ""
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0 Safari/537.36",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8"
      }
    })
    if (!res.ok) {
      return new Response(JSON.stringify({ error: "fetch_failed", status: res.status }), { status: 502 })
    }
    html = await res.text()
  } catch {
    return new Response(JSON.stringify({ error: "fetch_failed" }), { status: 502 })
  }
  const { text, title } = stripHtml(html)
  const article = text.slice(0, 12000)
  const verificationRe =
    /(人机验证|验证码|访问验证|安全验证|当前环境异常|完成验证|Cloudflare|Just a moment|Attention Required|Access Denied|verify you are human|captcha)/i
  if (!article || article.length < 200 || verificationRe.test(article)) {
    return Response.json({ error: "verification_required", title: title || "", article: "", articleSummary: "" })
  }
  let articleSummary = ""
  try {
    const msgs: Message[] = [{ role: "user", content: articleSummaryUser(article) }]
    const obj = await completeWithSchema(
      articleSummarySystem(),
      msgs,
      "article",
      validateArticleSummary,
      2
    )
    articleSummary = obj.article_summary
  } catch {
    articleSummary = "这是一篇较长的文章，建议结合标题与首段快速把握核心观点。"
  }
  return Response.json({ title, article, articleSummary })
}
