import { NextRequest } from "next/server"
import { llmComplete } from "../../../lib/llmClient"

export async function GET(req: NextRequest) {
  try {
    const provider = process.env.LLM_PROVIDER || "anthropic"
    const hasAnthropic = !!(process.env.ANTHROPIC_BASE_URL && process.env.ANTHROPIC_AUTH_TOKEN)
    const hasBailian = !!(process.env.BAILIAN_BASE_URL && process.env.BAILIAN_AUTH_TOKEN)
    const text = await llmComplete(
      "你是一个健康检查助手。请用一句话回应：OK。",
      [{ role: "user", content: "请用一句话回应：OK。" }],
      32
    )
    const ok = typeof text === "string" && text.trim().length > 0
    return Response.json({
      ok,
      message: ok ? "LLM响应正常" : "LLM未返回内容",
      provider,
      env: {
        anthropicConfigured: hasAnthropic,
        bailianConfigured: hasBailian
      }
    })
  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : "unknown_error"
    return Response.json({
      ok: false,
      error: msg,
      provider: process.env.LLM_PROVIDER || "anthropic"
    }, { status: 502 })
  }
}
