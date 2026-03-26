export type ConversationStage = "clarify" | "deepen" | "challenge" | "expand"
export type LegacyStage = "claim_select" | "premise_select" | "friction" | "end"

export type ConversationState = {
  article: string
  articleUrl?: string
  articleSummary?: string
  articleTitle?: string
  // legacy fields kept for compatibility with existing pages
  claims: string[]
  selectedClaim: string
  premises: string[]
  selectedPremise: string
  userReason: string
  frictionHistory: string[]
  stage: LegacyStage
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
  claims: [],
  selectedClaim: "",
  premises: [],
  selectedPremise: "",
  userReason: "",
  frictionHistory: [],
  stage: "claim_select",
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

export function setSelectedClaim(claim: string) {
  const s = getState()
  s.selectedClaim = claim
  setState(s)
}

export function goToPremiseSelect() {
  const s = getState()
  s.stage = "premise_select"
  setState(s)
}
