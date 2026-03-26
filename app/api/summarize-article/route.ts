import { NextRequest } from "next/server"
import { completeWithSchema, validateArticleSummary } from "../../../lib/structured"
import { articleSummarySystem, articleSummaryUser } from "../../../lib/prompts/articleSummary"
import type { Message } from "../../../lib/llmClient"

function textOnly(html: string): string {
  let t = html || ""
  t = t.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
  t = t.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
  t = t.replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, "")
  t = t.replace(/<[^>]+>/g, " ")
  t = t.replace(/\s+/g, " ").trim()
  return t
}

function extractMainBlock(html: string): string {
  const blocks: string[] = []
  const articleRe = /<article\b[^>]*>([\s\S]*?)<\/article>/gi
  let m: RegExpExecArray | null
  while ((m = articleRe.exec(html))) blocks.push(m[1])
  const divRe = /<div\b[^>]*(?:id|class)=["'][^"']*(?:article|content|post|entry|main|read|text)[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi
  while ((m = divRe.exec(html))) blocks.push(m[1])
  if (blocks.length > 0) {
    return blocks.sort((a, b) => a.length - b.length).pop() || ""
  }
  return html
}

function extractTitleCandidates(html: string): string[] {
  const cands: string[] = []
  const meta = (name: string, attr = "property") => {
    const re = new RegExp(`<meta[^>]+${attr}=["']${name}["'][^>]*content=["']([^"']+)["']`, "i")
    const m = html.match(re)
    if (m && m[1]) cands.push(m[1].trim())
  }
  meta("og:title")
  meta("twitter:title", "name")
  // title tag
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  if (titleMatch && titleMatch[1]) cands.push(titleMatch[1].trim())
  // first h1 in main block
  const main = extractMainBlock(html)
  const h1 = main.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)
  if (h1 && h1[1]) cands.unshift(textOnly(h1[1]).trim())
  return cands.filter(Boolean)
}

function normalizeTitle(t: string): string {
  if (!t) return ""
  // split by common separators and prefer the first segment
  const parts = t.split(/\s*[|｜\-–—·:_]\s*/).filter(Boolean)
  const first = parts.length > 0 ? parts[0] : t
  return first.trim()
}

function isInterstitialTitle(t: string): boolean {
  return /(Just a moment|Access Denied|verify you are human|验证码|人机验证|安全验证|Cloudflare|处理中|访问验证)/i.test(t)
}

function pickBestTitle(html: string): string {
  const cands = extractTitleCandidates(html).map(normalizeTitle).filter((s) => s && s.length >= 2)
  for (const c of cands) {
    if (!isInterstitialTitle(c)) return c
  }
  return cands[0] || ""
}

function stripHtml(html: string): { text: string; title: string } {
  let t = html || ""
  const title = pickBestTitle(t)
  // remove scripts/styles
  t = t.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
  t = t.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
  // try to extract main content blocks first
  const blocks: string[] = []
  const articleRe = /<article\b[^>]*>([\s\S]*?)<\/article>/gi
  let m: RegExpExecArray | null
  while ((m = articleRe.exec(t))) blocks.push(m[1])
  const divRe = /<div\b[^>]*(?:id|class)=["'][^"']*(?:article|content|post|entry|main|read|text)[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi
  while ((m = divRe.exec(t))) blocks.push(m[1])
  let body = ""
  if (blocks.length > 0) {
    body = blocks.sort((a, b) => a.length - b.length).pop() || ""
  }
  // fallback to entire document if no block extracted
  let raw = body || t
  raw = raw.replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, "")
  raw = raw.replace(/<[^>]+>/g, " ")
  raw = raw.replace(/\s+/g, " ").trim()
  return { text: raw, title }
}

function sanitizeSummary(t: string): string {
  return String(t || "")
    .replace(/(^|\n)\s*核心论点(是)?[:：]\s*/g, "$1")
    .trim()
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
  const article = text.slice(0, 16000)
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
  return Response.json({ title, article, articleSummary: sanitizeSummary(articleSummary) })
}
