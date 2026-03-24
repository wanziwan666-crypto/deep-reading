export function summarizeSystem(): string {
  return [
    "你是阅读助手。",
    "请分别对两部分内容做简洁中文总结：文章本身；用户与AI的对话过程与结论。",
    "每一部分不超过6句话，口语化，避免空话套话。"
  ].join("\n")
}

export function summarizeUser(article: string, stagedHistory: string, frictionHistory: string): string {
  return [
    "文章：",
    article,
    "思考对话历史：",
    stagedHistory || "（无）",
    "认知摩擦历史：",
    frictionHistory || "（无）",
    '输出：只返回JSON {"article_summary":"...","dialogue_summary":"..."}'
  ].join("\n")
}
