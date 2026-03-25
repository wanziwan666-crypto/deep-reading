import { NextRequest } from "next/server"

function extractHead(html: string): { head: string; body: string } {
  const m = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i)
  const head = m ? m[1] : ""
  const mb = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
  const body = mb ? mb[1] : html
  return { head, body }
}

function stripScripts(html: string): string {
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
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

function toPlainText(html: string): string {
  let t = html || ""
  t = t.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
  t = t.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
  t = t.replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, "")
  t = t.replace(/<[^>]+>/g, " ")
  t = t.replace(/\s+/g, " ").trim()
  return t
}

function textToParagraphs(text: string): string {
  const sents = text.split(/(?<=[。！？.!?])\s*/).filter(Boolean)
  const parts: string[] = []
  let buf = ""
  for (const s of sents) {
    if ((buf + s).length > 220) {
      parts.push(`<p>${buf}</p>`)
      buf = s
    } else {
      buf = buf ? buf + s : s
    }
  }
  if (buf) parts.push(`<p>${buf}</p>`)
  return parts.join("\n")
}

function pickStyles(headHtml: string): string {
  const links: string[] = []
  const linkRe = /<link\b[^>]*rel=["']stylesheet["'][^>]*>/gi
  let m: RegExpExecArray | null
  while ((m = linkRe.exec(headHtml))) {
    links.push(m[0])
    if (links.length >= 10) break
  }
  const styles: string[] = []
  const styleRe = /<style\b[^>]*>[\s\S]*?<\/style>/gi
  while ((m = styleRe.exec(headHtml))) {
    styles.push(m[0])
    if (styles.length >= 5) break
  }
  return links.join("\n") + "\n" + styles.join("\n")
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const url = searchParams.get("url") || ""
  if (!url) {
    return new Response("Missing url", { status: 400, headers: { "Content-Type": "text/plain; charset=utf-8" } })
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
      return new Response(`Upstream ${res.status}`, { status: 502, headers: { "Content-Type": "text/plain; charset=utf-8" } })
    }
    html = await res.text()
  } catch {
    return new Response("Fetch failed", { status: 502, headers: { "Content-Type": "text/plain; charset=utf-8" } })
  }
  const { head, body } = extractHead(html)
  const safeHead = pickStyles(stripScripts(head))
  const main = extractMainBlock(body)
  const safeBody = stripScripts(main)
  const plain = toPlainText(safeBody)
  const textPreview = plain && plain.length >= 100 ? textToParagraphs(plain) : ""
  const doc = [
    "<!DOCTYPE html>",
    "<html>",
    "<head>",
    '<meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    `<base href="${url}">`,
    '<meta http-equiv="Content-Security-Policy" content="default-src * data: blob:; script-src \'none\'; object-src \'none\'; connect-src *; img-src * data: blob:; style-src * \'unsafe-inline\'; font-src * data:;">',
    safeHead,
    "<style>body{max-width:880px;margin:0 auto;padding:16px;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;line-height:1.6;color:#111} img,video{max-width:100%;height:auto} a{color:#0a58ca;text-decoration:none} a:hover{text-decoration:underline} blockquote{border-left:3px solid #ddd;margin:0;padding-left:12px;color:#444}</style>",
    "</head>",
    "<body>",
    textPreview ? `<article>${textPreview}</article><hr/><details><summary>页面只读预览（可能不完整）</summary>${safeBody}</details>` : safeBody,
    "</body>",
    "</html>"
  ].join("\n")
  return new Response(doc, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store"
    }
  })
}
