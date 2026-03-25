import { execSync } from "node:child_process"

function killByPort(port) {
  try {
    let pids = []
    // fast path
    try {
      const pidsRaw = execSync(`lsof -tiTCP:${port} -sTCP:LISTEN || true`, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim()
      if (pidsRaw) pids = pidsRaw.split(/\s+/).filter(Boolean)
    } catch {}
    // fallback grep/awk
    if (pids.length === 0) {
      try {
        const pidsRaw2 = execSync(`lsof -nP -iTCP -sTCP:LISTEN | grep ':${port} ' | awk '{print $2}' || true`, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim()
        if (pidsRaw2) pids = pidsRaw2.split(/\s+/).filter(Boolean)
      } catch {}
    }
    // fallback via pgrep next/node and verify socket
    if (pids.length === 0) {
      try {
        const cand = execSync(`pgrep -f 'next dev|node.*next' || true`, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim().split(/\s+/).filter(Boolean)
        const verified = []
        for (const pid of cand) {
          try {
            const has = execSync(`lsof -a -p ${pid} -iTCP:${port} -sTCP:LISTEN -t || true`, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim()
            if (has) verified.push(pid)
          } catch {}
        }
        if (verified.length > 0) pids = verified
      } catch {}
    }
    if (pids.length === 0) return
    const safePids = []
    for (const pid of pids) {
      try {
        const cmd = execSync(`ps -o comm= -p ${pid}`, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim().toLowerCase()
        if (process.env.FORCE_KILL === "1" || cmd.includes("node") || cmd.includes("next")) {
          safePids.push(pid)
        }
      } catch {}
    }
    if (safePids.length > 0) {
      execSync(`kill -9 ${safePids.join(" ")}`, { stdio: "ignore" })
      console.log(`[predev] Killed processes on port ${port}: ${safePids.join(", ")}`)
    }
  } catch (e) {
    // ignore
  }
}

const port = process.env.PORT ? String(process.env.PORT) : "3000"
killByPort(port)
