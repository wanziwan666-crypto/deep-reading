"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

type RecordItem = {
  ts: number
  article: string
  url?: string
  articleSummary: string
  dialogueSummary: string
  stage?: string
  score?: number
  claim?: string
  premise?: string
  stagedHistory?: string[]
  frictionHistory?: string[]
  recommendations?: Array<{ title: string; author: string; type: string; reason: string }>
}

export default function RecordsPage() {
  const [records, setRecords] = useState<RecordItem[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const raw = window.localStorage.getItem("reading_records") || "[]"
      const arr = JSON.parse(raw)
      if (Array.isArray(arr)) setRecords(arr)
    } catch {
      setRecords([])
    }
  }, [])

  const remove = (idx: number) => {
    const arr = [...records]
    arr.splice(idx, 1)
    setRecords(arr)
    if (typeof window !== "undefined") {
      window.localStorage.setItem("reading_records", JSON.stringify(arr))
    }
  }

  const clearAll = () => {
    setRecords([])
    if (typeof window !== "undefined") {
      window.localStorage.setItem("reading_records", "[]")
    }
  }

  const formatDate = (ts: number) => {
    const d = new Date(ts)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (days === 0) return "今天"
    if (days === 1) return "昨天"
    if (days < 7) return `${days} 天前`
    return d.toLocaleDateString("zh-CN", { month: "short", day: "numeric" })
  }

  return (
    <div className="min-h-screen bg-[var(--bg-secondary)]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-sm border-b border-[var(--border-subtle)]">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="btn btn-ghost text-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              返回
            </Link>
            <h1 className="text-base font-medium">阅读记录</h1>
          </div>
          {records.length > 0 && (
            <button className="btn btn-ghost text-sm text-red-600" onClick={clearAll}>
              清空
            </button>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-6">
        {records.length === 0 ? (
          <div className="card p-12 text-center">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center">
              <svg className="w-6 h-6 text-[var(--text-tertiary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <h2 className="text-lg font-medium mb-2">暂无阅读记录</h2>
            <p className="text-sm text-[var(--text-secondary)] mb-4">
              开始阅读并保存你的思考记录
            </p>
            <Link href="/" className="btn btn-primary">
              开始阅读
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {records.map((r, i) => {
              const id = `record-${r.ts}-${i}`
              const isExpanded = expandedId === id
              return (
                <div key={id} className="card overflow-hidden">
                  {/* Header */}
                  <button
                    className="w-full p-4 text-left hover:bg-[var(--bg-secondary)]/50 transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : id)}
                  >
                        <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="badge badge-gray">{formatDate(r.ts)}</span>
                        </div>
                        {r.url && (
                          <p className="text-xs text-[#2563eb] truncate max-w-md">
                            {r.url}
                          </p>
                        )}
                        <p className="text-sm text-[var(--text-secondary)] mt-2 line-clamp-2">
                          {r.articleSummary || r.article.slice(0, 100)}
                        </p>
                      </div>
                      <svg
                        className={`w-4 h-4 text-[var(--text-tertiary)] transition-transform flex-shrink-0 ${
                          isExpanded ? "rotate-180" : ""
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="border-t border-[var(--border-subtle)] p-4 space-y-4">
                      {/* Summary */}
                      {r.articleSummary && (
                        <div>
                          <h4 className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide mb-1">
                            文章摘要
                          </h4>
                          <p className="text-sm text-[var(--text-primary)]">{r.articleSummary}</p>
                        </div>
                      )}

                      {r.dialogueSummary && (
                        <div>
                          <h4 className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide mb-1">
                            对话摘要
                          </h4>
                          <p className="text-sm text-[var(--text-primary)]">{r.dialogueSummary}</p>
                        </div>
                      )}

                      {/* Dialogue History */}
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
                              <div
                                key={`staged-${idx}`}
                                className={`p-3 rounded-lg text-sm ${
                                  idx % 2 === 0
                                    ? "bg-white"
                                    : "bg-blue-50"
                                }`}
                              >
                                <span className="text-[var(--text-tertiary)] text-xs font-medium">
                                  {idx % 2 === 0 ? "你" : "AI"}
                                </span>
                                <p className="mt-1 leading-relaxed">{m}</p>
                              </div>
                            ))}
                            {r.frictionHistory?.map((m: string, idx: number) => (
                              <div
                                key={`friction-${idx}`}
                                className={`p-3 rounded-lg text-sm ${
                                  idx % 2 === 0
                                    ? "bg-blue-50"
                                    : "bg-white"
                                }`}
                              >
                                <span className="text-[var(--text-tertiary)] text-xs font-medium">
                                  {idx % 2 === 0 ? "AI" : "你"}
                                </span>
                                <p className="mt-1 leading-relaxed">{m}</p>
                              </div>
                            ))}
                          </div>
                        </details>
                      )}

                      {/* Claim & Premise */}
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

                      {/* Recommendations */}
                      {Array.isArray(r.recommendations) && r.recommendations.length > 0 && (
                        <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-5 mt-6">
                          <div className="flex items-center gap-2 mb-4">
                            <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                            </svg>
                            <h4 className="text-base font-semibold text-amber-900">推荐阅读</h4>
                          </div>
                          <ul className="space-y-3">
                            {r.recommendations.map((rec, idx) => (
                              <li key={idx} className="bg-white/80 backdrop-blur-sm border border-amber-100 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex items-start gap-3">
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

                      {/* Actions */}
                      <div className="flex justify-end pt-2 border-t border-[var(--border-subtle)]">
                        <button
                          className="btn btn-ghost text-sm text-red-600"
                          onClick={() => remove(i)}
                        >
                          删除
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
