import { memo, type ReactNode } from 'react'
import { renderToString } from 'katex'
import 'katex/dist/katex.min.css'

type FormulaTextProps = {
  children?: ReactNode
  className?: string
}

type FormulaSegment =
  | { kind: 'text'; value: string }
  | { kind: 'math'; value: string; display?: boolean }

const explicitMathPattern = /(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|(?<!\$)\$[^$\n]+\$)/g
const latexCommandPattern = /\\(?:frac|dfrac|tfrac|sqrt|text|mathrm|mathbf|mathit|operatorname|hat|bar|vec|overline|underline)\s*(?:\{[^{}]*\}|[A-Za-z]+)(?:\s*\{[^{}]*\})?(?:[_^]\s*(?:\{[^{}]*\}|[A-Za-z0-9]+))*|\\(?:theta|alpha|beta|gamma|delta|lambda|mu|sigma|nabla|partial|infty|pi|rho|phi|omega|sum|prod|int|cdot|times|pm|neq|leq|geq|approx|to|rightarrow|left|right)(?:[_^]\s*(?:\{[^{}]*\}|[A-Za-z0-9]+))*/g

const readableCommandMap: Record<string, string> = {
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', theta: 'θ', lambda: 'λ', mu: 'μ', sigma: 'σ',
  rho: 'ρ', phi: 'φ', omega: 'ω', pi: 'π', nabla: '∇', partial: '∂', infty: '∞',
  cdot: '·', times: '×', pm: '±', neq: '≠', leq: '≤', geq: '≥', approx: '≈',
  to: '→', rightarrow: '→', left: '←', sum: 'Σ', prod: 'Π', int: '∫',
}

function stripMathDelimiters(value: string) {
  const trimmed = value.trim()
  if (trimmed.startsWith('$$') && trimmed.endsWith('$$')) return trimmed.slice(2, -2).trim()
  if (trimmed.startsWith('$') && trimmed.endsWith('$')) return trimmed.slice(1, -1).trim()
  if (trimmed.startsWith('\\[') && trimmed.endsWith('\\]')) return trimmed.slice(2, -2).trim()
  if (trimmed.startsWith('\\(') && trimmed.endsWith('\\)')) return trimmed.slice(2, -2).trim()
  return trimmed
}

function fallbackReadable(value: string) {
  let result = stripMathDelimiters(value)
  for (let pass = 0; pass < 4; pass += 1) {
    result = result.replace(/\\(?:dfrac|tfrac|frac)\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, '($1)/($2)')
    result = result.replace(/\\(?:text|mathrm|mathbf|mathit|operatorname)\s*\{([^{}]*)\}/g, '$1')
  }
  result = result.replace(/\\left|\\right/g, '')
  result = result.replace(/\\([A-Za-z]+)/g, (_, command: string) => readableCommandMap[command] || command)
  result = result.replace(/\^\{([^{}]+)\}/g, '^$1').replace(/_\{([^{}]+)\}/g, '_$1')
  result = result.replace(/[{}]/g, '')
  return result.replace(/\s+/g, ' ').trim()
}

function tryRenderMath(value: string, display = false) {
  const expression = stripMathDelimiters(value)
  if (!expression) return ''
  try {
    return renderToString(expression, { displayMode: display, throwOnError: false, strict: 'ignore' })
  } catch {
    return `<span class="formula-fallback">${escapeHtml(fallbackReadable(expression))}</span>`
  }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] || character)
}

function hasCjk(value: string) {
  return /[\u3400-\u9fff]/.test(value)
}

function looksLikeWholeFormula(value: string) {
  const trimmed = value.trim()
  if (!trimmed || hasCjk(trimmed)) return false
  if (/\\[A-Za-z]+/.test(trimmed)) return true
  if (!/(?:=|\^|_|≤|≥|≠|≈|→|←)/.test(trimmed)) return false
  const words = trimmed.match(/[A-Za-z]+/g) || []
  return words.every(word => word.length <= 2) && words.length <= 8
}

function splitNakedMath(value: string): FormulaSegment[] {
  if (!value || !latexCommandPattern.test(value)) return [{ kind: 'text', value }]
  latexCommandPattern.lastIndex = 0
  const segments: FormulaSegment[] = []
  let cursor = 0
  let match: RegExpExecArray | null
  while ((match = latexCommandPattern.exec(value))) {
    if (match.index > cursor) segments.push({ kind: 'text', value: value.slice(cursor, match.index) })
    segments.push({ kind: 'math', value: match[0] })
    cursor = match.index + match[0].length
  }
  if (cursor < value.length) segments.push({ kind: 'text', value: value.slice(cursor) })
  return segments.length ? segments : [{ kind: 'text', value }]
}

function parseSegments(value: string): FormulaSegment[] {
  const segments: FormulaSegment[] = []
  let cursor = 0
  let match: RegExpExecArray | null
  explicitMathPattern.lastIndex = 0
  while ((match = explicitMathPattern.exec(value))) {
    if (match.index > cursor) segments.push(...parseNakedText(value.slice(cursor, match.index)))
    const token = match[0]
    segments.push({ kind: 'math', value: token, display: token.startsWith('$$') || token.startsWith('\\[') })
    cursor = match.index + token.length
  }
  if (cursor < value.length) segments.push(...parseNakedText(value.slice(cursor)))
  return segments.length ? segments : [{ kind: 'text', value }]
}

function parseNakedText(value: string): FormulaSegment[] {
  if (looksLikeWholeFormula(value)) return [{ kind: 'math', value }]
  return splitNakedMath(value)
}

/**
 * Convert the same formula tokens used by FormulaText into a safe plain-text
 * representation for canvas/SVG renderers that cannot mount KaTeX markup.
 */
export function readableFormulaText(value: string) {
  return parseSegments(String(value ?? '')).map(segment => (
    segment.kind === 'math' ? fallbackReadable(segment.value) : segment.value
  )).join('')
}

function FormulaTextImpl({ children, className }: FormulaTextProps) {
  const value = children == null ? '' : String(children)
  const segments = parseSegments(value)
  return <span className={className}>
    {segments.map((segment, index) => {
      if (segment.kind === 'math') {
        const markup = tryRenderMath(segment.value, segment.display)
        return <span key={`math-${index}`} className={`formula-text-math${segment.display ? ' is-display' : ''}`} dangerouslySetInnerHTML={{ __html: markup }} />
      }
      return <span key={`text-${index}`}>{segment.value.split('\n').map((line, lineIndex) => <span key={`${index}-${lineIndex}`}>{line}{lineIndex < segment.value.split('\n').length - 1 && <br />}</span>)}</span>
    })}
  </span>
}

export const FormulaText = memo(FormulaTextImpl)
