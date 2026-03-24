"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { getState, setState, resetConversation } from "../state/conversationState"

export default function Page() {
  const [article, setArticleInput] = useState("")
  const [url, setUrl] = useState("")
  const [summary, setSummary] = useState("")
  const [showSummary, setShowSummary] = useState(true)
  const [summaryError, setSummaryError] = useState("")
  const [showManual, setShowManual] = useState(false)
  const [loading, setLoading] = useState(false)
  const [thought, setThought] = useState("")
  const router = useRouter()

  const summarizeFromUrl = async () => {
    if (!url.trim()) return
    setLoading(true)
    try {
      setSummaryError("")
      const res = await fetch("/api/summarize-article", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() })
      })
      const data = await res.json()
      if (data.error) {
        if (data.error === "verification_required") {
          setSummaryError("目标页面需要验证（如人机验证/安全校验），无法自动抓取。请完成验证后再试，或手动粘贴正文。")
          setShowManual(true)
          setSummary("")
          return
        }
        setSummaryError("抓取失败，请稍后重试或手动粘贴正文。")
        setShowManual(true)
        setSummary("")
        return
      }
      const art = String(data.article || "")
      const sum = String(data.articleSummary || "")
      setArticleInput(art)
      setSummary(sum)
      setShowSummary(true)
      const s = getState()
      s.article = art
      s.articleUrl = url.trim()
      s.articleSummary = sum
      setState(s)
    } finally {
      setLoading(false)
    }
  }

  const summarizeFromText = async () => {
    if (!article.trim()) return
    setLoading(true)
    try {
      setSummaryError("")
      const res = await fetch("/api/summarize-article-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ article: article.trim() })
      })
      const data = await res.json()
      if (data.error) {
        setSummaryError("生成摘要失败，请检查正文是否完整。")
        return
      }
      setSummary(String(data.articleSummary || ""))
      setShowSummary(true)
      const s = getState()
      s.article = article.trim()
      s.articleSummary = String(data.articleSummary || "")
      setState(s)
    } finally {
      setLoading(false)
    }
  }

  const sendThought = async () => {
    if (!article.trim() || !thought.trim()) return
    setLoading(true)
    try {
      resetConversation()
      const s = getState()
      s.article = article
      s.articleSummary = summary
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
      s2.articleSummary = summary
      s2.stagedHistory = [thought.trim(), data.aiMessage ?? ""].filter(Boolean)
      s2.currentStage = data.stage ?? ""
      s2.currentRound = data.round ?? 1
      s2.lastScore = data.score ?? null
      s2.lastScoreReason = data.scoreReason ?? ""
      setState(s2)
      setThought("")
      router.push("/chat")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">输入文章</h1>
        <Link href="/records" className="text-sm px-3 py-1.5 border rounded">阅读记录</Link>
      </div>
      <div className="flex items-center gap-2">
        <input
          className="flex-1 p-3 border rounded-md bg-white"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="粘贴文章链接（URL）"
        />
        <button
          className="px-4 py-2 bg-blue-600 text-white rounded-md disabled:bg-gray-400"
          onClick={summarizeFromUrl}
          disabled={!url.trim() || loading}
        >
          获取并总结
        </button>
      </div>
      <div className="flex items-center gap-2">
        <button className="text-sm underline" onClick={() => setShowManual((v) => !v)}>
          或手动粘贴正文
        </button>
        {summaryError && <div className="text-sm text-red-600">{summaryError}</div>}
      </div>
      {showManual && (
        <div className="space-y-2">
          <textarea
            className="w-full h-56 p-3 border rounded-md bg-white"
            value={article}
            onChange={(e) => setArticleInput(e.target.value)}
            placeholder="在此粘贴文章正文"
          />
          <div className="flex items-center gap-2">
            <button
              className="px-3 py-1.5 bg-blue-600 text-white rounded disabled:bg-gray-400"
              onClick={summarizeFromText}
              disabled={!article.trim() || loading}
            >
              基于正文生成摘要
            </button>
          </div>
        </div>
      )}
      {summary && (
        <div className="border rounded bg-white">
          <div className="flex items-center justify-between px-3 py-2 border-b bg-gray-50">
            <div className="text-sm font-medium">文章摘要</div>
            <button className="text-sm px-2 py-1 border rounded" onClick={() => setShowSummary((v) => !v)}>
              {showSummary ? "收起" : "展开"}
            </button>
          </div>
          {showSummary && <div className="p-3 text-sm whitespace-pre-wrap">{summary}</div>}
        </div>
      )}
      

      <div className="space-y-3 pt-4">
        <h2 className="text-lg font-medium">表达你的想法与感受</h2>
        <textarea
          className="w-full p-3 border rounded-md bg-white"
          value={thought}
          onChange={(e) => setThought(e.target.value)}
          placeholder="先说说你的直觉、感受或观点"
        />
        <button
          className="px-3 py-1.5 bg-purple-600 text-white rounded disabled:bg-gray-400"
          onClick={sendThought}
          disabled={!article.trim() || !thought.trim() || loading}
        >
          发送给教练
        </button>
      </div>

      
    </div>
  )
}
