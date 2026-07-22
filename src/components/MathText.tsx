import katex from "katex";
import { Fragment } from "react";

// Detects LaTeX-ish commands that should be rendered by KaTeX even if the
// model forgot to wrap them in $...$ delimiters.
const LATEX_PATTERN =
  /\\(frac|dfrac|tfrac|sqrt|sum|int|prod|lim|log|ln|sin|cos|tan|cot|sec|csc|times|cdot|div|pm|mp|leq|geq|neq|approx|infty|pi|theta|alpha|beta|gamma|delta|left|right|begin|end|text|mathrm|overline|underline|vec)\b|\^\{|_\{/;

const BRACED = String.raw`\{[^{}]+\}`;
const FRAC = String.raw`\\(?:frac|dfrac|tfrac)\s*(?:${BRACED}\s*${BRACED}|[A-Za-z0-9]{2,})`;
const SQRT = String.raw`\\sqrt\s*(?:${BRACED}|[A-Za-z0-9]+)`;
const TOKEN = String.raw`(?:${FRAC}|${SQRT}|[-+]?\d+(?:\.\d+)?(?:\s*\^\s*(?:${BRACED}|[-+]?\d+))?|[A-Za-z](?:\s*\^\s*(?:${BRACED}|[-+]?\d+))?(?:\s*_\s*(?:${BRACED}|\d+))?|\([^()]+\))`;
const OPERATOR = String.raw`(?:=|≈|\\times|\\cdot|\\div|[+\-−*/^])`;
const BARE_MATH_RUN = new RegExp(
  String.raw`${TOKEN}(?:\s*${OPERATOR}\s*${TOKEN})+|${FRAC}|${SQRT}`,
  "g",
);

function shouldDebug(text: string): boolean {
  return Boolean(import.meta.env.DEV && /\\begin|\\frac|\\times|\\div|\$/.test(text));
}

function debugMathText(message: string, payload: unknown) {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.debug(`[MathText] ${message}`, payload);
  }
}

function stripAlignMarkers(line: string): string {
  return line
    .replace(/&/g, "")
    .replace(/\\notag\b/g, "")
    .replace(/\\tag\s*\{[^{}]*\}/g, "")
    .trim();
}

function normalizeUnsupportedEnvironments(text: string): string {
  return text.replace(
    /(\$\$)?\s*\\begin\{(align\*?|aligned|gather\*?|gathered)\}([\s\S]*?)\\end\{\2\}\s*(\$\$)?/g,
    (_, _open: string | undefined, _env: string, body: string) => {
      const lines = body
        .split(/\\\\/g)
        .map(stripAlignMarkers)
        .filter(Boolean);
      return lines.map((line) => `$$${line}$$`).join("\n");
    },
  );
}

function removeAdjacentDuplicateMath(text: string): string {
  let cleaned = text;
  for (let i = 0; i < 4; i += 1) {
    const next = cleaned
      .replace(/\$\s*([^$\n]+?)\s*\$\s*\1\b/g, (_m, math: string) => `$${math.trim()}$`)
      .replace(/\$\$\s*([^$]+?)\s*\$\$\s*\1\b/g, (_m, math: string) => `$$${math.trim()}$$`);
    if (next === cleaned) break;
    cleaned = next;
  }
  return cleaned;
}

function normalizeDelimiters(text: string): string {
  // Convert \(...\) → $...$ and \[...\] → $$...$$
  return removeAdjacentDuplicateMath(normalizeUnsupportedEnvironments(text))
    .replace(/\\\[([\s\S]+?)\\\]/g, (_, m) => `$$${m}$$`)
    .replace(/\\\(([\s\S]+?)\\\)/g, (_, m) => `$${m}$`);
}

function renderKatex(math: string, key: string, displayMode = false) {
  const normalizedMath = stripAlignMarkers(math).trim();
  if (!normalizedMath) return null;

  const html = katex.renderToString(normalizedMath, {
    displayMode,
    throwOnError: false,
    strict: "ignore",
    trust: false,
  });

  if (import.meta.env.DEV && LATEX_PATTERN.test(normalizedMath)) {
    debugMathText("katex.renderToString", { math: normalizedMath, displayMode });
  }

  return (
    <span
      key={key}
      className={displayMode ? "my-2 block overflow-x-auto" : undefined}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function renderBareMathInText(text: string, keyPrefix: string) {
  const nodes = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  BARE_MATH_RUN.lastIndex = 0;

  while ((match = BARE_MATH_RUN.exec(text)) != null) {
    const raw = match[0];
    const start = match.index;
    const end = start + raw.length;

    if (start > lastIndex) {
      nodes.push(<span key={`${keyPrefix}-text-${lastIndex}`}>{text.slice(lastIndex, start)}</span>);
    }
    nodes.push(renderKatex(raw, `${keyPrefix}-math-${start}`));
    lastIndex = end;
  }

  if (lastIndex < text.length) {
    nodes.push(<span key={`${keyPrefix}-text-${lastIndex}`}>{text.slice(lastIndex)}</span>);
  }

  return nodes.length ? nodes : [<span key={`${keyPrefix}-text`}>{text}</span>];
}

function renderInline(chunk: string, keyPrefix: string) {
  // Split on explicit $...$ inline math first; then look for bare LaTeX/math runs
  // inside the surrounding text instead of sending whole English sentences to KaTeX.
  const parts = chunk.split(/(\$[^$\n]+\$)/g);
  return parts.flatMap((part, j) => {
    if (part.startsWith("$") && part.endsWith("$") && part.length > 2) {
      const math = part.slice(1, -1).trim();
      const nextPlain = parts[j + 1] ?? "";
      if (nextPlain.trimStart().startsWith(math)) {
        parts[j + 1] = nextPlain.replace(new RegExp(`^\\s*${escapeRegExp(math)}\\b`), "");
      }
      return [renderKatex(math, `${keyPrefix}-${j}`)];
    }
    if (LATEX_PATTERN.test(part) || BARE_MATH_RUN.test(part)) {
      BARE_MATH_RUN.lastIndex = 0;
      return renderBareMathInText(part, `${keyPrefix}-${j}`);
    }
    BARE_MATH_RUN.lastIndex = 0;
    return [<span key={`${keyPrefix}-${j}`}>{part}</span>];
  });
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Render text that may contain $...$ inline, $$...$$ block, or \( \) / \[ \]
// LaTeX. Falls back to rendering bare \command sequences via KaTeX too.
export function MathText({ text, className }: { text: string; className?: string }) {
  if (!text) return null;
  const normalized = normalizeDelimiters(text);
  if (shouldDebug(text)) {
    debugMathText("raw/normalized", { raw: text, normalized });
  }
  const blockParts = normalized.split(/(\$\$[\s\S]+?\$\$)/g);
  return (
    <span className={className}>
      {blockParts.map((chunk, i) => {
        if (chunk.startsWith("$$") && chunk.endsWith("$$")) {
          return renderKatex(chunk.slice(2, -2), String(i), true);
        }
        return <Fragment key={i}>{renderInline(chunk, String(i))}</Fragment>;
      })}
    </span>
  );
}
