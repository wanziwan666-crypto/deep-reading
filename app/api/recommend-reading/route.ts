import { NextRequest } from "next/server"
import { recommendSystem, recommendUser } from "../../../lib/prompts/recommend"
import { completeWithSchema, validateRecommendations } from "../../../lib/structured"
import type { Message } from "../../../lib/llmClient"

function buildDialogue(stagedHistory: string[], frictionHistory: string[]): string {
  const lines: string[] = []
  for (let i = 0; i < stagedHistory.length; i++) {
    const msg = String(stagedHistory[i] ?? "").trim()
    if (!msg) continue
    lines.push((i % 2 === 0 ? "用户: " : "AI: ") + msg)
  }
  for (let i = 0; i < frictionHistory.length; i++) {
    const msg = String(frictionHistory[i] ?? "").trim()
    if (!msg) continue
    lines.push((i % 2 === 0 ? "AI: " : "用户: ") + msg)
  }
  return lines.join("\n")
}

export async function POST(req: NextRequest) {
  const { stagedHistory = [] } = await req.json()
  const dialogue = buildDialogue(Array.isArray(stagedHistory) ? stagedHistory : [], [])
  let recommendations: any[] = []
  try {
    const msgs: Message[] = [{ role: "user", content: recommendUser(dialogue.slice(0, 12000)) }]
    const obj = await completeWithSchema(
      recommendSystem(),
      msgs,
      "recommend",
      validateRecommendations,
      2
    )
    recommendations = obj.recommendations || []
  } catch {
    recommendations = []
  }
  return Response.json({ recommendations })
}
