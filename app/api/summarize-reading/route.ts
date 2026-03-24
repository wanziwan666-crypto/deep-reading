import { NextRequest } from "next/server"
import { summarizeSystem, summarizeUser } from "../../../lib/prompts/summarize"
import { completeWithSchema, validateSummary } from "../../../lib/structured"
import type { Message } from "../../../lib/llmClient"

function buildStagedText(history: string[]): string {
  const lines: string[] = []
  for (let i = 0; i < history.length; i++) {
    const msg = String(history[i] ?? "").trim()
    if (!msg) continue
    lines.push((i % 2 === 0 ? "用户: " : "AI: ") + msg)
  }
  return lines.join("\n")
}

function buildFrictionText(history: string[]): string {
  const lines: string[] = []
  for (let i = 0; i < history.length; i++) {
    const msg = String(history[i] ?? "").trim()
    if (!msg) continue
    lines.push((i % 2 === 0 ? "AI: " : "用户: ") + msg)
  }
  return lines.join("\n")
}

export async function POST(req: NextRequest) {
  const { article, stagedHistory = [], frictionHistory = [] } = await req.json()
  let articleSummary = ""
  let dialogueSummary = ""
  try {
    const stagedText = buildStagedText(Array.isArray(stagedHistory) ? stagedHistory : [])
    const frictionText = buildFrictionText(Array.isArray(frictionHistory) ? frictionHistory : [])
    const msgs: Message[] = [{ role: "user", content: summarizeUser(String(article ?? ""), stagedText, frictionText) }]
    const obj = await completeWithSchema(
      summarizeSystem(),
      msgs,
      "summary",
      validateSummary,
      2
    )
    articleSummary = obj.article_summary
    dialogueSummary = obj.dialogue_summary
  } catch {
    articleSummary = "文章主要观点已阐述，涉及背景、核心论点与关键证据。"
    dialogueSummary = "对话梳理了你的主要观点与疑问，并形成了一个明确的下一步思考方向。"
  }
  return Response.json({ articleSummary, dialogueSummary })
}
