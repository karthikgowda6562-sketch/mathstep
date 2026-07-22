import { evaluate, fraction } from "mathjs";

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

  for (let i = 0; i < 8; i += 1) {
    const next = text
      .replace(/\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, "(($1)/($2))")
      .replace(/\\sqrt\s*\{([^{}]+)\}/g, "sqrt($1)")
      .replace(/\^\s*\{([^{}]+)\}/g, "^($1)");
    if (next === text) break;
    text = next;
  }

  return text.replace(/[{}]/g, "").replace(/\s+/g, " ").trim();
}

export function safeEvaluate(expr: string): number | null {
  const normalized = normalizeMathInput(expr);
  if (!normalized) return null;
  try {
    const v = evaluate(normalized);
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (v && typeof v === "object") {
      // mathjs Fraction / BigNumber
      const anyV = v as { toNumber?: () => number; valueOf?: () => number };
      if (typeof anyV.toNumber === "function") {
        const n = anyV.toNumber();
        return Number.isFinite(n) ? n : null;
      }
      if (typeof anyV.valueOf === "function") {
        const n = Number(anyV.valueOf());
        return Number.isFinite(n) ? n : null;
      }
    }
    return null;
  } catch {
    // Try fraction fallback e.g. "1/2"
    try {
      const f = fraction(normalized);
      const n = Number(f.n) / Number(f.d) * (f.s < 0 ? -1 : 1);
      return Number.isFinite(n) ? n : null;
    } catch {
      return null;
    }
  }
}

function candidateExpressions(claimed: string): string[] {
  const normalized = normalizeMathInput(claimed);
  const candidates = new Set<string>();

  const add = (value: string) => {
    const cleaned = value
      .replace(/^\s*(result|answer|therefore|so|hence|x|y|z)\s*[:=]?\s*/i, "")
      .trim();
    if (cleaned) candidates.add(cleaned);
  };

  add(normalized);
  normalized.split(/[=;]/).forEach(add);

  const expressionMatches = normalized.match(
    /(?:sqrt\s*\([^)]*\)|abs\s*\([^)]*\)|sin\s*\([^)]*\)|cos\s*\([^)]*\)|tan\s*\([^)]*\)|log10\s*\([^)]*\)|log\s*\([^)]*\)|\bpi\b|\be\b|[-+*/^().\d\s])+/gi,
  );
  expressionMatches?.forEach(add);

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

export interface VerifyOutcome {
  ok: boolean;
  verified: boolean;
  skipped: boolean;
  computed: number | null;
  claimed: number | null;
  reason: string;
}

// Compare a claimed result against a literal mathjs check expression.
// If checkExpr is null/empty, verification is skipped (step allowed through).
export function verifyResult(
  claimed: string,
  checkExpr: string | null | undefined,
): VerifyOutcome {
  const rawCheck = (checkExpr ?? "").trim();

  // Case 1: no numeric check possible for this step — skip gracefully.
  if (!rawCheck || rawCheck.toLowerCase() === "null" || rawCheck.toLowerCase() === "n/a") {
    const outcome: VerifyOutcome = {
      ok: true,
      verified: false,
      skipped: true,
      computed: null,
      claimed: null,
      reason: "no check_expression — symbolic/unverifiable step",
    };
    logVerification(claimed, checkExpr ?? null, outcome);
    return outcome;
  }

  const computed = safeEvaluate(rawCheck);

  if (computed == null) {
    const values = claimedValues(claimed);
    const outcome: VerifyOutcome = {
      ok: false,
      verified: false,
      skipped: false,
      computed: null,
      claimed: values[0] ?? null,
      reason: "check_expression could not be evaluated by mathjs",
    };
    logVerification(claimed, checkExpr ?? null, outcome);
    return outcome;
  }

  const values = claimedValues(claimed);
  if (!values.length) {
    const outcome: VerifyOutcome = {
      ok: false,
      verified: true,
      skipped: false,
      computed,
      claimed: null,
      reason: "no numeric value could be parsed from result",
    };
    logVerification(claimed, checkExpr, outcome);
    return outcome;
  }

  // Tolerance: absolute floor 1e-9, relative 1e-4 for larger magnitudes.
  const scale = Math.max(1, Math.abs(computed));
  const tol = Math.max(1e-9, scale * 1e-4);
  const matchingValue = values.find((value) => Math.abs(computed - value) <= tol);
  const outcome: VerifyOutcome = {
    ok: matchingValue != null,
    verified: true,
    skipped: false,
    computed,
    claimed: matchingValue ?? values[values.length - 1] ?? null,
    reason: matchingValue != null
      ? `match within tol=${tol.toExponential(2)}`
      : `mismatch |computed-claimed|=${Math.abs(computed - (values[values.length - 1] ?? 0))}`,
  };
  logVerification(claimed, checkExpr, outcome);
  return outcome;
}

function logVerification(
  claimed: string,
  checkExpr: string | null | undefined,
  outcome: VerifyOutcome,
) {
  try {
    // eslint-disable-next-line no-console
    console.log("[verify]", JSON.stringify({
      raw_check_expression: checkExpr,
      claimed_result: claimed,
      computed: outcome.computed,
      claimed_numeric: outcome.claimed,
      ok: outcome.ok,
      verified: outcome.verified,
      skipped: outcome.skipped,
      reason: outcome.reason,
    }));
  } catch {
    // ignore logging errors
  }
}
