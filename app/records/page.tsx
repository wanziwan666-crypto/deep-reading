"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

type RecordItem = {
  ts: number
  article: string
  url?: string
  title?: string
  articleSummary: string
  dialogueSummary: string
  stage?: string
  score?: number
  stagedHistory?: string[]
  recommendations?: Array<{ title: string; author: string; type: string; reason: string }>
}

export default function RecordsPage() {
  const [records, setRecords] = useState<RecordItem[]>([])
  const [selectedIndex, setSelectedIndex] = useState<number>(0)
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false)
  const [tip, setTip] = useState<string>("")
  const fileInputId = "import-records-input"

  const mergeByTs = (base: RecordItem[], incoming: RecordItem[]) => {
    const map = new Map<number, RecordItem>()
    for (const r of base) map.set(Number(r?.ts) || 0, r)
    for (const r of incoming) {
      if (r && typeof r.ts === "number" && r.articleSummary && r.dialogueSummary) {
        map.set(Number(r.ts) || 0, r)
      }
    }
    return Array.from(map.values()).sort((a, b) => (b.ts || 0) - (a.ts || 0))
  }

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const raw = window.localStorage.getItem("reading_records") || "[]"
      const arr = JSON.parse(raw)
      if (Array.isArray(arr)) {
        setRecords(arr)
        if (arr.length > 0) setSelectedIndex(0)
      }
    } catch {
      setRecords([])
    }
  }, [])

  // sanitize legacy titles that were generated from prefixed summary lines
  useEffect(() => {
    if (typeof window === "undefined") return
    if (!Array.isArray(records) || records.length === 0) return
    const clean = (t: string) =>
      String(t || "")
        .replace(/^\s*(核心论点(是)?|主要理由|主要证据|可能局限|要点|结论|摘要|概括)\s*[:：]\s*/g, "")
        .trim()
    let changed = false
    const next = records.map((r) => {
      const title = clean(r.title || "")
      const artSum = clean(r.articleSummary || "")
      if (title !== (r.title || "") || artSum !== (r.articleSummary || "")) {
        changed = true
        return { ...r, title, articleSummary: artSum }
      }
      return r
    })
    if (changed) {
      setRecords(next)
      try {
        window.localStorage.setItem("reading_records", JSON.stringify(next))
      } catch {}
    }
  }, [records])

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
    return d.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Shanghai"
    })
  }

  return (
    <div className="min-h-screen bg-[var(--bg-secondary)]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[var(--accent-light)] border-b border-[var(--accent)]/20 shadow-sm">
        <div className="w-full px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 ml-2 md:ml-4">
            <Link
              href="/?view=input"
              className="btn btn-ghost text-sm"
              onClick={(e) => {
                try {
                  if (typeof window !== "undefined") {
                    window.localStorage.setItem("prefer_home_input", "1")
                  }
                } catch {}
              }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              返回
            </Link>
            <h1 className="text-xl font-semibold">阅读记录</h1>
          </div>
          <div className="flex items-center gap-2 mr-4 md:mr-6">
            <button
              className="btn btn-secondary text-xs"
              onClick={() => {
                try {
                  const data = JSON.stringify(records, null, 2)
                  const blob = new Blob([data], { type: "application/json" })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement("a")
                  const ts = new Date().toISOString().slice(0, 10).replace(/-/g, "")
                  a.href = url
                  a.download = `reading_records_${ts}.json`
                  document.body.appendChild(a)
                  a.click()
                  document.body.removeChild(a)
                  URL.revokeObjectURL(url)
                } catch {
                  setTip("导出失败")
                  setTimeout(() => setTip(""), 2000)
                }
              }}
            >
              导出 JSON
            </button>
            <label className="btn btn-ghost text-xs cursor-pointer" htmlFor={fileInputId}>
              导入 JSON
            </label>
            <input
              id={fileInputId}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={async (e) => {
                try {
                  const f = e.target.files?.[0]
                  if (!f) return
                  const text = await f.text()
                  const arr = JSON.parse(text)
                  if (!Array.isArray(arr)) throw new Error("bad")
                  const merged = mergeByTs(records, arr as RecordItem[])
                  setRecords(merged)
                  if (typeof window !== "undefined") {
                    window.localStorage.setItem("reading_records", JSON.stringify(merged))
                  }
                  setTip("已导入并合并")
                  setTimeout(() => setTip(""), 2000)
                } catch {
                  setTip("导入失败：格式不正确")
                  setTimeout(() => setTip(""), 2500)
                } finally {
                  e.currentTarget.value = ""
                }
              }}
            />
            {records.length > 0 && (
              <button className="btn btn-ghost text-sm text-red-600" onClick={clearAll}>
                清空
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="w-full px-6 py-6">
        {tip && <div className="mb-3 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">{tip}</div>}
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
          <div className="md:flex md:gap-4">
            <div className={`card p-3 md:p-4 mb-4 md:mb-0 ${sidebarCollapsed ? "md:w-14" : "md:w-80"} transition-all`}>
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-[var(--text-secondary)]">阅读记录</div>
                <button className="btn btn-ghost text-xs" onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>
                  <svg className={`w-4 h-4 text-[var(--text-tertiary)] ${sidebarCollapsed ? "" : "rotate-180"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
              {!sidebarCollapsed && (
                <div className="space-y-2 overflow-y-scroll max-h-[calc(100vh-6rem)] pr-1">
                  {records.map((r, i) => {
                    const clean = (s: string) =>
                      String(s || "").replace(/^\s*(核心论点(是)?|主要理由|主要证据|可能局限|要点|结论|摘要|概括)\s*[:：]\s*/g, "").trim()
                    const summaryHead = String(r.dialogueSummary || "").replace(/用户/g, "你").split(/[\n。.!?]/)[0] || ""
                    const title = clean(summaryHead).slice(0, 40) || clean((r.articleSummary || "").split(/[\n。.!?]/)[0] || "").slice(0, 40) || (r.article || "").slice(0, 40) || "未命名文章"
                    const active = i === selectedIndex
                    return (
                      <button
                        key={`item-${r.ts}-${i}`}
                        className={`w-full text-left p-3 rounded-lg border ${active ? "bg-[var(--accent-light)] border-[var(--accent)]/30" : "bg-[var(--bg-secondary)] border-[var(--border)] hover:bg-[var(--bg-tertiary)]"}`}
                        onClick={() => setSelectedIndex(i)}
                        title={title}
                      >
                        <div className="text-sm font-semibold truncate">{title}</div>
                        <div className="text-xs text-[var(--text-tertiary)] mt-0.5">{formatDate(r.ts)}</div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
            <div className="flex-1">
              <div className="card p-4">
                {(() => {
                  const r = records[selectedIndex]
                  if (!r) return null
                  return (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="badge badge-gray">{formatDate(r.ts)}</span>
                          <span className="font-semibold text-[var(--text-primary)] truncate">{(r.title && r.title.trim()) || "未命名文章"}</span>
                          {r.url && (
                            <a href={r.url} target="_blank" rel="noreferrer noopener" className="text-xs text-[#2563eb] underline">
                              查看原文
                            </a>
                          )}
                        </div>
                        <button className="btn btn-ghost text-sm text-red-600" onClick={() => remove(selectedIndex)}>
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
                            {r.recommendations.map((rec, idx) => (
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
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
