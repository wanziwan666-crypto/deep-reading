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
  const bmButtonRef = useRef<HTMLButtonElement>(null)
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
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold text-[var(--text-primary)]">深度阅读</h1>
            <img
              src="/deep-reading-logo.png"
              alt="Deep Reading"
              className="h-6 w-auto"
            />
          </div>
          <div className="flex items-center gap-2">
            <Link href="/records" className="btn btn-ghost text-sm">
              阅读记录
            </Link>
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
      <main className="mx-auto px-6 py-8 space-y-4 max-w-3xl md:max-w-4xl lg:max-w-5xl xl:max-w-6xl">
        {bmTip && (
          <div className="mb-3 px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-xs text-green-700">
            {bmTip}
          </div>
        )}
        {/* Step 1: Article Input */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-6 h-6 rounded-full bg-[var(--accent-light)] text-[var(--accent)] text-xs font-medium flex items-center justify-center">1</span>
            <h2 className="text-sm font-medium">输入文章</h2>
          </div>

          {/* Article Input */}
          <div className="space-y-3">
            <textarea
              className="textarea h-48"
              value={article}
              onChange={(e) => setArticleInput(e.target.value)}
              placeholder="粘贴文章链接或手动粘贴正文"
            />
            <div className="flex gap-2">
              <button
                className="btn btn-secondary"
                onClick={summarizeFromText}
                disabled={!article.trim() || loadingSummary}
              >
                {loadingSummary ? <span className="spinner" /> : "生成摘要"}
              </button>
            </div>
            {summaryError && (
              <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">
                {summaryError}
              </div>
            )}
          </div>
        </div>

        {/* Step 2: Summary */}
        {summary && (
          <div className="card">
            <button
              className="collapsible-header w-full text-left"
              onClick={() => setShowSummary(!showSummary)}
            >
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[var(--accent-light)] text-[var(--accent)] text-xs font-medium flex items-center justify-center">2</span>
                <span className="section-title">文章摘要</span>
              </div>
              <span className="text-xs text-[var(--text-tertiary)]">
                {showSummary ? "收起" : "展开"}
              </span>
            </button>
            {showSummary && (
              <div className="px-5 py-4">
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                  {summary}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Thought Input */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-600 text-xs font-medium flex items-center justify-center">3</span>
            <h2 className="text-sm font-medium">表达你的想法</h2>
          </div>
          <p className="text-sm text-[var(--text-tertiary)] mb-4">
            写下你对这篇文章的直觉、感受或初步观点，AI 教练会帮你深化思考
          </p>
          <textarea
            className="textarea h-32 mb-4"
            value={thought}
            onChange={(e) => setThought(e.target.value)}
            placeholder="读完这篇文章后，你的第一反应是什么？"
          />
          <button
            className="btn btn-primary"
            onClick={sendThought}
            disabled={!article.trim() || !thought.trim() || loadingSummary || loadingSend}
          >
            {loadingSend ? (
              <span className="spinner" />
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                开始思考对话
              </>
            )}
          </button>
        </div>

        {/* Tips */}
        <div className="card p-5">
          <h3 className="text-sm font-medium mb-3">使用提示</h3>
          <ul className="space-y-3">
            <li className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-[var(--accent-light)] text-[var(--accent)] text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="text-sm text-[var(--text-secondary)]">
                <span className="font-medium text-[var(--text-primary)]">粘贴文章链接</span>
                <span className="text-[var(--text-tertiary)]"> — 自动获取并总结文章内容</span>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-purple-50 text-purple-600 text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="text-sm text-[var(--text-secondary)]">
                <span className="font-medium text-[var(--text-primary)]">思考对话</span>
                <span className="text-[var(--text-tertiary)]"> — AI 通过提问引导你深化观点、举出例子、接受挑战</span>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-green-50 text-green-600 text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="text-sm text-[var(--text-secondary)]">
                <span className="font-medium text-[var(--text-primary)]">保存记录</span>
                <span className="text-[var(--text-tertiary)]"> — 结束后保存对话，获得个性化阅读推荐</span>
              </div>
            </li>
          </ul>
        </div>
      </main>
    </div>
  )
}
