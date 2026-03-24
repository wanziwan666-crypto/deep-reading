import { NextRequest } from "next/server"
import { llmComplete } from "../../../lib/llmClient"

export async function GET(req: NextRequest) {
  try {
    const text = await llmComplete(
      "你是一个健康检查助手。请用一句话回应：OK。",
      [{ role: "user", content: "请用一句话回应：OK。" }],
      32
    )
    const ok = typeof text === "string" && text.trim().length > 0
    return Response.json({ ok, message: ok ? "LLM响应正常" : "LLM未返回内容" })
  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : "unknown_error"
    return Response.json({ ok: false, error: msg }, { status: 502 })
  }
}
