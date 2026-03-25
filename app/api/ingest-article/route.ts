import { NextRequest } from "next/server"

type IngestItem = {
  id: string
  url: string
  title: string
  article: string
  ts: number
}

const store: Map<string, IngestItem> = new Map()
const TTL_MS = 10 * 60 * 1000

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST,GET,OPTIONS",
  }
}

function stripHtmlToText(html: string): string {
  let t = html || ""
  t = t.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
  t = t.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
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
  let raw = body || t
  raw = raw.replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, "")
  raw = raw.replace(/<[^>]+>/g, " ")
  raw = raw.replace(/\s+/g, " ").trim()
  return raw
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() })
}

export async function POST(req: NextRequest) {
  const { url = "", title = "", html = "", text = "" } = await req.json().catch(() => ({}))
  const u = String(url || "").trim()
  const ti = String(title || "").trim()
  const h = String(html || "")
  const tx = String(text || "")
  if (!u && !tx && !h) {
    return new Response(JSON.stringify({ error: "invalid_payload" }), { status: 400, headers: { ...corsHeaders(), "Content-Type": "application/json" } })
  }
  let article = tx || ""
  if (!article && h) {
    article = stripHtmlToText(h)
  }
  if (!article || article.length < 50) {
    return new Response(JSON.stringify({ error: "content_too_short" }), { status: 400, headers: { ...corsHeaders(), "Content-Type": "application/json" } })
  }
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2)
  const item: IngestItem = { id, url: u, title: ti, article: article.slice(0, 16000), ts: Date.now() }
  store.set(id, item)
  return new Response(JSON.stringify({ id }), { status: 200, headers: { ...corsHeaders(), "Content-Type": "application/json" } })
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id") || ""
  const item = id ? store.get(id) : undefined
  if (!item) {
    return new Response(JSON.stringify({ error: "not_found" }), { status: 404, headers: { ...corsHeaders(), "Content-Type": "application/json" } })
  }
  if (Date.now() - item.ts > TTL_MS) {
    store.delete(id)
    return new Response(JSON.stringify({ error: "expired" }), { status: 410, headers: { ...corsHeaders(), "Content-Type": "application/json" } })
  }
  return new Response(JSON.stringify({ url: item.url, title: item.title, article: item.article }), { status: 200, headers: { ...corsHeaders(), "Content-Type": "application/json" } })
}

