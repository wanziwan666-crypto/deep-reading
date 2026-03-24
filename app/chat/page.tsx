"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { getState, setState, resetConversation, type ConversationState } from "../../state/conversationState"

export default function ChatPage() {
  const [state, setLocal] = useState<ConversationState>(getState())
  const [loading, setLoading] = useState(false)
  const [reply, setReply] = useState("")
  const [error, setError] = useState("")
  const [panelTop, setPanelTop] = useState(120)
  const [dragging, setDragging] = useState(false)
  const [dragStart, setDragStart] = useState(0)
  const [showArticle, setShowArticle] = useState(true)
  const [showClaims, setShowClaims] = useState(true)
  const [showPremises, setShowPremises] = useState(false)
  const [showSummary, setShowSummary] = useState(true)
  const [thought, setThought] = useState("")
  const [saveTip, setSaveTip] = useState("")
  const [savedRecord, setSavedRecord] = useState<any | null>(null)
  const [showSavedRecord, setShowSavedRecord] = useState(false)
  const [floatingMode, setFloatingMode] = useState(false)

  useEffect(() => {
    setLocal(getState())
  }, [])

  // 根据阶段自动折叠已完成阶段
  useEffect(() => {
    if (state.stage === "claim_select") {
      setShowArticle(true)
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
    } else {
      // end 或其他
      setShowArticle(false)
      setShowClaims(false)
      setShowPremises(false)
    }
  }, [state.stage])

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
          articleSummary: state.articleSummary,
          userInput: thought.trim(),
          history: nextHistory,
          lastStage: state.currentStage || "",
          lastScore: state.lastScore ?? 1
        })
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setError("生成失败，请再发送一次消息")
        return
      }
      const history = [...nextHistory, data.aiMessage ?? ""].filter(Boolean)
      const s = getState()
      s.stagedHistory = history
      s.currentStage = data.stage ?? ""
      s.currentRound = data.round ?? s.currentRound + 1
      s.lastScore = data.score ?? s.lastScore
      s.lastScoreReason = data.scoreReason ?? s.lastScoreReason
      if (data.stage === "end") {
        s.stage = "end"
      }
      setState(s)
      setLocal(s)
      setThought("")
    } finally {
      setLoading(false)
    }
  }

  // 移除自我解释后，不再自动基于理由触发

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

  const continueDiscussion = () => {
    const current = getState()
    const s: ConversationState = {
      ...current,
      stagedHistory: [],
      frictionHistory: [],
      currentStage: "",
      currentRound: 0,
      lastScore: null,
      lastScoreReason: "",
      stage: "claim_select"
    }
    update(s)
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
  }

  return (
    <div
      className="max-w-4xl mx-auto p-6 space-y-6"
      style={{ paddingBottom: state.stage === "friction" ? "28vh" : undefined }}
    >
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">对话</h1>
        <Link href="/records" className="text-sm px-3 py-1.5 border rounded">阅读记录</Link>
      </div>
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">文章</h2>
          <button className="text-sm px-2 py-1 border rounded" onClick={() => setShowArticle((v) => !v)}>
            {showArticle ? "收起" : "展开"}
          </button>
        </div>
        {showArticle && (
          <div className="p-3 border rounded bg-white whitespace-pre-wrap">{state.article || "未输入文章"}</div>
        )}
      </section>
      {state.articleSummary && (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">文章摘要</h2>
            <button className="text-sm px-2 py-1 border rounded" onClick={() => setShowSummary((v) => !v)}>
              {showSummary ? "收起" : "展开"}
            </button>
          </div>
          {showSummary && (
            <div className="p-3 border rounded bg-white whitespace-pre-wrap text-sm">
              {state.articleSummary}
            </div>
          )}
        </section>
      )
      }

      {state.stagedHistory.length === 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-medium">表达你的想法与感受</h2>
          <textarea
            className="w-full p-3 border rounded bg-white"
            value={thought}
            onChange={(e) => setThought(e.target.value)}
            placeholder="写下你对这篇文章的想法与感受"
          />
          <button
            className="px-3 py-1.5 bg-purple-600 text-white rounded disabled:bg-gray-400"
            disabled={!thought.trim() || loading}
            onClick={sendStaged}
          >
            发送给教练
          </button>
        </section>
      )}

      {/* 旧版“论点”模块已移除 */}

      {/* 旧版“前提”模块已移除 */}

      {/* 旧版“前提区域常显”逻辑已移除 */}

      {state.stagedHistory.length > 0 && (
        <section className="space-y-4">
          <div className={floatingMode ? "fixed bottom-0 left-0 right-0 md:left-1/2 md:right-auto md:-translate-x-1/2 z-50 shadow-lg border-t md:border rounded-t bg-white w-full md:w-[720px]" : "border rounded bg-white"}>
            <div className="px-4 py-2 border-b bg-gray-100 text-sm text-gray-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div>思考对话</div>
                {saveTip && <div className="text-xs text-green-700">{saveTip}</div>}
              </div>
              {(state.stagedHistory.length > 0 || state.frictionHistory.length > 0) && (
                <div className="flex items-center gap-3">
                  <button className="px-2 py-1 text-xs border rounded" onClick={() => setFloatingMode(!floatingMode)}>
                    {floatingMode ? "切换为嵌入" : "切换为浮窗"}
                  </button>
                  {state.stagedHistory.length > 0 && (
                    <div className="text-xs text-gray-600" title={state.lastScoreReason || ""}>
                      阶段：{state.currentStage || "未知"}｜评分：{state.lastScore ?? "-"}
                    </div>
                  )}
                  <button
                    className="px-2 py-1 text-xs border rounded"
                    onClick={async () => {
                      setLoading(true)
                      setSaveTip("")
                      try {
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
                          articleSummary: data.articleSummary ?? "",
                          dialogueSummary: data.dialogueSummary ?? "",
                          stage: state.currentStage,
                          score: state.lastScore,
                          stagedHistory: state.stagedHistory,
                          frictionHistory: state.frictionHistory
                        }
                        let recommendations: any[] = []
                        try {
                          const r2 = await fetch("/api/recommend-reading", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              stagedHistory: state.stagedHistory
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
                            setSaveTip("已保存到阅读记录")
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
                      }
                    }}
                  >
                    {state.lastScore === 5 ? "总结并保存" : "保存记录"}
                  </button>
                </div>
              )}
            </div>
            <div className="p-4 space-y-3">
              <div className="max-h-[40vh] overflow-auto space-y-2">
                {state.stagedHistory.map((msg, i) => (
                  <div
                    key={i}
                    className={`p-2 rounded ${i % 2 === 0 ? "bg-gray-50 border border-gray-200" : "bg-blue-50 border border-blue-200"}`}
                  >
                    {i % 2 === 0 ? "我：" : "AI："}{msg}
                  </div>
                ))}
              </div>
              {error && <div className="text-sm text-red-600">{error}</div>}
              
              <textarea
                className="w-full p-3 border rounded bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
                value={thought}
                onChange={(e) => setThought(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && thought.trim() && !loading) {
                    e.preventDefault()
                    sendStaged()
                  }
                }}
                placeholder="你的回答或思考"
                disabled={state.stage === "end"}
              />
              <button
                className="px-3 py-1.5 bg-purple-600 text-white rounded disabled:bg-gray-400"
                disabled={!thought.trim() || loading || state.stage === "end"}
                onClick={sendStaged}
              >
                发送给教练
              </button>
            </div>
          </div>
          {floatingMode && <div className="h-[28vh]" />}
        </section>
      )}
      {showSavedRecord && savedRecord && (
        <div className="fixed inset-0 z-[100] pointer-events-none">
          <div className="fixed bottom-4 right-4 left-4 md:left-auto w-auto md:w-[720px] pointer-events-auto">
            <div className="relative bg-white rounded shadow-lg p-4 space-y-3 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">已保存的阅读记录</div>
              <div className="flex items-center gap-2">
                <Link href="/records" className="text-xs px-2 py-1 border rounded">查看全部</Link>
                <button className="text-xs px-2 py-1 border rounded" onClick={() => setShowSavedRecord(false)}>关闭</button>
              </div>
            </div>
            <div className="text-xs text-gray-600">
              阶段：{savedRecord.stage || "-"}｜评分：{savedRecord.score ?? "-"}｜时间：{new Date(savedRecord.ts).toLocaleString()}
            </div>
            {savedRecord.url && (
              <div className="text-sm">
                文章链接：<a className="text-blue-600 underline" href={savedRecord.url} target="_blank" rel="noreferrer">{savedRecord.url}</a>
              </div>
            )}
            <div className="text-sm">
              <div className="font-medium">文章摘要</div>
              <div className="whitespace-pre-wrap">{savedRecord.articleSummary || "无"}</div>
            </div>
            <div className="text-sm">
              <div className="font-medium">对话摘要</div>
              <div className="whitespace-pre-wrap">{savedRecord.dialogueSummary || "无"}</div>
            </div>
            <div className="text-sm">
              <details>
                <summary className="cursor-pointer">查看思考对话</summary>
                <div className="mt-2 space-y-1">
                  {Array.isArray(savedRecord.stagedHistory) && savedRecord.stagedHistory.map((m: string, i: number) => (
                    <div key={i} className="text-xs">
                      {(i % 2 === 0 ? "我：" : "AI：") + m}
                    </div>
                  ))}
                </div>
              </details>
              
            </div>
            {Array.isArray(savedRecord.recommendations) && savedRecord.recommendations.length > 0 && (
              <div className="text-sm">
                <div className="font-medium mb-1">推荐阅读/作者</div>
                <ul className="list-disc pl-5 space-y-1">
                  {savedRecord.recommendations.map((r: any, i: number) => (
                    <li key={i}>
                      <span className="font-medium">{r.title}</span>
                      {r.author ? <span className="text-gray-700">（{r.author}）</span> : null}
                      <span className="text-gray-500"> · {r.type}</span>
                      <span className="text-gray-600"> · {r.reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            </div>
          </div>
        </div>
      )}

      <section className="space-y-3">
        <button
          className="px-3 py-1.5 bg-green-600 text-white rounded disabled:bg-gray-400"
          onClick={endDiscussion}
          disabled={loading}
        >
          结束讨论
        </button>
      </section>

    </div>
  )
}
