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
  stagedHistory?: string[]
  recommendations?: Array<{ title: string; author: string; type: string; reason: string }>
}

export default function RecordsPage() {
  const [records, setRecords] = useState<RecordItem[]>([])

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

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">阅读记录</h1>
        <div className="flex items-center gap-2">
          <Link href="/" className="px-3 py-1.5 border rounded">返回首页</Link>
          {records.length > 0 && (
            <button className="px-3 py-1.5 border rounded" onClick={clearAll}>清空全部</button>
          )}
        </div>
      </div>

      {records.length === 0 ? (
        <div className="p-4 border rounded bg-white text-gray-600">暂无记录</div>
      ) : (
        <div className="space-y-4">
          {records.map((r, i) => (
            <div key={r.ts + "-" + i} className="border rounded bg-white p-4 space-y-3">
              <div className="flex items-center justify-between text-sm text-gray-600">
                <div>{new Date(r.ts).toLocaleString()}</div>
                <div>阶段：{r.stage || "-"}｜评分：{r.score ?? "-"}</div>
              </div>
              {r.url && (
                <div className="text-sm">
                  文章链接：<a className="text-blue-600 underline" href={r.url} target="_blank" rel="noreferrer">{r.url}</a>
                </div>
              )}
              <div className="text-sm text-gray-700">
                <div className="font-medium mb-1">文章摘要</div>
                <div className="whitespace-pre-wrap">{r.articleSummary || "无"}</div>
              </div>
              <div className="text-sm text-gray-700">
                <div className="font-medium mb-1">对话摘要</div>
                <div className="whitespace-pre-wrap">{r.dialogueSummary || "无"}</div>
              </div>
              {Array.isArray(r.stagedHistory) && (
                <div className="text-sm">
                  <details>
                    <summary className="cursor-pointer">查看思考对话</summary>
                    <div className="mt-2 space-y-1">
                      {r.stagedHistory.map((m: string, idx: number) => (
                        <div key={idx} className="text-xs">
                          {(idx % 2 === 0 ? "我：" : "AI：") + m}
                        </div>
                      ))}
                    </div>
                  </details>
                </div>
              )}
              {Array.isArray(r.recommendations) && r.recommendations.length > 0 && (
                <div className="text-sm">
                  <div className="font-medium mb-1">推荐阅读/作者</div>
                  <ul className="list-disc pl-5 space-y-1">
                    {r.recommendations.map((rec, idx) => (
                      <li key={idx}>
                        <span className="font-medium">{rec.title}</span>
                        {rec.author ? <span className="text-gray-700">（{rec.author}）</span> : null}
                        <span className="text-gray-500"> · {rec.type}</span>
                        <span className="text-gray-600"> · {rec.reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              <div className="flex items-center justify-end">
                <button className="px-3 py-1.5 border rounded" onClick={() => remove(i)}>删除</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
