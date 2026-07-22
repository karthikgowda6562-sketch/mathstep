import { InlineMath, BlockMath } from "react-katex";
import { Fragment } from "react";

// Detects LaTeX-ish commands that should be rendered by KaTeX even if the
// model forgot to wrap them in $...$ delimiters.
const LATEX_PATTERN =
  /\\(frac|dfrac|tfrac|sqrt|sum|int|prod|lim|log|ln|sin|cos|tan|cot|sec|csc|times|cdot|div|pm|mp|leq|geq|neq|approx|infty|pi|theta|alpha|beta|gamma|delta|left|right|begin|end|text|mathrm|overline|underline|vec)\b|\^\{|_\{/;

function normalizeDelimiters(text: string): string {
  // Convert \(...\) → $...$ and \[...\] → $$...$$
  return text
    .replace(/\\\[([\s\S]+?)\\\]/g, (_, m) => `$$${m}$$`)
    .replace(/\\\(([\s\S]+?)\\\)/g, (_, m) => `$${m}$`);
}

function renderInline(chunk: string, keyPrefix: string) {
  // First split on $...$ (single-dollar inline)
  const parts = chunk.split(/(\$[^$\n]+\$)/g);
  return parts.map((p, j) => {
    if (p.startsWith("$") && p.endsWith("$") && p.length > 2) {
      try {
        return <InlineMath key={`${keyPrefix}-${j}`} math={p.slice(1, -1)} />;
      } catch {
        return <span key={`${keyPrefix}-${j}`}>{p}</span>;
      }
    }
    // Fallback: if this plain-text piece still contains bare LaTeX commands
    // (e.g. the model returned "\frac{4}{56}" without $), render the LaTeX-y
    // substrings via KaTeX so we don't display raw backslash source.
    if (LATEX_PATTERN.test(p)) {
      try {
        return <InlineMath key={`${keyPrefix}-${j}`} math={p} />;
      } catch {
        return <span key={`${keyPrefix}-${j}`}>{p}</span>;
      }
    }
    return <span key={`${keyPrefix}-${j}`}>{p}</span>;
  });
}

// Render text that may contain $...$ inline, $$...$$ block, or \( \) / \[ \]
// LaTeX. Falls back to rendering bare \command sequences via KaTeX too.
export function MathText({ text, className }: { text: string; className?: string }) {
  if (!text) return null;
  const normalized = normalizeDelimiters(text);
  const blockParts = normalized.split(/(\$\$[\s\S]+?\$\$)/g);
  return (
    <span className={className}>
      {blockParts.map((chunk, i) => {
        if (chunk.startsWith("$$") && chunk.endsWith("$$")) {
          try {
            return <BlockMath key={i} math={chunk.slice(2, -2)} />;
          } catch {
            return <span key={i}>{chunk}</span>;
          }
        }
        return <Fragment key={i}>{renderInline(chunk, String(i))}</Fragment>;
      })}
    </span>
  );
}
