"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { getState, setState, resetConversation, type ConversationState } from "../../state/conversationState"

export default function ChatPage() {
  const [state, setLocal] = useState<ConversationState>(getState())
  const [loading, setLoading] = useState(false)
  const [reply, setReply] = useState("")
  const [error, setError] = useState("")
  const [showArticle, setShowArticle] = useState(false)
  const [showClaims, setShowClaims] = useState(true)
  const [showPremises, setShowPremises] = useState(false)
  const [showSummary, setShowSummary] = useState(false)
  const [thought, setThought] = useState("")
  const [saveTip, setSaveTip] = useState("")
  const [savedRecord, setSavedRecord] = useState<any | null>(null)
  const [showSavedRecord, setShowSavedRecord] = useState(false)
  const [showEndPanel, setShowEndPanel] = useState(false)
  const [showSavingModal, setShowSavingModal] = useState(false)

  useEffect(() => {
    setLocal(getState())
  }, [])

  useEffect(() => {
    if (state.stage === "claim_select") {
      setShowArticle(false)
      setShowClaims(true)
      setShowPremises(false)
    } else if (state.stage === "premise_select") {
      setShowArticle(false)
      setShowClaims(false)
      setShowPremises(true)
    } else if (state.stage === "friction") {
      setShowArticle(false)
      setShowClaims(false)
      setShowPremises(false)
    } else if (state.stage === "end") {
      setShowEndPanel(true)
    }
  }, [state.stage])

  // consume pending thought from homepage to avoid double navigation races
  useEffect(() => {
    try {
      if (typeof window === "undefined") return
      const onMsg = async (ev: MessageEvent) => {
        try {
          if (!ev || typeof ev.data !== "object") return
          const d = ev.data as any
          if (d && d.type === "INGEST_ARTICLE") {
            const url = String(d.url || "")
            const title = String(d.title || "")
            const html = String(d.html || "")
            if (!html && !url) return
            setLoading(true)
            try {
              // ingest html/text to server
              const res = await fetch("/api/ingest-article", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url, title, html })
              })
              const j = await res.json()
              if (j && j.id) {
              const r2 = await fetch(`/api/ingest-article?id=${encodeURIComponent(j.id)}`)
                const d2 = await r2.json()
                const s = getState()
                s.article = String(d2.article || "")
                s.articleUrl = url || s.articleUrl || ""
              s.articleTitle = title || s.articleTitle || ""
                setState(s)
                setLocal({ ...s })
                // fill summary if absent
                if (!s.articleSummary && s.article) {
                  const rs = await fetch("/api/summarize-article-text", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ article: s.article })
                  })
                  const js = await rs.json()
                  const s2 = getState()
                  s2.articleSummary = String(js.articleSummary || "")
                  setState(s2)
                  setLocal({ ...s2 })
                }
              }
            } finally {
              setLoading(false)
            }
          }
        } catch {}
      }
      window.addEventListener("message", onMsg)
      const raw = window.localStorage.getItem("pending_thought")
      if (!raw) return
      if (state.stagedHistory && state.stagedHistory.length > 0) return
      const obj = JSON.parse(raw || "{}")
      const pendingArticle = String(obj.article || "")
      const pendingUser = String(obj.userInput || "")
      if (!pendingUser) return
      const s = getState()
      if (!s.article && pendingArticle) {
        s.article = pendingArticle
        setState(s)
        setLocal(s)
      }
      ;(async () => {
        setLoading(true)
        try {
          const nextHistory = [pendingUser]
          const res = await fetch("/api/staged-chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              article: s.article || pendingArticle,
              userInput: pendingUser,
              history: nextHistory,
              lastScore: 1
            })
          })
          const data = await res.json()
          const history = [pendingUser, data.aiMessage ?? ""].filter(Boolean)
          const s2 = getState()
          s2.article = s2.article || pendingArticle
          s2.stagedHistory = history
          s2.currentStage = data.stage ?? ""
          s2.currentRound = data.round ?? 1
          s2.lastScore = data.score ?? null
          s2.lastScoreReason = data.scoreReason ?? ""
          setState(s2)
          setLocal(s2)
        } finally {
          setLoading(false)
          try { window.localStorage.removeItem("pending_thought") } catch {}
        }
      })()
      // no cleanup of message listener because we keep page alive
    } catch {}
  }, [])

  const ensureArticleLoaded = async () => {
    try {
      if (state.article || !state.articleUrl) return
      setLoading(true)
      let filled = false
      try {
        const res = await fetch("/api/summarize-article", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: state.articleUrl })
        })
        if (res.ok) {
          const data = await res.json()
          const s = getState()
          if (!s.article && data.article) s.article = String(data.article || "")
          if (!s.articleSummary && data.articleSummary) s.articleSummary = String(data.articleSummary || "")
          if (!s.articleTitle && data.title) s.articleTitle = String(data.title || "")
          setState(s)
          setLocal({ ...s })
          filled = !!s.article
        }
      } catch {}
      if (!filled) {
        // fallback: use proxy-article-text for robust plain-text extraction
        const r2 = await fetch(`/api/proxy-article-text?url=${encodeURIComponent(state.articleUrl)}`)
        if (r2.ok) {
          const j2 = await r2.json()
          const s2 = getState()
          s2.article = String(j2.article || "")
          if (!s2.articleTitle && j2.title) s2.articleTitle = String(j2.title || "")
          setState(s2)
          setLocal({ ...s2 })
          // generate summary if absent
          if (!s2.articleSummary && s2.article) {
            try {
              const rs = await fetch("/api/summarize-article-text", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ article: s2.article })
              })
              const js = await rs.json()
              const s3 = getState()
              s3.articleSummary = String(js.articleSummary || "")
              setState(s3)
              setLocal({ ...s3 })
            } catch {}
          }
        }
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!state.articleUrl) return
    if (state.article && state.articleSummary) return
    ensureArticleLoaded()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.articleUrl])

  useEffect(() => {
    const genSummary = async () => {
      try {
        if (!state.article || state.articleSummary) return
        setLoading(true)
        const rs = await fetch("/api/summarize-article-text", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ article: state.article })
        })
        if (rs.ok) {
          const js = await rs.json()
          const s2 = getState()
          s2.articleSummary = String(js.articleSummary || "")
          setState(s2)
          setLocal({ ...s2 })
        }
      } finally {
        setLoading(false)
      }
    }
    genSummary()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.article])

  const sendStaged = async () => {
    if (!thought.trim()) return
    setLoading(true)
    try {
      const nextHistory = [...state.stagedHistory, thought.trim()]
      const res = await fetch("/api/staged-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          article: state.article,
          userInput: thought.trim(),
          history: nextHistory,
          lastScore: state.lastScore ?? 1
        })
      })
      const data = await res.json()
      const history = [...nextHistory, data.aiMessage ?? ""].filter(Boolean)
      const s = getState()
      s.stagedHistory = history
      s.currentStage = data.stage ?? ""
      s.currentRound = data.round ?? s.currentRound + 1
      s.lastScore = data.score ?? s.lastScore
      s.lastScoreReason = data.scoreReason ?? s.lastScoreReason
      if (data.stage === "end") {
        s.stage = "end"
        setShowEndPanel(true)
      }
      setState(s)
      setLocal(s)
      setThought("")
    } finally {
      setLoading(false)
    }
  }

  const update = (s: ConversationState) => {
    setState(s)
    setLocal(s)
  }

  const extractClaims = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/extract-claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ article: state.article })
      })
      const data = await res.json()
      update({ ...state, claims: data.claims ?? [], stage: "premise_select" })
    } finally {
      setLoading(false)
    }
  }

  const generatePremises = async (claimOverride?: string) => {
    const claim = claimOverride ?? state.selectedClaim
    if (!claim) return
    setLoading(true)
    try {
      const res = await fetch("/api/generate-premises", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claim, article: state.article })
      })
      const data = await res.json()
      const current = getState()
      update({ ...current, selectedClaim: claim, premises: data.premises ?? [], stage: "premise_select" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const current = getState()
    if (current.selectedClaim && current.premises.length === 0 && !loading) {
      generatePremises(current.selectedClaim)
    }
  }, [state.selectedClaim, state.premises.length])

  const runFriction = async (premiseOverride?: string) => {
    const premiseVal = premiseOverride ?? state.selectedPremise
    if (!premiseVal) return
    setLoading(true)
    setError("")
    {
      const current = getState()
      const base = Array.isArray(current.frictionHistory) ? current.frictionHistory : []
      const withPlaceholder = base.length === 0 ? [...base, "正在生成问题…"] : base
      update({
        ...current,
        selectedPremise: premiseVal || current.selectedPremise,
        stage: "friction",
        frictionHistory: withPlaceholder
      })
    }
    try {
      if (state.frictionHistory.length === 0) {
        const res = await fetch("/api/start-friction", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            claim: state.selectedClaim,
            premise: premiseVal,
            reason: "",
            article: state.article,
            history: []
          })
        })
        if (!res.ok) throw new Error("start_failed")
        const data = await res.json()
        const current = getState()
        const base = Array.isArray(current.frictionHistory) ? current.frictionHistory : []
        const history =
          base.length > 0 && base[base.length - 1] === "正在生成问题…"
            ? [...base.slice(0, -1), data.aiMessage ?? ""]
            : [...base, data.aiMessage ?? ""]
        update({
          ...getState(),
          selectedPremise: premiseVal || current.selectedPremise,
          selectedClaim: state.selectedClaim || current.selectedClaim,
          frictionHistory: history,
          stage: "friction"
        })
      } else {
        if (!reply.trim()) return
        const nextHistory = [...state.frictionHistory, reply.trim()]
        const res = await fetch("/api/continue-friction", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            claim: state.selectedClaim,
            premise: state.selectedPremise,
            reason: "",
            article: state.article,
            history: nextHistory,
            userReply: reply.trim()
          })
        })
        if (!res.ok) throw new Error("continue_failed")
        const data = await res.json()
        const current = getState()
        const base = Array.isArray(current.frictionHistory) ? current.frictionHistory : []
        const merged = base.length >= nextHistory.length ? base : nextHistory
        const history = [...merged, data.aiMessage ?? ""].filter(Boolean)
        update({
          ...getState(),
          selectedPremise: current.selectedPremise || state.selectedPremise,
          selectedClaim: current.selectedClaim || state.selectedClaim,
          frictionHistory: history,
          stage: "friction"
        })
        setReply("")
      }
    } catch (e) {
      setError("生成下一条问题失败，请重试")
    } finally {
      setLoading(false)
    }
  }

  const endDiscussion = () => {
    update({ ...state, stage: "end" })
    setShowEndPanel(true)
  }

  const saveRecord = async () => {
    setLoading(true)
    setSaveTip("")
    setShowSavingModal(true)
    try {
      const currentTitle =
        (state.articleTitle || "").trim() ||
        ((state.articleSummary || "").split(/[\n。.!?]/)[0] || "").slice(0, 40) ||
        (state.article || "").slice(0, 40)
      const res = await fetch("/api/summarize-reading", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          article: state.article,
          stagedHistory: state.stagedHistory,
          frictionHistory: state.frictionHistory
        })
      })
      const data = await res.json()
      const recBase = {
        ts: Date.now(),
        article: state.article,
        url: state.articleUrl || "",
        title: currentTitle || "",
        articleSummary: data.articleSummary ?? "",
        dialogueSummary: data.dialogueSummary ?? "",
        stage: state.currentStage,
        score: state.lastScore,
        claim: state.selectedClaim,
        premise: state.selectedPremise,
        stagedHistory: state.stagedHistory,
        frictionHistory: state.frictionHistory
      }
      let recommendations: any[] = []
      try {
        const r2 = await fetch("/api/recommend-reading", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            stagedHistory: state.stagedHistory,
            frictionHistory: state.frictionHistory
          })
        })
        const d2 = await r2.json()
        recommendations = Array.isArray(d2.recommendations) ? d2.recommendations : []
      } catch {}
      const rec = { ...recBase, recommendations }
      if (typeof window !== "undefined") {
        try {
          const raw = window.localStorage.getItem("reading_records") || "[]"
          const arr = Array.isArray(JSON.parse(raw)) ? JSON.parse(raw) : []
          arr.unshift(rec)
          window.localStorage.setItem("reading_records", JSON.stringify(arr))
          setSaveTip("已保存")
          setSavedRecord(rec)
          setShowSavedRecord(true)
          setTimeout(() => setSaveTip(""), 2000)
        } catch {
          setSaveTip("保存失败")
          setTimeout(() => setSaveTip(""), 2000)
        }
      }
    } finally {
      setLoading(false)
      setShowSavingModal(false)
    }
  }

  const hasDialogue = state.stagedHistory.length > 0 || state.frictionHistory.length > 0

  return (
    <div className="min-h-screen bg-[var(--bg-secondary)]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[var(--accent-light)] border-b border-[var(--accent)]/20 shadow-sm">
        <div className="w-full px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 ml-2 md:ml-4">
            <Link href="/" className="btn btn-ghost text-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              返回
            </Link>
            <h1 className="text-xl font-semibold">思考对话</h1>
          </div>
          <div className="mr-4 md:mr-6" />
        </div>
      </header>

      <main className="w-full px-6 py-6">
        <div className="max-w-4xl mx-auto space-y-4">
        {(state.article || state.articleUrl) && (
          <div className="card mb-4">
            <button
              className="collapsible-header w-full text-left"
              onClick={() => {
                const next = !showArticle
                setShowArticle(next)
                if (next) ensureArticleLoaded()
              }}
            >
              <span className="section-title">文章</span>
              <span className="text-xs text-[var(--text-tertiary)]">{showArticle ? "收起" : "展开"}</span>
            </button>
            {showArticle && (
              <div className="p-4 space-y-2">
                {state.article ? (
                  <div className="whitespace-pre-wrap text-sm text-[var(--text-secondary)]">{state.article}</div>
                ) : loading ? (
                  <div className="text-xs text-[var(--text-tertiary)]">正在获取全文...</div>
                ) : state.articleUrl ? (
                  <div className="space-y-2">
                    <div className="text-xs text-[var(--text-tertiary)]">未能自动获取全文，你可以点击下方按钮尝试提取纯文本：</div>
                    <button
                      className="btn btn-secondary text-xs"
                      onClick={ensureArticleLoaded}
                      disabled={loading}
                    >
                      {loading ? <span className="spinner" /> : "提取纯文本"}
                    </button>
                    <div className="text-xs text-[var(--text-tertiary)]">或打开原文：</div>
                    <a className="text-[#2563eb] hover:underline text-sm break-all" href={state.articleUrl} target="_blank" rel="noreferrer">
                      {state.articleUrl}
                    </a>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        )}
        {state.articleSummary && (
          <div className="card mb-4">
            <button
              className="collapsible-header w-full text-left"
              onClick={() => setShowSummary(!showSummary)}
            >
              <span className="section-title">文章摘要</span>
              <span className="text-xs text-[var(--text-tertiary)]">{showSummary ? "收起" : "展开"}</span>
            </button>
            {showSummary && (
              <div className="p-4">
                <div className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap">
                  {state.articleSummary}
                </div>
              </div>
            )}
          </div>
        )}
        {/* Claims Section */}
        {state.claims.length > 0 && (
          <div className="card mb-4">
            <button
              className="collapsible-header w-full text-left"
              onClick={() => setShowClaims(!showClaims)}
            >
              <span className="section-title">论点</span>
              <div className="flex items-center gap-2">
                {state.selectedClaim && (
                  <span className="badge badge-blue">{state.selectedClaim.slice(0, 20)}...</span>
                )}
                <span className="text-xs text-[var(--text-tertiary)]">
                  {showClaims ? "收起" : "展开"}
                </span>
              </div>
            </button>
            {showClaims && (
              <div className="p-4">
                {!state.selectedClaim && (
                  <button
                    className="btn btn-secondary text-xs mb-3"
                    onClick={extractClaims}
                    disabled={loading}
                  >
                    {loading ? <span className="spinner" /> : "提取论点"}
                  </button>
                )}
                <div className="grid grid-cols-2 gap-2">
                  {state.claims.map((c, i) => (
                    <button
                      key={i}
                      className={`p-3 text-left text-sm rounded-lg transition-colors border ${
                        state.selectedClaim === c
                          ? "bg-blue-50 border-blue-200"
                          : "bg-[var(--bg-secondary)] border-transparent hover:border-[var(--border)]"
                      }`}
                      onClick={() => {
                        const current = { ...state, selectedClaim: c }
                        update(current)
                        generatePremises(c)
                      }}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Premises Section */}
        {state.premises.length > 0 && (
          <div className="card mb-4">
            <button
              className="collapsible-header w-full text-left"
              onClick={() => setShowPremises(!showPremises)}
            >
              <span className="section-title">前提</span>
              <div className="flex items-center gap-2">
                {state.selectedPremise && (
                  <span className="badge badge-blue">{state.selectedPremise.slice(0, 20)}...</span>
                )}
                <span className="text-xs text-[var(--text-tertiary)]">
                  {showPremises ? "收起" : "展开"}
                </span>
              </div>
            </button>
            {showPremises && (
              <div className="p-4">
                <div className="grid grid-cols-2 gap-2">
                  {state.premises.map((p, i) => (
                    <button
                      key={i}
                      className={`p-3 text-left text-sm rounded-lg transition-colors border ${
                        state.selectedPremise === p
                          ? "bg-blue-50 border-blue-200"
                          : "bg-[var(--bg-secondary)] border-transparent hover:border-[var(--border)]"
                      }`}
                      onClick={() => {
                        const s = { ...state, selectedPremise: p }
                        update(s)
                        runFriction(p)
                      }}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Dialogue Area */}
        <div className="card">
          {/* Thought Input moved to bottom bar */}

          {/* Dialogue History */}
          {(state.stagedHistory.length > 0 || state.frictionHistory.length > 0) && (
            <div className="max-h-[50vh] overflow-auto p-4 space-y-4">
              {/* Staged Chat History */}
              {state.stagedHistory.length > 0 && (
                <>
                  {state.stagedHistory.map((msg, i) => (
                    <div
                      key={`staged-${i}`}
                      className={`p-4 rounded-xl ${i % 2 === 0 ? "bubble-user" : "bubble-ai"}`}
                    >
                      <div className="text-xs text-[var(--text-tertiary)] mb-1">{i % 2 === 0 ? "你" : "AI 教练"}</div>
                      <p className="text-sm leading-relaxed">{msg}</p>
                    </div>
                  ))}
                </>
              )}

              {/* Friction History */}
              {state.frictionHistory.length > 0 && (
                <>
                  {state.frictionHistory.map((msg, i) => (
                    <div
                      key={`friction-${i}`}
                      className={`p-4 rounded-xl ${i % 2 === 0 ? "bubble-ai" : "bubble-user"}`}
                    >
                      <div className="text-xs text-[var(--text-tertiary)] mb-1">{i % 2 === 0 ? "AI 教练" : "你"}</div>
                      <p className="text-sm leading-relaxed">{msg}</p>
                    </div>
                  ))}
                </>
              )}

              {error && (
                <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
                  {error}
                </div>
              )}
            </div>
          )}

          {/* Input moved to bottom bar */}
        </div>

        {/* End Panel removed after save to avoid redundancy */}
        </div>
      </main>

      {/* Bottom Input Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-[var(--border-subtle)]">
        <div className="max-w-4xl mx-auto px-6 py-3">
          {state.stagedHistory.length === 0 && state.frictionHistory.length === 0 ? (
            <div className="flex gap-2">
              <textarea
                className="textarea flex-1 h-24"
                value={thought}
                onChange={(e) => setThought(e.target.value)}
                placeholder="写下你对这篇文章的想法与感受"
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && thought.trim() && !loading) {
                    e.preventDefault()
                    sendStaged()
                  }
                }}
              />
              <button
                className="btn btn-primary"
                onClick={sendStaged}
                disabled={loading || !thought.trim()}
              >
                {loading ? <span className="spinner" /> : "发送给教练"}
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <textarea
                className="textarea flex-1 h-24"
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="你的回答"
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && reply.trim() && !loading) {
                    e.preventDefault()
                    runFriction()
                  }
                }}
              />
              <div className="flex flex-col gap-2">
                <button
                  className="btn btn-primary"
                  onClick={() => runFriction()}
                  disabled={loading || !reply.trim()}
                >
                  {loading ? <span className="spinner" /> : "回答"}
                </button>
                <button
                  className="btn btn-secondary text-xs"
                  onClick={() => {
                    saveRecord()
                  }}
                  disabled={loading}
                >
                  保存
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      {/* Saving Modal */}
      {showSavingModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm p-8 flex flex-col items-center">
            <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin mb-4" />
            <p className="text-base font-medium text-gray-900 mb-2">正在生成阅读记录</p>
            <p className="text-sm text-[var(--text-secondary)]">请稍候...</p>
          </div>
        </div>
      )}

      {/* Saved Record Modal */}
      {showSavedRecord && savedRecord && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowSavedRecord(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-auto">
            <div className="sticky top-0 bg-white border-b border-[var(--border-subtle)] px-6 py-4 flex items-center justify-between">
              <div className="text-sm font-medium">已保存</div>
              <div className="flex items-center gap-2">
                <Link href="/records" className="btn btn-secondary text-xs">
                  查看全部
                </Link>
                <button className="btn btn-ghost text-sm" onClick={() => setShowSavedRecord(false)}>
                  关闭
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="text-sm text-[var(--text-secondary)]">
                {new Date(savedRecord.ts).toLocaleString()}
              </div>

              {savedRecord.url && (
                <div className="text-sm">
                  <span className="text-[var(--text-secondary)]">文章链接：</span>
                  <a className="text-[#2563eb] hover:underline" href={savedRecord.url} target="_blank" rel="noreferrer">
                    {savedRecord.url}
                  </a>
                </div>
              )}

              <div>
                <h4 className="text-sm font-medium mb-1">文章摘要</h4>
                <p className="text-sm text-[var(--text-secondary)]">{savedRecord.articleSummary || "无"}</p>
              </div>

              <div>
                <h4 className="text-sm font-medium mb-1">对话摘要</h4>
                <p className="text-sm text-[var(--text-secondary)]">{savedRecord.dialogueSummary || "无"}</p>
              </div>

              {Array.isArray(savedRecord.recommendations) && savedRecord.recommendations.length > 0 && (
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-5 mt-6">
                  <div className="flex items-center gap-2 mb-4">
                    <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    <h4 className="text-base font-semibold text-amber-900">推荐阅读</h4>
                  </div>
                  <ul className="space-y-3">
                    {savedRecord.recommendations.map((r: any, i: number) => (
                      <li key={i} className="bg-white/80 backdrop-blur-sm border border-amber-100 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-start gap-3">
                          <span className="flex-shrink-0 w-6 h-6 bg-amber-500 text-white text-xs font-medium rounded-full flex items-center justify-center">{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-gray-900">{r.title}</span>
                              {r.author && <span className="text-sm text-[var(--text-secondary)]">（{r.author}）</span>}
                              <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">{r.type}</span>
                            </div>
                            {r.reason && (
                              <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-sm text-amber-900 leading-relaxed">
                                {r.reason}
                              </div>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
