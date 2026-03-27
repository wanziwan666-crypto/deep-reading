import fs from "fs"
import path from "path"

const DATA_DIR = path.join(process.cwd(), ".data")

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }
}

export function getRecordsPath(anonId: string) {
  ensureDir()
  const safe = anonId.replace(/[^a-zA-Z0-9_-]/g, "")
  return path.join(DATA_DIR, `records-${safe}.json`)
}

export function readRecords(anonId: string): any[] {
  try {
    const p = getRecordsPath(anonId)
    if (!fs.existsSync(p)) return []
    const raw = fs.readFileSync(p, "utf8")
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

export function writeRecords(anonId: string, arr: any[]) {
  const p = getRecordsPath(anonId)
  fs.writeFileSync(p, JSON.stringify(arr, null, 2), "utf8")
}
