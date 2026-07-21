import { evaluate } from "mathjs";

function normalizeMathInput(input: string): string {
  let text = input
    .trim()
    .replace(/\$\$?/g, "")
    .replace(/\\\(|\\\)|\\\[|\\\]/g, "")
    .replace(/\\left|\\right/g, "")
    .replace(/\\cdot|\\times/g, "*")
    .replace(/\\div/g, "/")
    .replace(/\\pi/g, "pi")
    .replace(/,/g, "")
    .replace(/[≈≃≅]/g, "=")
    .replace(/[−–—]/g, "-");

  // Convert common LaTeX forms into mathjs syntax.
  for (let i = 0; i < 8; i += 1) {
    const next = text
      .replace(/\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, "(($1)/($2))")
      .replace(/\\sqrt\s*\{([^{}]+)\}/g, "sqrt($1)")
      .replace(/\^\s*\{([^{}]+)\}/g, "^($1)");
    if (next === text) break;
    text = next;
  }

  return text.replace(/[{}]/g, "").trim();
}

// Attempt independent evaluation of an expression. Returns numeric value or null.
export function safeEvaluate(expr: string): number | null {
  const normalized = normalizeMathInput(expr);
  if (!normalized) return null;
  try {
    const v = evaluate(normalized);
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (v && typeof v.toNumber === "function") {
      const n = v.toNumber();
      return Number.isFinite(n) ? n : null;
    }
    return null;
  } catch {
    return null;
  }
}

function candidateExpressions(claimed: string): string[] {
  const normalized = normalizeMathInput(claimed);
  const candidates = new Set<string>();

  const add = (value: string) => {
    const cleaned = value
      .replace(/^\s*(result|answer|therefore|so|hence)\s*:?\s*/i, "")
      .trim();
    if (cleaned) candidates.add(cleaned);
  };

  add(normalized);

  // Common tutor result forms: "x = 5", "area = 12 square units", "≈ 3.14".
  normalized.split(/[=;]/).forEach(add);

  // Pull out expression-like chunks, ignoring surrounding words/units.
  const expressionMatches = normalized.match(
    /(?:sqrt\s*\([^)]*\)|abs\s*\([^)]*\)|sin\s*\([^)]*\)|cos\s*\([^)]*\)|tan\s*\([^)]*\)|log10\s*\([^)]*\)|log\s*\([^)]*\)|\bpi\b|\be\b|[-+*/^().\d\s])+/gi,
  );
  expressionMatches?.forEach(add);

  // Last resort: every numeric literal/fraction, so "5 meters" can still be checked.
  const numericMatches = normalized.match(/[-+]?\d*\.?\d+(?:e[-+]?\d+)?(?:\s*\/\s*[-+]?\d*\.?\d+(?:e[-+]?\d+)?)?/gi);
  numericMatches?.forEach(add);

  return [...candidates];
}

function claimedValues(claimed: string): number[] {
  const values: number[] = [];
  for (const candidate of candidateExpressions(claimed)) {
    const value = safeEvaluate(candidate);
    if (value != null) values.push(value);
  }
  return values;
}

// Compare a claimed result against a literal mathjs check expression.
// ok=false means the step must be retried or shown with a warning.
export function verifyResult(claimed: string, checkExpr: string): {
  ok: boolean;
  verified: boolean;
  computed: number | null;
  claimed: number | null;
} {
  const computed = safeEvaluate(checkExpr);

  if (computed == null) {
    return { ok: false, verified: false, computed: null, claimed: null };
  }

  const values = claimedValues(claimed);
  if (!values.length) return { ok: false, verified: false, computed, claimed: null };

  const tol = Math.max(1e-6, Math.abs(computed) * 1e-4);
  const matchingValue = values.find((value) => Math.abs(computed - value) <= tol);
  return {
    ok: matchingValue != null,
    verified: true,
    computed,
    claimed: matchingValue ?? values[values.length - 1] ?? null,
  };
}
