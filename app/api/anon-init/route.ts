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
  if (!id) {
    id = newId()
    jar.set("anon_id", id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 })
  }
  return Response.json({ anonId: id })
}

export const dynamic = "force-dynamic"
