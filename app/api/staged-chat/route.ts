import { NextRequest } from "next/server"
import { systemPrompt, buildStatePrompt } from "../../../lib/prompts/stagePrompts"
import { completeWithSchema, validateStaged, validateDepthScore } from "../../../lib/structured"
import { depthScoreSystem, depthScoreUser } from "../../../lib/prompts/depthScore"
import type { Message } from "../../../lib/llmClient"
import type { StageKey } from "../../../lib/prompts/stagePrompts"

function toMessages(history: string[]): Message[] {
  const msgs: Message[] = []
  for (let i = 0; i < history.length; i++) {
    const v = String(history[i] ?? "").trim()
    if (!v) continue
    msgs.push({ role: i % 2 === 0 ? "user" : "assistant", content: v })
  }
  return msgs
}

function normalize(text: string): string {
  return String(text || "").replace(/\s+/g, " ").replace(/[，,。；;！!？?]+$/g, "").trim()
}

function keepSingleQuestion(text: string): string {
  const s = String(text || "")
  const qMarks = (s.match(/[？?]/g) || []).length
  if (qMarks <= 1) return s
  const parts = s.split(/([。！？!?])/)
  let out = ""
  let asked = false
  for (let i = 0; i < parts.length; i += 2) {
    const seg = (parts[i] || "").trim()
    const punct = parts[i + 1] || ""
    if (!seg) continue
    const isQ = /[？?]$/.test(seg + punct)
    if (isQ) {
      if (asked) continue
      asked = true
    }
    out += seg + punct
    if (out.length > 800) break
  }
  return out.trim()
}

function antiEcho(userInput: string, aiText: string, lastAssistant: string, stage: StageKey): string {
  let t = String(aiText || "").trim()
  const u = normalize(userInput)
  const a = normalize(lastAssistant)
  let nt = normalize(t)
  if (nt && (nt === u || nt.startsWith(u))) {
    t = t.slice(u.length).trim()
    nt = normalize(t)
  }
  if (!nt || nt === a) {
    if (stage === "wrap_up") {
      return "你已经把关键点讲得很清楚了。如果愿意，你也可以暂时收拢到这里。"
    }
    return "我理解你的表达。基于你刚才的这段话，如果用一句话来概括，你最在意的是什么？"
  }
  return keepSingleQuestion(t)
}

function extractUserMsgs(history: string[]): string[] {
  const arr: string[] = []
  for (let i = 0; i < history.length; i++) {
    const s = String(history[i] ?? "").trim()
    if (!s) continue
    if (i % 2 === 0) arr.push(s)
  }
  return arr
}

function chooseAdaptiveStage(userInput: string, lastAssistant: string, round: number, history: string[], lastStage?: string): StageKey {
  const t = normalize(userInput)
  const askClarify = /(什么意思|不太懂|解释一下|能再说明|你是啥意思)/.test(t)
  const hasExample = /(例如|比如|举例|例如说|比如说)/.test(t)
  const hasCausal = /(因为|由于|因此|所以|导致|造成)/.test(t)
  const hasCompare = /(但是|然而|另一方面|相反|同时|一方面|另一方面|不是.*而是)/.test(t)
  const curiosity = /(还能|还有|相关|拓展|更多|换个角度|拓宽|更深入|挑战|认知|思维)/.test(t)
  const hasAssertive = /(一定|必须|永远|总是|所有人|毫无疑问|显然|必然|从不)/.test(t)
  const lastWasDeepenLike = /(原因|为何|为什么|例子|举例|例如|比如)/.test(normalize(lastAssistant))
  const sentences = t.split(/[。！？!?]/).map(s => s.trim()).filter(Boolean).length
  const lowInfo = (!t || (t.length <= 12 && sentences <= 1 && !hasExample && !hasCausal && !hasCompare))
  const users = extractUserMsgs(history)
  const recent = users.slice(-3)
  const hx = recent.join(" ")
  const hxExample = /(例如|比如|举例|例如说|比如说)/.test(hx)
  const hxCausal = /(因为|由于|因此|所以|导致|造成)/.test(hx)
  const hxCompare = /(但是|然而|另一方面|相反|同时|一方面|另一方面|不是.*而是)/.test(hx)
  const hxCuriosity = /(还能|还有|相关|拓展|更多|换个角度|拓宽|更深入|挑战|认知|思维)/.test(hx)
  if (askClarify || lowInfo) return "clarify"
  if ((hasCausal && hasExample) || (hxCausal && hxExample)) {
    if (hasCompare || hasAssertive) return "challenge"
    return "expand"
  }
  if (hasCausal || hasExample || hxCausal || hxExample) {
    if (String(lastStage || "") === "deepen") {
      return curiosity || hxCuriosity ? "expand" : "expand"
    }
    return "deepen"
  }
  if (hasCompare || hasAssertive || hxCompare) return "challenge"
  if (curiosity || hxCuriosity) return "expand"
  return lastWasDeepenLike ? "expand" : "deepen"
}

export async function POST(req: NextRequest) {
  const { article, articleSummary, userInput, history = [], lastScore, lastStage } = await req.json()
  const histArr: string[] = Array.isArray(history) ? history : []
  const r = Math.floor(histArr.length / 2) + 1
  const lastAssistant = (() => {
    for (let i = histArr.length - 1; i >= 0; i--) {
      if (i % 2 === 1) return String(histArr[i] ?? "")
    }
    return ""
  })()
  let prevUserLen = 0
  for (let i = histArr.length - 1; i >= 0; i--) {
    if (i % 2 === 0) {
      prevUserLen = String(histArr[i] ?? "").trim().length
      break
    }
  }
  function tokenize(s: string): string[] {
    return String(s || "")
      .split(/[，,。；;！!？?\s\/\-、]+/)
      .map(x => x.trim())
      .filter(x => x.length >= 2 && !/^\d+$/.test(x))
  }
  function getStatus(input: string, round: number, last: number | null, prevLen: number): "wrapping" | "ongoing" {
    const t = (input || "").trim()
    const len = t.length
    const isShort = len > 0 && len <= 16
    const summaryLike = /(总的来说|总体上|归根结底|我已经明白了|先这样|差不多了|不用继续|谢谢|就这样)/.test(t)
    const highRounds = round >= 4
    const solid = (last ?? 1) >= 3
    const lenDrop = prevLen > 40 && len <= Math.max(12, Math.floor(prevLen * 0.4))
    if (highRounds && solid) return "wrapping"
    return "ongoing"
  }
  function getGlobalStatus(history: string[], round: number, last: number | null, lastStage?: string): "wrapping" | "ongoing" {
    const uMsgs: string[] = []
    for (let i = 0; i < history.length; i += 2) {
      const s = String(history[i] ?? "").trim()
      if (s) uMsgs.push(s)
    }
    const last2 = uMsgs.slice(-2)
    const len1 = last2[1]?.length ?? 0
    const len0 = last2[0]?.length ?? 0
    const lenDrop = len0 > 0 && len1 > 0 && len1 <= Math.max(12, Math.floor(len0 * 0.4))
    const toksPrev = new Set<string>(tokenize(uMsgs.slice(0, -1).join(" ")))
    const toksLast = tokenize(uMsgs.slice(-1)[0] || "")
    let newCount = 0
    for (const w of toksLast) if (!toksPrev.has(w)) newCount++
    const noveltyLow = toksLast.length > 0 && newCount <= Math.max(1, Math.floor(toksLast.length * 0.35))
    const highRounds = round >= 4
    const solid = (last ?? 1) >= 3
    if ((String(lastStage || "") === "deepen" || String(lastStage || "") === "expand") && (noveltyLow || lenDrop)) return "wrapping"
    if ((highRounds && solid && (noveltyLow || lenDrop))) return "wrapping"
    return "ongoing"
  }
  // try to get a rough depth score (optional)
  let usedScore = 3
  try {
    const depthObj = await completeWithSchema(
      depthScoreSystem(),
      [{ role: "user", content: depthScoreUser(String(userInput ?? "")) }],
      "depth",
      validateDepthScore,
      2
    )
    usedScore = depthObj.depth_score
  } catch {}
  let st: StageKey = chooseAdaptiveStage(String(userInput ?? ""), lastAssistant, r, histArr, String(lastStage || ""))
  const localStatus = getStatus(String(userInput ?? ""), r, typeof lastScore === "number" ? lastScore : null, prevUserLen)
  const globalStatus = getGlobalStatus(histArr, r, typeof lastScore === "number" ? lastScore : null, String(lastStage || ""))
  const status = ((): "wrapping" | "ongoing" => {
    if (globalStatus === "wrapping" || localStatus === "wrapping") return "wrapping"
    return "ongoing"
  })()
  if (String(lastStage || "") === "wrap_up") {
    // 仅在用户输入包含“新观点/新信号”时重开对话机制，否则保持收拢
    const toksPrev = new Set<string>(tokenize(histArr.filter((_, i) => i % 2 === 0).slice(0, -1).join(" ")))
    const toksCur = tokenize(String(userInput ?? ""))
    let newCount = 0
    for (const w of toksCur) if (!toksPrev.has(w)) newCount++
    const ratio = toksCur.length > 0 ? newCount / toksCur.length : 0
    const signals =
      /(例如|比如|举例|例如说|比如说)/.test(String(userInput ?? "")) ||
      /(因为|由于|因此|所以|导致|造成)/.test(String(userInput ?? "")) ||
      /(但是|然而|另一方面|相反|同时|一方面|另一方面|不是.*而是)/.test(String(userInput ?? "")) ||
      /(还能|还有|相关|拓展|更多|换个角度|拓宽|更深入|挑战|认知|思维)/.test(String(userInput ?? ""))
    const noveltyHigh = ratio >= 0.25 || signals
    st = noveltyHigh ? chooseAdaptiveStage(String(userInput ?? ""), lastAssistant, r, histArr) : "wrap_up"
  } else {
    if (status === "wrapping") st = "wrap_up"
  }
  const sys = [systemPrompt(), buildStatePrompt(st, String(article ?? ""), r, String(articleSummary ?? ""))].join("\n\n")
  const msgs: Message[] = [
    ...toMessages(histArr),
    { role: "user", content: String(userInput ?? "").trim() }
  ]
  let text = ""
  try {
    const obj = await completeWithSchema(
      sys,
      msgs,
      st === "wrap_up" ? "staged_wrap" : "staged",
      validateStaged,
      2
    )
    text = obj.text
  } catch {
    return Response.json({ error: "model_failed" }, { status: 503 })
  }
  const cleaned = antiEcho(String(userInput ?? ""), text, lastAssistant, st as StageKey)
  return Response.json({ aiMessage: cleaned, stage: st, round: r, score: usedScore, scoreReason: "" })
}
