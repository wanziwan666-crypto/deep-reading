export type Stage = "claim_select" | "premise_select" | "friction" | "end"
export type ConversationStage = "clarify" | "deepen" | "challenge" | "expand"

export type ConversationState = {
  article: string
  articleUrl?: string
  articleSummary?: string
  claims: string[]
  selectedClaim: string
  premises: string[]
  selectedPremise: string
  userReason: string
  frictionHistory: string[]
  stagedHistory: string[]
  currentStage: ConversationStage | ""
  currentRound: number
  lastScore: number | null
  lastScoreReason: string
  stage: Stage
}

const defaultState: ConversationState = {
  article: "",
  articleUrl: "",
  articleSummary: "",
  claims: [],
  selectedClaim: "",
  premises: [],
  selectedPremise: "",
  userReason: "",
  frictionHistory: [],
  stagedHistory: [],
  currentStage: "",
  currentRound: 0,
  lastScore: null,
  lastScoreReason: "",
  stage: "claim_select"
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
  s.stage = "claim_select"
  setState(s)
}

export function setPremises(premises: string[]) {
  const s = getState()
  s.premises = premises
  s.stage = "premise_select"
  setState(s)
}

export function setSelectedPremise(premise: string) {
  const s = getState()
  s.selectedPremise = premise
  setState(s)
}

export function setUserReason(reason: string) {
  const s = getState()
  s.userReason = reason
  setState(s)
}

export function setStage(stage: Stage) {
  const s = getState()
  s.stage = stage
  setState(s)
}

export function setSelectedClaim(claim: string) {
  const s = getState()
  s.selectedClaim = claim
  setState(s)
}

export function goToClaimSelect() {
  const s = getState()
  s.selectedClaim = ""
  s.premises = []
  s.selectedPremise = ""
  s.userReason = ""
  s.frictionHistory = []
  s.stage = "claim_select"
  setState(s)
}

export function goToPremiseSelect() {
  const s = getState()
  s.stage = "premise_select"
  setState(s)
}

export function goToFriction() {
  const s = getState()
  s.stage = "friction"
  setState(s)
}

export function goToEnd() {
  const s = getState()
  s.stage = "end"
  setState(s)
}

export function reselectPremise(premise: string) {
  const s = getState()
  s.selectedPremise = premise
  s.userReason = ""
  s.frictionHistory = []
  s.stage = "premise_select"
  setState(s)
}

export function reselectClaim(claim: string) {
  const s = getState()
  s.selectedClaim = claim
  s.premises = []
  s.selectedPremise = ""
  s.userReason = ""
  s.frictionHistory = []
  s.stage = "premise_select"
  setState(s)
}
