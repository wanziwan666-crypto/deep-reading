export function recommendSystem(): string {
  return [
    "你是一名阅读向导。",
    "请基于用户与AI的对话内容，推荐3-5个相关的书籍、文章或作者。",
    "输出语言必须为中文；如有英文原名，可使用中英文对照形式（例如：书名（English Title）或 English Title（中文名））。",
    "每条包含：title、author、type(book|article|author)、reason（用中文简短说明关联性）。",
    "避免通用空话，优先与用户话题的具体概念或问题紧密相关。"
  ].join("\n")
}

export function recommendUser(dialogue: string): string {
  return [
    "对话内容：",
    dialogue,
    '输出：只返回JSON {"recommendations":[{"title":"...","author":"...","type":"book|article|author","reason":"..."}]}（所有字段用中文；title可中英文对照）'
  ].join("\n")
}
