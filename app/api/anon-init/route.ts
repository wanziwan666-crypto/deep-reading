import { cookies } from "next/headers"

function newId(): string {
  try {
    // @ts-ignore
    const { randomUUID } = require("crypto")
    return randomUUID()
  } catch {
    return Math.random().toString(36).slice(2) + Date.now().toString(36)
  }
}

export async function GET() {
  const jar = cookies()
  let id = jar.get("anon_id")?.value
  try {
    // allow demo override via ?id=<code>
    // eslint-disable-next-line no-restricted-globals
    const url = new URL((globalThis as any)?.request?.url || "", "http://local")
    const override = (url.searchParams.get("id") || "").trim()
    if (override) {
      const safe = override.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64)
      if (safe) {
        id = safe
      }
    }
  } catch {}
  if (!id) id = newId()
  jar.set("anon_id", id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 })
  return Response.json({ anonId: id })
}

export const dynamic = "force-dynamic"
