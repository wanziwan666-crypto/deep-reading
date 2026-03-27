import { cookies } from "next/headers"
import { readRecords, writeRecords } from "../../../lib/server/storage"

type IncomingRecord = {
  ts: number
  article: string
  url?: string
  title?: string
  articleSummary: string
  dialogueSummary: string
  stage?: string
  score?: number
  stagedHistory?: string[]
  recommendations?: Array<{ title: string; author: string; type: string; reason: string }>
}

function anon(): string {
  const id = cookies().get("anon_id")?.value
  if (!id) throw new Error("no_anon")
  return id
}

export async function GET() {
  try {
    const id = anon()
    const arr = readRecords(id)
    return Response.json({ records: arr })
  } catch {
    return Response.json({ records: [] })
  }
}

export async function POST(req: Request) {
  const qs = new URL(req.url).searchParams
  const action = qs.get("action") || "merge" // merge | replace
  try {
    const id = anon()
    const body = await req.json().catch(() => ({}))
    const incoming = Array.isArray(body?.records) ? (body.records as IncomingRecord[]) : []
    const clean = incoming
      .filter((r) => r && typeof r.ts === "number" && r.articleSummary && r.dialogueSummary)
      .slice(0, 1000)
    const existing = readRecords(id)
    let next: any[] = []
    if (action === "replace") {
      next = clean
    } else {
      // merge by ts; prefer newer entries when ts equal choose incoming first
      const map = new Map<number, any>()
      for (const r of existing) map.set(Number(r?.ts) || 0, r)
      for (const r of clean) map.set(Number(r?.ts) || 0, r)
      next = Array.from(map.values()).sort((a, b) => (b.ts || 0) - (a.ts || 0)).slice(0, 2000)
    }
    writeRecords(id, next)
    return Response.json({ ok: true, count: next.length })
  } catch {
    return new Response("Bad Request", { status: 400 })
  }
}

export const dynamic = "force-dynamic"
