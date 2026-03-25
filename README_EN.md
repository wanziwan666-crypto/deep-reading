Deep Reading (LLM Thinking MVP)

Overview
- A dialogue-driven assistant for deep reading and critical thinking
- Stage engine: clarify / deepen / challenge / expand / wrap_up (wrap_up asks no questions)
- One‑click Bookmarklet to send the full web page content into the chat
- Recommendations presented in Chinese (book titles can show bilingual names)

Quick Start
- Install
  - npm install
- Development
  - Auto free port: npm run dev
  - Fixed 3000 (auto kill occupier before start): npm run dev:3000
- Typecheck & Lint
  - npm run typecheck
  - npm run lint

Env Vars
- Copy .env.example to .env.local and fill in as needed

Core Features
1) Bookmarklet (Recommended)
- Purpose: On any article page → click bookmark → opens your chat page → sends full HTML to the chat window via postMessage → server extracts main text and generates a summary
- Install
  - Click “Copy Bookmarklet” on the Home or Chat page
  - Create a new browser bookmark and paste the copied content as the URL
- Behavior (domain auto‑adapts to current origin)
  - Opens /chat?bm=1&url=… and then postMessage { html, url, title } to the new window
- Compatibility
  - If postMessage fails, the chat page falls back to url-only summary (stores only summary + URL, not the full text)

2) Article Injection & Summary
- The chat page supports 3 injection modes:
  - ?aid=…: fetches a temporary full article from ingest (preferred)
  - ?sel=…: uses selected snippet (≥ 50 chars)
  - ?url=…: server fetches and summarizes (lightweight fallback)
- wrap_up never asks a question: any question mark will be removed by server-side post-processing

3) Read‑Only Proxy Preview
- When there’s no full text but a URL exists, the chat page embeds /api/proxy-article?url=…:
  - Scripts removed, styles kept; extracts the main content as a “text preview”, with the raw page in a collapsible section
  - For heavy client‑rendered sites, prefer the Bookmarklet for best fidelity

API Endpoints
- POST /api/ingest-article: accept { url?, title?, html?, text? }, extract main text, return { id } (in-memory, 10 min TTL)
- GET /api/ingest-article?id=…: return { url, title, article } for the temporary record
- POST /api/summarize-article: fetch by URL and summarize
- POST /api/summarize-article-text: summarize plain text
- POST /api/recommend-reading: generate Chinese recommendations based on dialogue
- POST /api/staged-chat: stage-based coaching (clarify/deepen/challenge/expand/wrap_up)
- GET /api/proxy-article?url=…: read‑only proxy preview

Troubleshooting
- Hydration warnings:
  - Client-only logic moved into useEffect; if warnings still show up, it’s usually due to extensions or timestamps and can be ignored in dev
- net::ERR_ABORTED / _rsc logs:
  - Means “request canceled by new navigation”; functionally harmless. We delay URL replacements and send the first message on /chat to reduce occurrences
- Port conflicts
  - npm run dev auto-selects a free port
  - npm run dev:3000 fixes port 3000 and auto-kills listeners before start

Roadmap (Optional)
- Add more site‑specific selectors for content extraction
- Provide a “URL‑only” lightweight bookmarklet on Home
- Tab switch for “Article Text / Original Preview” on the chat page

