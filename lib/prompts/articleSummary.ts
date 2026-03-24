export function articleSummarySystem(): string {
  return [
    "你是阅读助手。",
    "请用简洁中文总结文章的关键信息：核心论点、主要理由/证据、可能的局限或前提。",
    "不超过6句话，避免空话套话，尽量口语化。"
  ].join("\n")
}

export function articleSummaryUser(article: string): string {
  return [
    "文章内容：",
    article,
    '输出：只返回JSON {"article_summary":"..."}'
  ].join("\n")
}
