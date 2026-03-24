import { llmComplete, type Message } from "./llmClient"

export type ExtractClaims = { claims: string[] }
export type Premises = { premises: string[] }
export type Friction = { aiMessage: string }
export type StartFriction = { message: string }
export type ContinueFriction = { reply: string; question: string }
export type Staged = { text: string }
export type DepthScore = { depth_score: number; reason: string }
export type Summary = { article_summary: string; dialogue_summary: string }
export type ArticleOnlySummary = { article_summary: string }
export type Recommendation = { title: string; author: string; type: string; reason: string }
export type Recommendations = { recommendations: Recommendation[] }

function stripFences(text: string): string {
  let t = text.trim()
  if (t.startsWith("```")) {
    const idx = t.indexOf("\n")
    t = idx >= 0 ? t.slice(idx + 1) : t
  }
  if (t.endsWith("```")) {
    t = t.slice(0, -3)
  }
  return t.trim()
}

function safeJson(text: string): any {
  const t = stripFences(text)
  try {
    return JSON.parse(t)
  } catch {
    const start = t.indexOf("{")
    const end = t.lastIndexOf("}")
    if (start >= 0 && end > start) {
      const mid = t.slice(start, end + 1)
      return JSON.parse(mid)
    }
    throw new Error("parse_fail")
  }
}

function uniqueStrings(arr: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const s of arr) {
    const v = (s ?? "").trim()
    if (!v) continue
    if (seen.has(v)) continue
    seen.add(v)
    out.push(v)
  }
  return out
}

export function validateExtractClaims(obj: any): ExtractClaims {
  if (!obj || !Array.isArray(obj.claims)) throw new Error("schema_claims")
  const claims = uniqueStrings(obj.claims).slice(0, 5)
  if (claims.length < 3) throw new Error("schema_count")
  return { claims }
}

export function validatePremises(obj: any): Premises {
  if (!obj || !Array.isArray(obj.premises)) throw new Error("schema_premises")
  const premises = uniqueStrings(obj.premises).slice(0, 5)
  if (premises.length < 3) throw new Error("schema_count")
  return { premises }
}

export function validateFriction(obj: any): Friction {
  if (!obj || typeof obj.aiMessage !== "string") throw new Error("schema_msg")
  const aiMessage = obj.aiMessage.trim()
  if (!aiMessage) throw new Error("schema_empty")
  return { aiMessage }
}

export function validateStartFriction(obj: any): StartFriction {
  if (!obj || typeof obj.message !== "string") throw new Error("schema_msg")
  const message = obj.message.trim()
  if (!message) throw new Error("schema_empty")
  return { message }
}

export function validateContinueFriction(obj: any): ContinueFriction {
  if (!obj || typeof obj.reply !== "string" || typeof obj.question !== "string") throw new Error("schema_msg")
  const reply = obj.reply.trim()
  const question = obj.question.trim()
  if (!reply || !question) throw new Error("schema_empty")
  return { reply, question }
}

function strictAppend(system: string, schemaKey: "claims" | "premises" | "aiMessage" | "start" | "continue" | "staged" | "staged_wrap" | "depth" | "summary" | "article" | "recommend"): string {
  if (schemaKey === "claims") {
    return `${system}\n只输出一个JSON对象：{"claims":["..."]}，包含3-5条字符串；不要输出任何解释或额外文本。`
  }
  if (schemaKey === "premises") {
    return `${system}\n只输出一个JSON对象：{"premises":["..."]}，包含3-5条字符串；不要输出任何解释或额外文本。`
  }
  if (schemaKey === "start") {
    return `${system}\n只输出一个JSON对象：{"message":"..."}；不要输出任何解释或额外文本；不要使用代码块。`
  }
  if (schemaKey === "continue") {
    return `${system}\n只输出一个JSON对象：{"reply":"...","question":"..."}；不要输出任何解释或额外文本；不要使用代码块。`
  }
  if (schemaKey === "staged") {
    return `${system}\n只输出一个JSON对象：{"text":"..."}；text内可以是自然中文；不要输出JSON外的任何文本；不要使用代码块；只保留一次问句。`
  }
  if (schemaKey === "staged_wrap") {
    return `${system}\n只输出一个JSON对象：{"text":"..."}；text内可以是自然中文；不要输出JSON外的任何文本；不要使用代码块；不必提问；若提问，也仅允许一个开放式收尾问题（可答可不答）。`
  }
  if (schemaKey === "depth") {
    return `${system}\n只输出一个JSON对象：{"depth_score":<1-5的数字>,"reason":"..."}；不要输出任何解释或额外文本；不要使用代码块。`
  }
  if (schemaKey === "summary") {
    return `${system}\n只输出一个JSON对象：{"article_summary":"...","dialogue_summary":"..."}；不要输出任何解释或额外文本；不要使用代码块。`
  }
  if (schemaKey === "article") {
    return `${system}\n只输出一个JSON对象：{"article_summary":"..."}；不要输出任何解释或额外文本；不要使用代码块。`
  }
  if (schemaKey === "recommend") {
    return `${system}\n只输出一个JSON对象：{"recommendations":[{"title":"...","author":"...","type":"book|article|author","reason":"..."}]}；不要输出任何解释或额外文本；不要使用代码块。`
  }
  return `${system}\n只输出一个JSON对象：{"aiMessage":"..."}；不要输出任何解释或额外文本；不要使用代码块。`
}

export async function completeWithSchema<T>(
  system: string,
  messages: Message[],
  schemaKey: "claims" | "premises" | "aiMessage" | "start" | "continue" | "staged" | "staged_wrap" | "depth" | "summary" | "article" | "recommend",
  validate: (obj: any) => T,
  retries = 2
): Promise<T> {
  let sys = strictAppend(system, schemaKey)
  let lastOut = ""
  for (let i = 0; i <= retries; i++) {
    const out = await llmComplete(sys, messages, 512)
    lastOut = out
    try {
      const obj = safeJson(out)
      const v = validate(obj)
      return v
    } catch {
      sys = strictAppend(system + "\n严格遵循JSON格式。", schemaKey)
      continue
    }
  }
  if (schemaKey === "staged" || schemaKey === "staged_wrap") {
    const t = stripFences(lastOut || "")
    let text = String(t || "").trim()
    if (schemaKey === "staged") {
      if (!text) text = "如果用一句话概括，你最在意的是什么？"
    } else if (schemaKey === "staged_wrap") {
      if (!text) text = "此刻你最在意的一个点是什么？（可答可不答）"
    }
    const fallback = { text }
    const v = validate(fallback)
    return v
  }
  throw new Error("structured_output_fail")
}

export function validateStaged(obj: any): Staged {
  if (!obj || typeof obj.text !== "string") throw new Error("schema_msg")
  const text = obj.text.trim()
  if (!text) throw new Error("schema_empty")
  return { text }
}

export function validateDepthScore(obj: any): DepthScore {
  if (!obj || typeof obj.depth_score !== "number" || typeof obj.reason !== "string") throw new Error("schema_msg")
  const depth = Math.round(obj.depth_score)
  const reason = obj.reason.trim()
  if (depth < 1 || depth > 5) throw new Error("schema_range")
  if (!reason) throw new Error("schema_empty")
  return { depth_score: depth, reason }
}

export function validateSummary(obj: any): Summary {
  if (!obj || typeof obj.article_summary !== "string" || typeof obj.dialogue_summary !== "string") throw new Error("schema_msg")
  const a = obj.article_summary.trim()
  const d = obj.dialogue_summary.trim()
  if (!a || !d) throw new Error("schema_empty")
  return { article_summary: a, dialogue_summary: d }
}

export function validateArticleSummary(obj: any): ArticleOnlySummary {
  if (!obj || typeof obj.article_summary !== "string") throw new Error("schema_msg")
  const a = obj.article_summary.trim()
  if (!a) throw new Error("schema_empty")
  return { article_summary: a }
}

export function validateRecommendations(obj: any): Recommendations {
  if (!obj || !Array.isArray(obj.recommendations)) throw new Error("schema_msg")
  const arr = obj.recommendations.slice(0, 5).filter((x: any) => x && typeof x.title === "string" && typeof x.author === "string" && typeof x.type === "string" && typeof x.reason === "string")
  const mapped = arr.map((x: any) => ({
    title: String(x.title).trim(),
    author: String(x.author).trim(),
    type: String(x.type).trim(),
    reason: String(x.reason).trim()
  })).filter((x: Recommendation) => x.title && x.type && x.reason)
  return { recommendations: mapped }
}
