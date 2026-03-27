"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { getState, setState, resetConversation, type ConversationState } from "../state/conversationState"

export default function Page() {
  const [article, setArticleInput] = useState("")
  const [summary, setSummary] = useState("")
  const [showSummary, setShowSummary] = useState(true)
  const [summaryError, setSummaryError] = useState("")
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [loadingSend, setLoadingSend] = useState(false)
  const [loadingSaving, setLoadingSaving] = useState(false)
  const [thought, setThought] = useState("")
  const [bmTip, setBmTip] = useState("")
  const [showBmTooltip, setShowBmTooltip] = useState(false)
  const [records, setRecords] = useState<any[]>([])
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [selectedRecordIndex, setSelectedRecordIndex] = useState<number | null>(null)
  const [conv, setConv] = useState<ConversationState>(getState())
  const [reply, setReply] = useState("")
  const [showSavingModal, setShowSavingModal] = useState(false)
  const [savedRecord, setSavedRecord] = useState<any | null>(null)
  const [showSavedRecord, setShowSavedRecord] = useState(false)
  const [showReturnConfirm, setShowReturnConfirm] = useState(false)
  const [savedThisSession, setSavedThisSession] = useState(false)
  const bmButtonRef = useRef<HTMLButtonElement>(null)
  const selectionLockedRef = useRef(false)
  const homeHistoryRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (bmButtonRef.current && !bmButtonRef.current.contains(e.target as Node)) {
        setShowBmTooltip(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const raw = window.localStorage.getItem("reading_records") || "[]"
      const arr = JSON.parse(raw)
      const sp = new URLSearchParams(window.location.search || "")
      const preferInput = true
      if (Array.isArray(arr)) {
        setRecords(arr)
        if (!selectionLockedRef.current) {
          setSelectedRecordIndex(null)
          selectionLockedRef.current = true
        }
      }
      try { window.localStorage.removeItem("prefer_home_input") } catch {}
    } catch {
      setRecords([])
    }
  }, [])

  useEffect(() => {
    const el = homeHistoryRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [conv?.stagedHistory?.length])

  const removeRecord = (idx: number) => {
    try {
      const arr = [...records]
      arr.splice(idx, 1)
      setRecords(arr)
      if (typeof window !== "undefined") {
        window.localStorage.setItem("reading_records", JSON.stringify(arr))
      }
      if (selectedRecordIndex !== null) {
        if (arr.length === 0) {
          setSelectedRecordIndex(null)
        } else {
          const next = Math.min(idx, arr.length - 1)
          setSelectedRecordIndex(next)
        }
      }
    } catch {}
  }

  const formatDate = (ts: number) => {
    const d = new Date(ts)
    return d.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Shanghai"
    })
  }

  const cleanTitle = (s: string) =>
    String(s || "")
      .replace(/^\s*(核心论点(是)?|主要理由|主要证据|可能局限|要点|结论|摘要|概括)\s*[:：]\s*/g, "")
      .trim()

  // When user pastes a URL, persist url/title to global state immediately
  useEffect(() => {
    const v = article.trim()
    const isUrl = /^https?:\/\//i.test(v)
    if (!isUrl) return
    try {
      const s = getState()
      if (s.articleUrl !== v) {
        s.articleUrl = v
        setState(s)
      }
      ;(async () => {
        try {
          const r = await fetch(`/api/proxy-article-text?url=${encodeURIComponent(v)}`)
          if (r.ok) {
            const j = await r.json()
            const s2 = getState()
            if (!s2.articleTitle && j && typeof j.title === "string" && j.title.trim()) {
              s2.articleTitle = j.title.trim()
              setState(s2)
            }
          }
        } catch {}
      })()
    } catch {}
  }, [article])

  const summarizeFromText = async () => {
    if (!article.trim()) return
    setLoadingSummary(true)
    try {
      setSummaryError("")
      // Check if input is a URL
      const isUrl = /^https?:\/\//i.test(article.trim())
      let data
      if (isUrl) {
        const urlVal = article.trim()
        const res = await fetch("/api/summarize-article", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: urlVal })
        })
        if (res.ok) {
          data = await res.json()
          if (data.error) {
            // fall through to fallback path
          } else {
            const s = getState()
            s.article = String(data.article || "")
            s.articleUrl = urlVal
            s.articleSummary = String(data.articleSummary || "")
            s.articleTitle = String(data.title || "")
            setState(s)
            setArticleInput(String(data.article || ""))
            setSummary(String(data.articleSummary || ""))
            setShowSummary(true)
            return
          }
        }
        // Fallback: robust plain-text extraction via proxy-article-text
        try {
          const r2 = await fetch(`/api/proxy-article-text?url=${encodeURIComponent(urlVal)}`)
          if (r2.ok) {
            const j2 = await r2.json()
            const text2 = String(j2.article || "")
            const title2 = String(j2.title || "")
            if (text2) {
              const s = getState()
              s.article = text2
              s.articleUrl = urlVal
              if (title2) s.articleTitle = title2
              setState(s)
              setArticleInput(text2)
              // Generate summary from text
              const rs = await fetch("/api/summarize-article-text", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ article: text2 })
              })
              if (rs.ok) {
                const js = await rs.json()
                setSummary(String(js.articleSummary || ""))
                setShowSummary(true)
              } else {
                setSummaryError("生成摘要失败，请稍后重试。")
              }
              return
            }
          }
        } catch {}
        // If both main and fallback fail, show error
        setSummaryError("目标页面需要验证（如人机验证/安全校验）或抓取失败，请手动粘贴正文。")
        return
      } else {
        const res = await fetch("/api/summarize-article-text", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ article: article.trim() })
        })
        data = await res.json()
        if (data.error) {
          setSummaryError("生成摘要失败，请检查正文是否完整。")
          return
        }
        const s = getState()
        s.article = article.trim()
        s.articleSummary = String(data.articleSummary || "")
        setState(s)
      }
      if (data) {
        setSummary(String(data.articleSummary || ""))
        setShowSummary(true)
      }
    } finally {
      setLoadingSummary(false)
    }
  }

  const summarizeFromInputBar = async () => {
    const hasHistory = (getState().stagedHistory?.length ?? 0) > 0
    const inputVal = hasHistory ? reply.trim() : thought.trim()
    if (!inputVal) return
    setLoadingSummary(true)
    try {
      let articleText = ""
      let articleTitle = ""
      let articleUrl = ""
      let articleSummaryText = ""
      const isUrl = /^https?:\/\//i.test(inputVal)
      if (isUrl) {
        const res = await fetch("/api/summarize-article", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: inputVal })
        })
        if (res.ok) {
          const data = await res.json()
          articleText = String(data.article || "")
          articleSummaryText = String(data.articleSummary || "")
          articleTitle = String(data.title || "")
          articleUrl = inputVal
        } else {
          // fallback to proxy-article-text then summarize
          try {
            const r2 = await fetch(`/api/proxy-article-text?url=${encodeURIComponent(inputVal)}`)
            if (r2.ok) {
              const j2 = await r2.json()
              articleText = String(j2.article || "")
              articleTitle = String(j2.title || "")
              articleUrl = inputVal
              if (articleText) {
                const rs = await fetch("/api/summarize-article-text", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ article: articleText })
                })
                if (rs.ok) {
                  const js = await rs.json()
                  articleSummaryText = String(js.articleSummary || "")
                }
              }
            }
          } catch {}
        }
      } else {
        // treat input as article text
        articleText = inputVal
        const rs = await fetch("/api/summarize-article-text", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ article: articleText })
        })
        if (rs.ok) {
          const js = await rs.json()
          articleSummaryText = String(js.articleSummary || "")
        }
      }
      const current = getState()
      const base = Array.isArray(current.stagedHistory) ? current.stagedHistory : []
      const nextHistory = [...base, inputVal]
      const aiMsg = articleSummaryText || "未能生成摘要，请检查输入是否有效"
      const finalHistory = [...nextHistory, aiMsg]
      const s = getState()
      if (articleText) s.article = articleText
      if (articleUrl) s.articleUrl = articleUrl
      if (articleTitle && !s.articleTitle) s.articleTitle = articleTitle
      if (articleSummaryText) s.articleSummary = articleSummaryText
      s.stagedHistory = finalHistory
      s.currentStage = s.currentStage || ""
      s.currentRound = (s.currentRound || 0) + 1
      setState(s)
      setConv({ ...s })
      if (hasHistory) {
        setReply("")
      } else {
        setThought("")
      }
    } finally {
      setLoadingSummary(false)
    }
  }

  const sendThought = async () => {
    if (!thought.trim()) return
    setLoadingSend(true)
    try {
      const prev = getState()
      const isUrl = /^https?:\/\//i.test(article.trim())
      resetConversation()
      const s = getState()
      s.article = article
      // Preserve previously captured url/title, or set from current input if it's a URL
      if (prev.articleUrl) s.articleUrl = prev.articleUrl
      if (isUrl) s.articleUrl = article.trim()
      if (prev.articleTitle && !s.articleTitle) s.articleTitle = prev.articleTitle
      if (summary && !s.articleSummary) {
        s.articleSummary = summary
      }
      setState(s)
      const res = await fetch("/api/staged-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          article,
          userInput: thought.trim(),
          history: [thought.trim()],
          lastScore: 1
        })
      })
      const data = await res.json()
      const s2 = getState()
      s2.article = article
      {
        const stg = String(data.stage ?? "")
        const ai = String(data.aiMessage ?? "")
        const aiFinal = stg === "wrap-up" || stg === "wrap_up" ? (ai.startsWith("总结：") ? ai : `总结：${ai}`) : ai
        s2.stagedHistory = [thought.trim(), aiFinal].filter(Boolean)
      }
      s2.currentStage = data.stage ?? ""
      s2.currentRound = data.round ?? 1
      s2.lastScore = data.score ?? null
      s2.lastScoreReason = data.scoreReason ?? ""
      setState(s2)
      setThought("")
      setConv({ ...s2 })
    } finally {
      setLoadingSend(false)
    }
  }

  const sendStagedHome = async () => {
    if (!reply.trim()) return
    setLoadingSend(true)
    try {
      const current = getState()
      const base = Array.isArray(current.stagedHistory) ? current.stagedHistory : []
      const nextHistory = [...base, reply.trim()]
      const res = await fetch("/api/staged-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          article: current.article,
          userInput: reply.trim(),
          history: nextHistory,
          lastScore: current.lastScore ?? 1
        })
      })
      const data = await res.json()
      const stg = String(data.stage ?? "")
      const ai = String(data.aiMessage ?? "")
      const aiFinal = stg === "wrap-up" || stg === "wrap_up" ? (ai.startsWith("总结：") ? ai : `总结：${ai}`) : ai
      const history = [...nextHistory, aiFinal].filter(Boolean)
      const s = getState()
      s.stagedHistory = history
      s.currentStage = data.stage ?? ""
      s.currentRound = data.round ?? (s.currentRound || 1) + 1
      s.lastScore = data.score ?? s.lastScore
      s.lastScoreReason = data.scoreReason ?? s.lastScoreReason
      setState(s)
      setConv({ ...s })
      setReply("")
    } finally {
      setLoadingSend(false)
    }
  }

  const saveRecordHome = async () => {
    setLoadingSaving(true)
    setShowSavingModal(true)
    try {
      const s = getState()
      const res = await fetch("/api/summarize-reading", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          article: s.article,
          stagedHistory: s.stagedHistory
        })
      })
      const data = await res.json()
      const dialogueSummary = String(data.dialogueSummary || "").replace(/用户/g, "你")
      const articleSummaryToSave = String(s.articleSummary || "")
      const currentTitle =
        (s.articleTitle || "").trim() ||
        (dialogueSummary.split(/[\n。.!?]/)[0] || "").slice(0, 40) ||
        (articleSummaryToSave.split(/[\n。.!?]/)[0] || "").slice(0, 40) ||
        (s.article || "").slice(0, 40)
      const recBase = {
        ts: Date.now(),
        article: s.article,
        url: s.articleUrl || "",
        title: currentTitle || "",
        articleSummary: articleSummaryToSave,
        dialogueSummary,
        stage: s.currentStage,
        score: s.lastScore,
        stagedHistory: s.stagedHistory
      }
      let recommendations: any[] = []
      try {
        const r2 = await fetch("/api/recommend-reading", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            stagedHistory: s.stagedHistory
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
          setRecords(arr)
          setSavedRecord(rec)
          setShowSavedRecord(true)
          setSavedThisSession(true)
        } catch {
          setSavedRecord(null)
          setShowSavedRecord(false)
        }
      }
    } finally {
      setLoadingSaving(false)
      setShowSavingModal(false)
    }
  }
  return (
    <div className="min-h-screen bg-[var(--bg-secondary)]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[var(--accent-light)] border-b border-[var(--accent)]/20 shadow-sm">
        <div className="relative w-full px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 ml-2 md:ml-4">
            <h1 className="text-xl md:text-2xl font-semibold text-[var(--text-primary)]">深度阅读</h1>
            <img
              src="/deep-reading-logo.png"
              alt="Deep Reading"
              className="h-9 w-auto"
            />
          </div>
          <div
            className="absolute top-1/2 -translate-y-1/2"
            style={{ left: sidebarCollapsed ? "4rem" : "21rem" }}
          >
            {(selectedRecordIndex !== null || (getState().stagedHistory?.length ?? 0) > 0) && (
              <button
                className="btn btn-ghost text-base hover:bg-transparent hover:text-[var(--text-primary)]"
                onClick={() => {
                  if (selectedRecordIndex !== null) {
                    setSelectedRecordIndex(null)
                  } else {
                    const hasHistory = (getState().stagedHistory?.length ?? 0) > 0
                    if (savedThisSession) {
                      resetConversation()
                      const s = getState()
                      setState(s)
                      setConv({ ...s })
                      setThought("")
                      setReply("")
                    } else if (hasHistory) {
                      setShowReturnConfirm(true)
                    } else {
                      resetConversation()
                      const s = getState()
                      setState(s)
                      setConv({ ...s })
                      setThought("")
                      setReply("")
                    }
                  }
                }}
              >
                <svg className="w-4 h-4 mr-0 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                返回
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 mr-4 md:mr-6">
            <button
              className={`btn btn-primary ${loadingSend || loadingSaving ? "opacity-60 pointer-events-none" : ""}`}
              onClick={saveRecordHome}
              disabled={loadingSaving || loadingSend}
              title="生成阅读记录"
            >
              {loadingSaving ? <span className="spinner" /> : "生成阅读记录"}
            </button>
            <div className="relative">
              <button
                ref={bmButtonRef}
                className="btn btn-ghost text-base hover:bg-transparent hover:text-[var(--text-primary)]"
                onClick={async () => {
                  try {
                    const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"
                    const bm = [
                      'javascript:(function(){',
                      'var html=document.documentElement.outerHTML;',
                      'var u=location.href;',
                      'var t=document.title||\"\";',
                      `var w=window.open('${origin}/chat?bm=1&url='+encodeURIComponent(u),'_blank');`,
                      'var tries=0;',
                      'var iv=setInterval(function(){',
                      '  try{',
                      '    if(!w||w.closed||tries>20){clearInterval(iv);return;}',
                      `    w.postMessage({type:'INGEST_ARTICLE',url:u,title:t,html:html},'${origin}');`,
                      '    clearInterval(iv);',
                      '  }catch(e){}',
                      '  tries++;',
                      '},200);',
                      '})()'
                    ].join('')
                    if (navigator.clipboard && navigator.clipboard.writeText) {
                      await navigator.clipboard.writeText(bm)
                    } else {
                      const ta = document.createElement("textarea")
                      ta.value = bm
                      document.body.appendChild(ta)
                      ta.select()
                      document.execCommand("copy")
                      document.body.removeChild(ta)
                    }
                    setBmTip("已复制书签，粘贴到浏览器书签地址即可使用")
                    setTimeout(() => setBmTip(""), 2500)
                  } catch {
                    setBmTip("复制失败，请重试")
                    setTimeout(() => setBmTip(""), 2000)
                  }
                }}
                onMouseEnter={() => setShowBmTooltip(true)}
                onMouseLeave={() => setShowBmTooltip(false)}
              >
                复制书签
              </button>
              {showBmTooltip && (
                <div className="absolute right-0 top-full mt-2 w-72 px-3 py-2.5 bg-white border border-[var(--border)] rounded-lg shadow-lg z-50">
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    用法：<br />
                    1) 点击复制按钮<br />
                    2) 在浏览器书签栏新建书签，将复制内容粘贴为地址<br />
                    3) 在任意文章页点击该书签即可发送全文到对话页
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full px-0 py-8">
        <div className="flex gap-4">
          <div className={`${sidebarCollapsed ? "w-12" : "w-80"} transition-all`}>
            {sidebarCollapsed ? (
              <div className="pt-2">
                <button
                  className="w-10 h-10 rounded-lg bg-[var(--accent-light)] border border-[var(--accent)]/30 flex items-center justify-center"
                  title="展开阅读记录"
                  onClick={() => setSidebarCollapsed(false)}
                >
                  <svg className="w-4 h-4 text-[var(--text-tertiary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            ) : (
              <div className="card p-3 md:p-4 h-[calc(100vh-6rem)] flex flex-col">
                <div className="-mx-3 md:-mx-4 -mt-3 md:-mt-4 px-3 md:px-4 py-2 bg-[var(--accent-light)] border-b border-[var(--accent)]/20 rounded-t-xl flex items-center justify-between">
                  <div className="text-sm font-medium text-[var(--text-primary)]">阅读记录</div>
                  <button className="btn btn-ghost text-xs" onClick={() => setSidebarCollapsed(true)}>
                    <svg className="w-4 h-4 text-[var(--text-tertiary)] rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
                <div className="pt-2" />
                <div className="space-y-2 flex-1 min-h-0 overflow-y-auto pr-1">
                  {records.length === 0 ? (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="text-sm text-[var(--text-secondary)]">你还没有阅读记录哦，从现在开始吧！</div>
                    </div>
                  ) : (
                    records.slice(0, 50).map((r, i) => {
                      const summaryHead = String(r.dialogueSummary || "").replace(/用户/g, "你").split(/[\n。.!?]/)[0] || ""
                      const title = cleanTitle(summaryHead).slice(0, 40) || cleanTitle((r.articleSummary || "").split(/[\n。.!?]/)[0] || "").slice(0, 40) || (r.article || "").slice(0, 40) || "未命名文章"
                      const active = selectedRecordIndex === i
                      return (
                        <button
                          key={`r-${r.ts}-${i}`}
                          className={`w-full text-left p-3 rounded-lg border ${active ? "bg-[var(--accent-light)] border-[var(--accent)]/30" : "bg-[var(--bg-secondary)] border-[var(--border)] hover:bg-[var(--bg-tertiary)]"}`}
                          title={title}
                          onClick={() => setSelectedRecordIndex(i)}
                        >
                          <div className="text-sm font-semibold truncate">{title}</div>
                          <div className="text-xs text-[var(--text-tertiary)] mt-0.5" suppressHydrationWarning>{formatDate(r.ts)}</div>
                        </button>
                      )
                    })
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0 px-6">
            <div className="space-y-4 max-w-5xl xl:max-w-6xl mx-auto">
            {selectedRecordIndex !== null && records[selectedRecordIndex] ? (
              <div className="card p-4 w-full">
                {(() => {
                  const r = records[selectedRecordIndex as number]
                  return (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between flex-nowrap gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="badge badge-gray">{formatDate(r.ts)}</span>
                          <span className="font-semibold text-[var(--text-primary)] truncate">{(r.title && r.title.trim()) || "未命名文章"}</span>
                          {r.url && (
                            <a href={r.url} target="_blank" rel="noreferrer noopener" className="text-xs text-[#2563eb] underline whitespace-nowrap">
                              查看原文
                            </a>
                          )}
                        </div>
                        <button className="btn btn-ghost text-sm text-red-600 flex-shrink-0 whitespace-nowrap" onClick={() => removeRecord(selectedRecordIndex as number)}>
                          删除
                        </button>
                      </div>
                      {r.articleSummary && (
                        <div>
                          <h4 className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide mb-1">文章摘要</h4>
                          <p className="text-sm text-[var(--text-primary)]">{r.articleSummary}</p>
                        </div>
                      )}
                      {r.dialogueSummary && (
                        <div>
                          <h4 className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide mb-1">对话摘要</h4>
                          <p className="text-sm text-[var(--text-primary)]">{String(r.dialogueSummary || "").replace(/用户/g, "你")}</p>
                        </div>
                      )}
                      {r.stagedHistory?.length && (
                        <details className="group">
                          <summary className="text-xs font-medium text-[var(--text-secondary)] cursor-pointer hover:text-[var(--text-primary)] flex items-center gap-1">
                            <svg className="w-3 h-3 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                            查看完整对话
                          </summary>
                          <div className="mt-3 space-y-3 bg-[var(--bg-secondary)] rounded-lg p-4">
                            {r.stagedHistory?.map((m: string, idx: number) => (
                              <div key={`staged-${idx}`} className={`p-3 rounded-lg text-sm ${idx % 2 === 0 ? "bg-white" : "bg-blue-50"}`}>
                                <span className="text-[var(--text-tertiary)] text-xs font-medium">{idx % 2 === 0 ? "你" : "AI"}</span>
                                <p className="mt-1 leading-relaxed">{m}</p>
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                      {Array.isArray(r.recommendations) && r.recommendations.length > 0 && (
                        <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-5 mt-6">
                          <div className="flex items-center gap-2 mb-4">
                            <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                            </svg>
                            <h4 className="text-base font-semibold text-amber-900">推荐阅读</h4>
                          </div>
                          <ul className="space-y-3">
                            {r.recommendations.map((rec: any, idx: number) => (
                              <li key={idx} className="bg-white/80 backdrop-blur-sm border border-amber-100 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex items-center gap-3">
                                  <span className="flex-shrink-0 w-6 h-6 bg-amber-500 text-white text-xs font-medium rounded-full flex items-center justify-center">{idx + 1}</span>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-semibold text-gray-900">{rec.title}</span>
                                      {rec.author && <span className="text-sm text-[var(--text-secondary)]">（{rec.author}）</span>}
                                      <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">{rec.type}</span>
                                    </div>
                                    {rec.reason && <p className="text-sm text-[var(--text-secondary)] mt-1.5 leading-relaxed">{rec.reason}</p>}
                                  </div>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )
                })()}
              </div>
            ) : (
              <>
                {bmTip && (
              <div className="mb-3 px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-xs text-green-700">
                {bmTip}
              </div>
                )}
                {(getState().stagedHistory?.length > 0) && (
                  <div className="border-0 bg-transparent shadow-none rounded-none p-0">
                    <div ref={homeHistoryRef} className="max-h-[calc(100vh-240px)] overflow-auto p-4 space-y-4">
                      {getState().stagedHistory?.length > 0 && (
                        <>
                          {getState().stagedHistory.map((msg, i) => (
                            <div key={`staged-${i}`} className={`p-4 rounded-xl ${i % 2 === 0 ? "bubble-user" : "bubble-ai"}`}>
                              <div className="text-xs text-[var(--text-tertiary)] mb-1">{i % 2 === 0 ? "你" : "AI 教练"}</div>
                              <p className="text-sm leading-relaxed">{msg}</p>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  </div>
                )}
                
              </>
            )}
            </div>
          </div>
        </div>
      </main>
      {showReturnConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowReturnConfirm(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <div className="text-base font-medium text-gray-900 mb-2">确认返回？</div>
            <div className="text-sm text-[var(--text-secondary)] mb-4">返回后当前对话将被清空。是否需要先生成阅读记录？</div>
            <div className="flex justify-end gap-2">
              <button className="btn btn-ghost text-sm" onClick={() => setShowReturnConfirm(false)}>取消</button>
              <button
                className="btn btn-secondary text-sm"
                disabled={loadingSaving}
                onClick={() => {
                  resetConversation()
                  const s = getState()
                  setState(s)
                  setConv({ ...s })
                  setThought("")
                  setReply("")
                  setShowReturnConfirm(false)
                }}
              >
                直接返回
              </button>
              <button
                className="btn btn-primary text-sm"
                disabled={loadingSaving}
                onClick={async () => {
                  await saveRecordHome()
                  resetConversation()
                  const s = getState()
                  setState(s)
                  setConv({ ...s })
                  setThought("")
                  setReply("")
                  setShowReturnConfirm(false)
                }}
              >
                生成阅读记录并返回
              </button>
            </div>
          </div>
        </div>
      )}
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
              <div className="text-sm text-[var(--text-secondary)]" suppressHydrationWarning>
                {formatDate(savedRecord.ts)}
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
                <p className="text-sm text-[var(--text-secondary)]">{String(savedRecord.dialogueSummary || "").replace(/用户/g, "你") || "无"}</p>
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
      <div
        className="fixed bottom-0 right-0 z-40 bg-white"
        style={{ left: sidebarCollapsed ? "4rem" : "21rem" }}
      >
        <div className="px-6 py-3">
          <div className="max-w-5xl xl:max-w-6xl mx-auto">
            <div className="flex items-end gap-4 w-full">
            <textarea
              className="textarea h-24 flex-1"
              value={(getState().stagedHistory?.length ?? 0) > 0 ? reply : thought}
              onChange={(e) => {
                if ((getState().stagedHistory?.length ?? 0) > 0) {
                  setReply(e.target.value)
                } else {
                  setThought(e.target.value)
                }
              }}
              placeholder={(getState().stagedHistory?.length ?? 0) > 0 ? "请输入你的回复" : "粘贴文章或文章url，我可以帮你生成摘要"}
              onKeyDown={(e) => {
                const hasHistory = (getState().stagedHistory?.length ?? 0) > 0
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && !loadingSend) {
                  e.preventDefault()
                  if (hasHistory) {
                    if (reply.trim()) sendStagedHome()
                  } else {
                    if (thought.trim()) sendThought()
                  }
                }
              }}
            />
            <div className="flex flex-col gap-1 h-24 justify-end w-32">
              <button
                className={`btn btn-primary h-11 ${loadingSaving ? "opacity-60 pointer-events-none" : ""}`}
                onClick={() => {
                  const hasHistory = (getState().stagedHistory?.length ?? 0) > 0
                  if (hasHistory) {
                    if (reply.trim()) sendStagedHome()
                  } else {
                    if (thought.trim()) sendThought()
                  }
                }}
                disabled={loadingSend || loadingSaving || ((getState().stagedHistory?.length ?? 0) > 0 ? !reply.trim() : !thought.trim())}
              >
                {loadingSend ? <span className="spinner" /> : "回复"}
              </button>
              <button
                className={`btn btn-secondary text-xs h-11 ${loadingSaving ? "opacity-60 pointer-events-none" : ""}`}
                onClick={summarizeFromInputBar}
                disabled={loadingSummary || loadingSaving || ((getState().stagedHistory?.length ?? 0) > 0 ? !reply.trim() : !thought.trim())}
              >
                {loadingSummary ? <span className="spinner" /> : "生成摘要"}
              </button>
            </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
