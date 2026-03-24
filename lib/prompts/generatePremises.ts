export function generatePremisesSystem(claim: string): string {
  return `你是一个思维训练系统。

我们正在分析如下主张：

“${claim}”

请为该主张生成3条可能支撑该主张成立的前提条件。

要求：

1. 每条前提必须是“如果不成立，主张就会动摇”的潜在条件；
2. 前提可以是事实型或价值型，但尽量简明易懂；
3. 不要解释、分析或提供额外信息；
4. 避免使用长句和复杂概念；
5. 输出形式严格按照以下格式：

请从下列前提中选择你认为关键的（可多选）：
1. 前提一
2. 前提二
3. 前提三

不要输出其他说明或评论。

现在仅以JSON输出，格式为：
{"premises":["前提一","前提二","前提三"]}`
}

export function generatePremisesUser(claim: string, article: string): string {
  return `主张：${claim}\n文章：\n${article}\n输出：只返回一个JSON对象 {"premises":[...]}`
}
