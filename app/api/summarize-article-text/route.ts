import { NextRequest } from "next/server"
import { completeWithSchema, validateArticleSummary } from "../../../lib/structured"
import { articleSummarySystem, articleSummaryUser } from "../../../lib/prompts/articleSummary"
import type { Message } from "../../../lib/llmClient"

export async function POST(req: NextRequest) {
  const { article } = await req.json()
  if (!article || typeof article !== "string" || article.trim().length < 50) {
    return new Response(JSON.stringify({ error: "content_too_short" }), { status: 400 })
  }
  let articleSummary = ""
  try {
    const msgs: Message[] = [{ role: "user", content: articleSummaryUser(article.slice(0, 12000)) }]
    const obj = await completeWithSchema(
      articleSummarySystem(),
      msgs,
      "article",
      validateArticleSummary,
      2
    )
    articleSummary = obj.article_summary
  } catch {
    articleSummary = "文章较长或结构复杂，建议先抓取标题与核心段落以快速把握要点。"
  }
  return Response.json({ articleSummary })
}
