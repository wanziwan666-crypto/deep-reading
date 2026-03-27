export type ConversationStage = "clarify" | "deepen" | "challenge" | "expand"

export type ConversationState = {
  article: string
  articleUrl?: string
  articleSummary?: string
  articleTitle?: string
  stagedHistory: string[]
  currentStage: ConversationStage | ""
  currentRound: number
  lastScore: number | null
  lastScoreReason: string
}

export const defaultState: ConversationState = {
  article: "",
  articleUrl: "",
  articleSummary: "",
  articleTitle: "",
  stagedHistory: [],
  currentStage: "",
  currentRound: 0,
  lastScore: null,
  lastScoreReason: "",
}

const key = "conversation_state"

export function getState(): ConversationState {
  if (typeof window === "undefined") return defaultState
  const raw = window.localStorage.getItem(key)
  if (!raw) return defaultState
  try {
    const s = JSON.parse(raw)
    return { ...defaultState, ...s }
  } catch {
    return defaultState
  }
}

export function setState(s: ConversationState) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(key, JSON.stringify(s))
}

export function resetConversation() {
  setState(defaultState)
}

export function setArticle(article: string) {
  const s = getState()
  s.article = article
  setState(s)
}
