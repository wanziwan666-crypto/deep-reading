深度阅读（LLM Thinking MVP）

项目简介
- 以对话驱动的深度阅读与思考辅助工具
- 阶段机制：clarify / deepen / challenge / expand / wrap_up（wrap_up 不提问）
- 支持浏览器书签按钮将任意网页全文“一键发送”到对话页
- 推荐阅读结果中文化（可中英文对照书名）

快速开始
- 安装依赖
  - npm install
- 启动开发
  - 自动选择端口：npm run dev
  - 固定 3000 端口（启动前自动清理占用）：npm run dev:3000
- 类型检查与 Lint
  - npm run typecheck
  - npm run lint

环境变量
- 复制 .env.example 为 .env.local 并按需填写

核心功能
1) 书签按钮（推荐）
- 作用：在文章页面点击书签 → 新开对话页 → 将当前页面完整 HTML 通过 postMessage 发送到对话页 → 服务端抽取正文并生成摘要
- 安装方法
  - 在首页或对话页顶部点击“复制书签”
  - 浏览器书签管理中新建书签，将复制内容粘贴为“地址”
- 书签内容（域名自动适配当前环境）
  - 打开 /chat?bm=1&url=…，然后向新窗口 postMessage { html, url, title }
- 兼容策略
  - 如果 postMessage 未送达，对话页会使用 url 兜底生成摘要（仅摘要+URL，不显示全文）

2) 文章注入与摘要
- 对话页支持 3 种注入方式：
  - ?aid=…：读取 ingest 的临时全文（优先）
  - ?sel=…：直接使用所选片段（≥50 字）
  - ?url=…：服务端抓取正文并生成摘要（轻量兜底）
- wrap_up 绝不提问：输出问号会在服务端被移除

3) 只读代理预览
- 当没有全文但有 URL 时，对话页内嵌 /api/proxy-article?url=…：
  - 去脚本保留样式，优先提取正文为“文本版预览”，原页面只读预览折叠在下方
  - 某些强 JS 站点因内容由脚本注入，建议优先使用“书签按钮”推送全文

接口一览
- POST /api/ingest-article：接收 { url?, title?, html?, text? }，抽取正文，返回 { id }（内存 10 分钟）
- GET /api/ingest-article?id=…：返回临时保存的 { url, title, article }
- POST /api/summarize-article：按 URL 抓取正文，生成摘要
- POST /api/summarize-article-text：按纯文本生成摘要
- POST /api/recommend-reading：基于对话内容生成中文化推荐项
- POST /api/staged-chat：阶段对话接口（clarify/deepen/challenge/expand/wrap_up）
- GET /api/proxy-article?url=…：只读代理预览

常见问题
- Hydration 警告（开发态浏览器控制台看到 Text content does not match）：
  - 页面已将依赖 window/localStorage 的逻辑放到 useEffect；若仍出现警告，多为浏览器插件或时间戳引起，可忽略
- net::ERR_ABORTED / _rsc 日志：
  - 表示“被新导航打断”的请求取消，功能无害；已通过延后 URL 替换与首条消息在 /chat 执行降低出现概率
- 端口占用
  - npm run dev 自动选择空闲端口
  - npm run dev:3000 固定 3000 并启动前自动清理占用

Roadmap（可选）
- 为更多站点补充正文选择器
- 将首页同样提供“复制轻量书签（仅 URL）”
- 在对话页为“文章文本/原文预览”提供 Tab 切换

