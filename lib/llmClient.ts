export type Message = { role: "user" | "assistant" | "system"; content: string }

const provider = process.env.LLM_PROVIDER || "anthropic"

const anthropicBaseUrl = process.env.ANTHROPIC_BASE_URL
const anthropicToken = process.env.ANTHROPIC_AUTH_TOKEN
const anthropicModel = process.env.ANTHROPIC_MODEL || "anthropic/claude-3-7-sonnet"

const bailianBaseUrl = process.env.BAILIAN_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode"
const bailianToken = process.env.BAILIAN_AUTH_TOKEN
const bailianModel = process.env.BAILIAN_MODEL || "qwen-turbo"

export async function llmComplete(system: string, messages: Message[], maxTokens = 1024, model?: string): Promise<string> {
  if (provider === "bailian") {
    if (!bailianBaseUrl || !bailianToken) return ""
    const url = `${bailianBaseUrl}/v1/chat/completions`
    const body: any = {
      model: model || bailianModel,
      messages: [{ role: "system", content: system }, ...messages.map((m) => ({ role: m.role, content: m.content }))],
      max_tokens: maxTokens,
      temperature: 0.2
    }
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${bailianToken}` },
      body: JSON.stringify(body)
    })
    if (!res.ok) throw new Error(`LLM ${res.status}`)
    const json = await res.json()
    const content = json?.choices?.[0]?.message?.content ?? ""
    return content
  }

  if (!anthropicBaseUrl || !anthropicToken) return ""
  const url = `${anthropicBaseUrl}/v1/messages`
  const body: any = {
    model: model || anthropicModel,
    max_tokens: maxTokens,
    system,
    messages: messages.map((m) => ({ role: m.role === "system" ? "user" : m.role, content: m.content }))
  }
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${anthropicToken}` },
    body: JSON.stringify(body)
  })
  if (!res.ok) throw new Error(`LLM ${res.status}`)
  const json = await res.json()
  const content = json?.content?.[0]?.text ?? ""
  return content
}
