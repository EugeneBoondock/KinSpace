// Tiny, safe-ish Markdown → HTML renderer. Handles headings, bold, italic,
// inline code, links, lists, paragraphs, blockquotes. Escapes everything else.

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function renderInline(line: string): string {
  let output = escapeHtml(line)
  // code spans first
  output = output.replace(/`([^`]+)`/g, '<code class="rounded bg-[#eedfc8]/10 px-1 py-0.5 text-xs">$1</code>')
  // bold
  output = output.replace(/\*\*([^*]+)\*\*/g, '<strong class="text-[#eedfc8]">$1</strong>')
  // italic
  output = output.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
  // links
  output = output.replace(
    /\[([^\]]+)\]\((https?:[^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-[#D19A58] underline">$1</a>',
  )
  return output
}

export function renderMarkdown(markdown: string): string {
  const lines = markdown.split(/\r?\n/)
  const parts: string[] = []
  let listBuffer: string[] = []
  let listType: 'ul' | 'ol' | null = null
  let paragraphBuffer: string[] = []
  let quoteBuffer: string[] = []

  function flushList() {
    if (listType && listBuffer.length > 0) {
      const tag = listType
      parts.push(
        `<${tag} class="${tag === 'ul' ? 'list-disc' : 'list-decimal'} space-y-1 pl-6 text-[#eedfc8]/75">${listBuffer
          .map((item) => `<li>${item}</li>`)
          .join('')}</${tag}>`,
      )
    }
    listBuffer = []
    listType = null
  }

  function flushParagraph() {
    if (paragraphBuffer.length === 0) return
    parts.push(`<p class="text-[#eedfc8]/75 leading-relaxed">${paragraphBuffer.join(' ')}</p>`)
    paragraphBuffer = []
  }

  function flushQuote() {
    if (quoteBuffer.length === 0) return
    parts.push(
      `<blockquote class="border-l-4 border-[#D19A58]/50 bg-[#eedfc8]/4 px-4 py-2 text-[#eedfc8]/70 italic">${quoteBuffer.join(
        ' ',
      )}</blockquote>`,
    )
    quoteBuffer = []
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd()
    if (!line.trim()) {
      flushList()
      flushParagraph()
      flushQuote()
      continue
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/)
    if (headingMatch) {
      flushList()
      flushParagraph()
      flushQuote()
      const level = headingMatch[1].length
      const size = level <= 2 ? 'text-2xl font-bold' : level === 3 ? 'text-xl font-semibold' : 'text-lg font-semibold'
      parts.push(`<h${level} class="${size} text-[#eedfc8]">${renderInline(headingMatch[2])}</h${level}>`)
      continue
    }

    if (line.startsWith('> ')) {
      flushList()
      flushParagraph()
      quoteBuffer.push(renderInline(line.slice(2)))
      continue
    }

    const ulMatch = line.match(/^[-*]\s+(.*)$/)
    if (ulMatch) {
      flushParagraph()
      flushQuote()
      if (listType !== 'ul') flushList()
      listType = 'ul'
      listBuffer.push(renderInline(ulMatch[1]))
      continue
    }

    const olMatch = line.match(/^\d+\.\s+(.*)$/)
    if (olMatch) {
      flushParagraph()
      flushQuote()
      if (listType !== 'ol') flushList()
      listType = 'ol'
      listBuffer.push(renderInline(olMatch[1]))
      continue
    }

    flushList()
    flushQuote()
    paragraphBuffer.push(renderInline(line))
  }

  flushList()
  flushParagraph()
  flushQuote()

  return `<div class="space-y-4">${parts.join('')}</div>`
}
