import { NextRequest } from "next/server"

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

function toPlainText(html: string): string {
  let t = html || ""
  t = t.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
  t = t.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
  t = t.replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, "")
  t = t.replace(/<[^>]+>/g, " ")
  t = t.replace(/\s+/g, " ").trim()
  return t
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
  const t = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  if (t && t[1]) cands.push(t[1].trim())
  const main = extractMainBlock(html)
  const h1 = main.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)
  if (h1 && h1[1]) cands.unshift(toPlainText(h1[1]).trim())
  return cands.filter(Boolean)
}

function normalizeTitle(s: string): string {
  if (!s) return ""
  const parts = s.split(/\s*[|｜\-–—·:_]\s*/).filter(Boolean)
  return (parts[0] || s).trim()
}

function isInterstitialTitle(t: string): boolean {
  return /(Just a moment|Access Denied|verify you are human|验证码|人机验证|安全验证|Cloudflare|处理中|访问验证)/i.test(t)
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const url = searchParams.get("url") || ""
  if (!url) {
    return new Response(JSON.stringify({ error: "missing_url" }), { status: 400, headers: { "Content-Type": "application/json" } })
  }
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
      return new Response(JSON.stringify({ error: "upstream_failed", status: res.status }), { status: 502, headers: { "Content-Type": "application/json" } })
    }
    const html = await res.text()
    const titleCands = extractTitleCandidates(html).map(normalizeTitle)
    let title = ""
    for (const c of titleCands) {
      if (!isInterstitialTitle(c)) {
        title = c
        break
      }
    }
    if (!title) title = titleCands[0] || ""
    const main = extractMainBlock(html)
    const article = toPlainText(main).slice(0, 16000)
    if (!article || article.length < 50) {
      return new Response(JSON.stringify({ error: "extraction_failed" }), { status: 422, headers: { "Content-Type": "application/json" } })
    }
    return new Response(JSON.stringify({ article, title }), { status: 200, headers: { "Content-Type": "application/json" } })
  } catch {
    return new Response(JSON.stringify({ error: "fetch_failed" }), { status: 502, headers: { "Content-Type": "application/json" } })
  }
}
