"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { getState, setState, resetConversation } from "../state/conversationState"

export default function Page() {
  const [article, setArticleInput] = useState("")
  const [summary, setSummary] = useState("")
  const [showSummary, setShowSummary] = useState(true)
  const [summaryError, setSummaryError] = useState("")
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [loadingSend, setLoadingSend] = useState(false)
  const [thought, setThought] = useState("")
  const [bmTip, setBmTip] = useState("")
  const [showBmTooltip, setShowBmTooltip] = useState(false)
  const [records, setRecords] = useState<any[]>([])
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [selectedRecordIndex, setSelectedRecordIndex] = useState<number | null>(null)
  const bmButtonRef = useRef<HTMLButtonElement>(null)
  const selectionLockedRef = useRef(false)
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
    return d.toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
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

  const sendThought = async () => {
    if (!article.trim() || !thought.trim()) return
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
      s2.stagedHistory = [thought.trim(), data.aiMessage ?? ""].filter(Boolean)
      s2.currentStage = data.stage ?? ""
      s2.currentRound = data.round ?? 1
      s2.lastScore = data.score ?? null
      s2.lastScoreReason = data.scoreReason ?? ""
      setState(s2)
      setThought("")
      router.push("/chat")
    } finally {
      setLoadingSend(false)
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg-secondary)]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[var(--accent-light)] border-b border-[var(--accent)]/20 shadow-sm">
        <div className="w-full px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 ml-2 md:ml-4">
            <h1 className="text-xl md:text-2xl font-semibold text-[var(--text-primary)]">深度阅读</h1>
            <img
              src="/deep-reading-logo.png"
              alt="Deep Reading"
              className="h-9 w-auto"
            />
          </div>
          <div className="flex items-center gap-2 mr-4 md:mr-6">
            {selectedRecordIndex !== null && (
              <button
                className="btn btn-ghost text-sm"
                onClick={() => setSelectedRecordIndex(null)}
              >
                返回输入
              </button>
            )}
            
            <div className="relative">
              <button
                ref={bmButtonRef}
                className="btn btn-ghost text-sm"
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
            <div className="card p-3 md:p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-[var(--text-secondary)]">阅读记录</div>
                <button className="btn btn-ghost text-xs" onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>
                  <svg className={`w-4 h-4 text-[var(--text-tertiary)] ${sidebarCollapsed ? "" : "rotate-180"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
              {!sidebarCollapsed && (
                <div className="space-y-2">
                  {records.slice(0, 50).map((r, i) => {
                    const title = cleanTitle(r.title || "") || cleanTitle((r.articleSummary || "").split(/[\n。.!?]/)[0] || "").slice(0, 40) || (r.article || "").slice(0, 40) || "未命名文章"
                    const active = selectedRecordIndex === i
                    return (
                      <button
                        key={`r-${r.ts}-${i}`}
                        className={`w-full text-left p-3 rounded-lg border ${active ? "bg-[var(--accent-light)] border-[var(--accent)]/30" : "bg-[var(--bg-secondary)] border-[var(--border)] hover:bg-[var(--bg-tertiary)]"}`}
                        title={title}
                        onClick={() => setSelectedRecordIndex(i)}
                      >
                        <div className="text-sm font-semibold truncate">{title}</div>
                        <div className="text-xs text-[var(--text-tertiary)] mt-0.5">{formatDate(r.ts)}</div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
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
                          <p className="text-sm text-[var(--text-primary)]">{r.dialogueSummary}</p>
                        </div>
                      )}
                      {(r.stagedHistory?.length || r.frictionHistory?.length) && (
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
                            {r.frictionHistory?.map((m: string, idx: number) => (
                              <div key={`friction-${idx}`} className={`p-3 rounded-lg text-sm ${idx % 2 === 0 ? "bg-blue-50" : "bg-white"}`}>
                                <span className="text-[var(--text-tertiary)] text-xs font-medium">{idx % 2 === 0 ? "AI" : "你"}</span>
                                <p className="mt-1 leading-relaxed">{m}</p>
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                      {(r.claim || r.premise) && (
                        <div className="flex flex-wrap gap-2">
                          {r.claim && (
                            <div className="text-xs bg-[var(--bg-secondary)] px-3 py-2 rounded-lg">
                              <span className="text-[var(--text-tertiary)]">主张：</span>
                              <span className="text-[var(--text-secondary)]">{r.claim}</span>
                            </div>
                          )}
                          {r.premise && (
                            <div className="text-xs bg-[var(--bg-secondary)] px-3 py-2 rounded-lg">
                              <span className="text-[var(--text-tertiary)]">前提：</span>
                              <span className="text-[var(--text-secondary)]">{r.premise}</span>
                            </div>
                          )}
                        </div>
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
                <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-6 h-6 rounded-full bg-[var(--accent-light)] text-[var(--accent)] text-xs font-medium flex items-center justify-center">1</span>
                <h2 className="text-sm font-medium">输入文章</h2>
              </div>
              <div className="space-y-3">
                <textarea className="textarea h-48" value={article} onChange={(e) => setArticleInput(e.target.value)} placeholder="粘贴文章链接或手动粘贴正文" />
                <div className="flex gap-2">
                  <button className="btn btn-secondary" onClick={summarizeFromText} disabled={!article.trim() || loadingSummary}>
                    {loadingSummary ? <span className="spinner" /> : "生成摘要"}
                  </button>
                </div>
                {summaryError && <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">{summaryError}</div>}
              </div>
                </div>
                {summary && (
                  <div className="card">
                    <button className="collapsible-header w-full text-left" onClick={() => setShowSummary(!showSummary)}>
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-[var(--accent-light)] text-[var(--accent)] text-xs font-medium flex items-center justify-center">2</span>
                        <span className="section-title">文章摘要</span>
                      </div>
                      <span className="text-xs text-[var(--text-tertiary)]">{showSummary ? "收起" : "展开"}</span>
                    </button>
                    {showSummary && (
                      <div className="px-5 py-4">
                        <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{summary}</p>
                      </div>
                    )}
                  </div>
                )}
                <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-600 text-xs font-medium flex items-center justify-center">3</span>
                <h2 className="text-sm font-medium">表达你的想法</h2>
              </div>
              <p className="text-sm text-[var(--text-tertiary)] mb-4">写下你对这篇文章的直觉、感受或初步观点，AI 教练会帮你深化思考</p>
              <textarea className="textarea h-32 mb-4" value={thought} onChange={(e) => setThought(e.target.value)} placeholder="读完这篇文章后，你的第一反应是什么？" />
              <button className="btn btn-primary" onClick={sendThought} disabled={!article.trim() || !thought.trim() || loadingSummary || loadingSend}>
                {loadingSend ? <span className="spinner" /> : (<><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>开始思考对话</>)}
              </button>
                </div>
                <div className="card p-5">
              <h3 className="text-sm font-medium mb-3">使用提示</h3>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-[var(--accent-light)] text-[var(--accent)] text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  </div>
                  <div className="text-sm text-[var(--text-secondary)]">
                    <span className="font-medium text-[var(--text-primary)]">粘贴文章链接</span>
                    <span className="text-[var(--text-tertiary)]"> — 自动获取并总结文章内容</span>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-purple-50 text-purple-600 text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  </div>
                  <div className="text-sm text-[var(--text-secondary)]">
                    <span className="font-medium text-[var(--text-primary)]">思考对话</span>
                    <span className="text-[var(--text-tertiary)]"> — AI 通过提问引导你深化观点、举出例子、接受挑战</span>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-green-50 text-green-600 text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  </div>
                  <div className="text-sm text-[var(--text-secondary)]">
                    <span className="font-medium text-[var(--text-primary)]">保存记录</span>
                    <span className="text-[var(--text-tertiary)]"> — 结束后保存对话，获得个性化阅读推荐</span>
                  </div>
                </li>
              </ul>
                </div>
              </>
            )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
