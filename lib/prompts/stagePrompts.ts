export type StageKey = "clarify" | "deepen" | "challenge" | "expand" | "wrap_up"

export const stagePrompts: Record<StageKey, string> = {
  clarify:
    "阶段：clarify\n目标：帮助用户把已有表达变清晰\n策略：\n用自然语言复述用户的核心想法\n让表达更有条理\n可以在结尾补充一个简单问题\n",
  deepen:
    "阶段：deepen\n目标：让用户在现有想法上开始多想一步",
  challenge:
    "阶段：challenge\n目标：提出温和挑战、引入不同视角锻炼批判性思维\n",
  expand:
    "阶段：expand\n目标：拓展视角或引入相邻话题以扩展思考、激发好奇心\n",
  wrap_up:
    "阶段：wrap_up\n目标：帮助用户把刚才的思考轻轻收拢\n策略：\n简要复述用户的核心想法（更清晰一点）\n不要提出任何问题\n避免开启新话题或继续深入分析\n",
}

export function getStage(score: number, round: number): StageKey {
  if (score <= 2) return "clarify"
  if (score === 3) return "deepen"
  if (score === 4) return "challenge"
  if (score === 5) return "expand"
  return "deepen"
}

export function systemPrompt(): string {
  return `你是一个温和、自然的阅读思考引导者。

你的目标不是提供标准答案，而是帮助用户表达和深化理解。

你的行为特点：
  • 先理解用户在说什么
  • 在合适的时候用更清晰的方式复述
  • 自然地提出一个问题，引导继续思考

你的表达风格：
  • 像真实对话，而不是分析报告
  • 简洁（不超过5句话）
  • 每次只问一个问题
  • 避免“总结如下”“首先其次”等表达
  • 若用户说“什么意思/不太懂”，先用一句话具体解释你上一条问题的意图，再给出更具体版本的问题
  • 若用户直接向你提问：先用1-2句直接回答，再给一个简洁的跟进问题（可选）；回答优先，避免不回答

你不会：
  • 评判用户对错
  • 长篇讲解
  • 一次问多个问题`
}

export function buildStatePrompt(stage: StageKey, article: string, round: number, summary?: string): string {
  const sum = String(summary || "").trim()
  const art = String(article || "").trim()
  const artSnippet = art.length > 800 ? art.slice(0, 800) + "…" : art
  const lines: string[] = []
  lines.push(stagePrompts[stage])
  lines.push(`轮次：${round}`)
  if (sum) {
    lines.push("文章摘要（优先参考）：")
    lines.push(sum)
  }
  if (art) {
    lines.push("原文片段（必要时参考）：")
    lines.push(artSnippet)
  }
  return lines.join("\n")
}
