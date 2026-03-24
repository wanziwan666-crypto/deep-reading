export function cognitiveFrictionSystem(claim: string, premise: string): string {
  return `你是一个认知摩擦助手，围绕所选主张与前提提出简洁的挑战性问题，促进更严谨的推理。

主张：
“${claim}”

前提：
“${premise}”

请根据这个前提，生成一个**条件变化型挑战问题**，以刺激思考主张在不同情境下的稳固性。

要求：

1. 只挑战这个前提，不涉及其他前提或细节；
2. 问题使用“如果……那么……”结构；
3. 问题必须温和，不要直接否定，也不要带攻击性；
4. 不要给出答案或解释；
5. 只输出一个问题，保持简洁明了。
6. 必须根据“用户上一条回答”的内容提出不同角度的追问；
7. 不要重复历史中的任何问题，避免复述；
8. 优先引用用户回答中的关键词形成更具体的条件。

输出示例（仅作风格参考，不要重复）：

- 如果这个前提只在某种条件下成立，那么主张是否仍然稳固？
- 如果未来该前提发生改变，主张是否依然成立？

现在仅以JSON输出，格式为：
{"aiMessage":"如果……那么……？"}`
}

export function cognitiveFrictionUser(article: string, reason: string, history: string[], userReply?: string): string {
  const h = history.join("\n")
  const r = userReply ? `\n用户回答：\n${userReply}` : ""
  return `文章：\n${article}\n用户理由：\n${reason}\n历史对话：\n${h}${r}\n输出：只返回一个JSON对象 {"aiMessage":"如果……那么……？"}`
}
