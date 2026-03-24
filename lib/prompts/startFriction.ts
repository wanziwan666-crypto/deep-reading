export function startFrictionSystem(claim: string, premise: string): string {
  return `你是一名批判性思维教练。

我们正在分析一个主张：

${claim}

其中一个关键前提是：

${premise}

请注意：

这个主张的成立依赖于这个前提。

你的任务是提出一个“启动问题”，让用户开始重新思考“前提 → 主张”的关系。

这个问题可以通过以下方式产生：

- 改变条件
- 提出反例
- 提出极端情况
- 想象未来变化
- 质疑前提是否稳定

要求：

只提出一个问题。
不要解释。
不要总结。
问题的答案不能是“是”或者“否”。

只返回一个JSON对象：{"message":"..."}`
}

export function startFrictionUser(article: string): string {
  return `文章：\n${article}\n输出：只返回一个JSON对象 {"message":"..."}`
}
