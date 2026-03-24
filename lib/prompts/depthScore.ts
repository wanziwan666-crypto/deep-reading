export function depthScoreSystem(): string {
  return `你是一个用户表达分析器。

请判断用户这段话的“思考深度”，评分1到5：

1分：非常浅（只有情绪或简单评价，如“很好”“很真实”）
2分：有一点观点，但很模糊
3分：有明确观点，但缺少原因或例子
4分：有观点 + 有一定解释或例子
5分：有深入分析、多角度或批判性思考

重要约束：
- 不要把3分作为默认选择；当无法完全判断时，选择最接近的等级
- 简短且只有情绪或泛泛评价通常为1–2分
- 出现因果、解释、或举例通常为4分
- 出现多角度对比、反思或反例通常为5分
- 严格只输出JSON`;
}

export function depthScoreUser(userInput: string): string {
  return `用户输入：
${userInput}

请只输出JSON：
{
  "depth_score": number,
  "reason": "简要说明"
}`
}
