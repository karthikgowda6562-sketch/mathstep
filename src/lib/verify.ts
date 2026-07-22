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

// ============================================================
// Universal end-to-end answer verification (domain-agnostic)
// ============================================================

import { parse as mathParse } from "mathjs";

export interface UniversalCheck {
  ok: boolean;
  kind:
    | "equation"
    | "arithmetic"
    | "gcd_lcm"
    | "simplification"
    | "numeric_extract"
    | "none";
  reason: string;
  skipped: boolean;
  details?: Record<string, unknown>;
}

// Strip common problem-text noise so mathjs has a chance.
function cleanProblemText(input: string): string {
  return input
    .replace(/^\s*(solve|simplify|evaluate|compute|calculate|find|what is|whats|determine)\s+/i, "")
    .replace(/\?+\s*$/g, "")
    .replace(/\bfor\s+x\b/gi, "")
    .replace(/\bfor\s+y\b/gi, "")
    .trim();
}

// Extract variable → value assignments from a final answer string.
// Handles: "x = 3", "x = -2", "x=3, y=5", "x = 2 or x = -3", "x = 2, -3".
function extractAssignments(finalAnswer: string): Array<Record<string, number>> {
  const clean = normalizeMathInput(finalAnswer)
    .replace(/\band\b/gi, ",")
    .replace(/\bor\b/gi, ",");

  // Find "var = value" pairs.
  const pairRegex = /([a-zA-Z_]\w*)\s*=\s*([-+]?[\d./\s^*+()-]+?)(?=(?:\s*,\s*[a-zA-Z_]\w*\s*=)|,|$)/g;
  const assignments: Record<string, number>[] = [];
  const single: Record<string, number> = {};
  let m: RegExpExecArray | null;
  while ((m = pairRegex.exec(clean)) !== null) {
    const varName = m[1];
    const val = safeEvaluate(m[2]);
    if (val == null) continue;
    if (varName in single) {
      // Multiple values for same var → separate solutions (e.g. quadratic roots).
      assignments.push({ ...single });
      const solo: Record<string, number> = {};
      solo[varName] = val;
      // Continue collecting into a new solution set — reset single for this var only.
      single[varName] = val;
      assignments.push(solo);
    } else {
      single[varName] = val;
    }
  }
  if (Object.keys(single).length) assignments.unshift(single);

  // Handle "x = 2, -3" (var only stated once).
  if (!assignments.length) {
    const varMatch = clean.match(/([a-zA-Z_]\w*)\s*=\s*(.+)/);
    if (varMatch) {
      const varName = varMatch[1];
      const rhs = varMatch[2];
      const parts = rhs.split(/[,;]/).map((p) => p.trim()).filter(Boolean);
      for (const p of parts) {
        const v = safeEvaluate(p);
        if (v != null) assignments.push({ [varName]: v });
      }
    }
  }

  return assignments;
}

// Extract equations from problem text (any substring containing '=').
function extractEquations(problem: string): string[] {
  const cleaned = cleanProblemText(problem);
  const parts = cleaned.split(/[.;\n]|\band\b/gi).map((p) => p.trim()).filter(Boolean);
  const equations: string[] = [];
  for (const p of parts) {
    if (p.includes("=")) equations.push(p);
  }
  if (!equations.length && cleaned.includes("=")) equations.push(cleaned);
  return equations;
}

function evalWithScope(expr: string, scope: Record<string, number>): number | null {
  try {
    const normalized = normalizeMathInput(expr);
    if (!normalized) return null;
    const node = mathParse(normalized);
    const val = node.evaluate(scope);
    if (typeof val === "number" && Number.isFinite(val)) return val;
    if (val && typeof val === "object") {
      const anyV = val as { toNumber?: () => number; valueOf?: () => number };
      if (typeof anyV.toNumber === "function") {
        const n = anyV.toNumber();
        return Number.isFinite(n) ? n : null;
      }
      const n = Number((anyV.valueOf?.() ?? val) as number);
      return Number.isFinite(n) ? n : null;
    }
    return null;
  } catch {
    return null;
  }
}

function withinTol(a: number, b: number): boolean {
  const scale = Math.max(1, Math.abs(a), Math.abs(b));
  return Math.abs(a - b) <= Math.max(1e-9, scale * 1e-4);
}

// EQUATION check: substitute assignment(s) into every extracted equation.
function equationCheck(problem: string, finalAnswer: string): UniversalCheck | null {
  const equations = extractEquations(problem);
  if (!equations.length) return null;
  const assignments = extractAssignments(finalAnswer);
  if (!assignments.length) return null;

  // Any assignment set that satisfies ALL equations wins.
  const failures: string[] = [];
  for (const scope of assignments) {
    let all = true;
    for (const eq of equations) {
      const sides = eq.split("=");
      if (sides.length !== 2) { all = false; break; }
      const lhs = evalWithScope(sides[0], scope);
      const rhs = evalWithScope(sides[1], scope);
      if (lhs == null || rhs == null || !withinTol(lhs, rhs)) {
        failures.push(`eq="${eq.trim()}" scope=${JSON.stringify(scope)} lhs=${lhs} rhs=${rhs}`);
        all = false;
        break;
      }
    }
    if (all) {
      return {
        ok: true,
        kind: "equation",
        skipped: false,
        reason: `Substituted ${JSON.stringify(scope)} into ${equations.length} equation(s); both sides matched.`,
      };
    }
  }
  return {
    ok: false,
    kind: "equation",
    skipped: false,
    reason: `Assignment(s) did not satisfy problem equations. ${failures.slice(0, 3).join(" | ")}`,
    details: { equations, assignments },
  };
}

// ARITHMETIC check: no letters → evaluate whole problem, compare to numeric final answer.
function arithmeticCheck(problem: string, finalAnswer: string): UniversalCheck | null {
  const cleaned = cleanProblemText(problem)
    .replace(/\bdivided by\b/gi, "/")
    .replace(/\btimes\b/gi, "*")
    .replace(/\bplus\b/gi, "+")
    .replace(/\bminus\b/gi, "-");
  const normalized = normalizeMathInput(cleaned);
  if (/[a-zA-Z]/.test(normalized.replace(/pi|e|sqrt|abs|sin|cos|tan|log10|log/g, ""))) return null;
  const expected = safeEvaluate(normalized);
  if (expected == null) return null;

  const claimed = claimedFinalValue(finalAnswer);
  if (claimed == null) {
    return {
      ok: false,
      kind: "arithmetic",
      skipped: false,
      reason: `Problem evaluates to ${expected} but no numeric value could be parsed from final answer "${finalAnswer}".`,
    };
  }
  const ok = withinTol(expected, claimed);
  return {
    ok,
    kind: "arithmetic",
    skipped: false,
    reason: ok
      ? `Independent evaluation ${expected} matched final answer ${claimed}.`
      : `Independent evaluation ${expected} did not match final answer ${claimed}.`,
  };
}

// GCD / LCM check: recompute independently from numbers in problem.
function gcdLcmCheck(problem: string, domain: string | null, finalAnswer: string): UniversalCheck | null {
  const text = `${problem} ${domain ?? ""}`.toLowerCase();
  const isGcd = /\b(gcd|greatest common (divisor|factor)|hcf)\b/.test(text);
  const isLcm = /\b(lcm|least common multiple)\b/.test(text);
  if (!isGcd && !isLcm) return null;
  const nums = (problem.match(/-?\d+/g) ?? []).map(Number).filter((n) => Number.isFinite(n) && n !== 0);
  if (nums.length < 2) return null;
  const g = (a: number, b: number): number => (b === 0 ? Math.abs(a) : g(b, a % b));
  const gcd = nums.reduce((acc, n) => g(acc, n));
  const lcm = nums.reduce((acc, n) => Math.abs(acc * n) / g(acc, n));
  const expected = isGcd ? gcd : lcm;
  const claimed = claimedFinalValue(finalAnswer);
  if (claimed == null) {
    return { ok: false, kind: "gcd_lcm", skipped: false, reason: `Expected ${isGcd ? "gcd" : "lcm"}=${expected}; could not parse final answer.` };
  }
  const ok = withinTol(expected, claimed);
  return {
    ok,
    kind: "gcd_lcm",
    skipped: false,
    reason: ok
      ? `Independent ${isGcd ? "GCD" : "LCM"} ${expected} matched final answer ${claimed}.`
      : `Independent ${isGcd ? "GCD" : "LCM"} ${expected} did not match final answer ${claimed}.`,
  };
}

// SIMPLIFICATION check: sample random values of variables and compare original vs final expression.
function simplificationCheck(problem: string, finalAnswer: string): UniversalCheck | null {
  const cleaned = cleanProblemText(problem);
  if (cleaned.includes("=")) return null;
  const norm = normalizeMathInput(cleaned);
  const varMatches = norm.match(/\b([a-zA-Z])\b/g) ?? [];
  const vars = Array.from(new Set(varMatches.filter((v) => !["e"].includes(v))));
  if (!vars.length) return null;

  // Strip a possible leading "x = " from the answer.
  const answerExpr = finalAnswer.replace(/^\s*[a-zA-Z]\s*=\s*/, "");
  const answerVars = (normalizeMathInput(answerExpr).match(/\b([a-zA-Z])\b/g) ?? []).filter((v) => !["e"].includes(v));
  // Only try if answer's variables are a subset of problem's variables.
  const allowed = new Set(vars);
  if (answerVars.some((v) => !allowed.has(v))) return null;

  const samples = [2, 3, 5, 7, 11];
  let compared = 0;
  for (const seed of samples) {
    const scope: Record<string, number> = {};
    vars.forEach((v, i) => { scope[v] = seed + i * 0.5; });
    const lhs = evalWithScope(norm, scope);
    const rhs = evalWithScope(answerExpr, scope);
    if (lhs == null || rhs == null) continue;
    compared += 1;
    if (!withinTol(lhs, rhs)) {
      return {
        ok: false,
        kind: "simplification",
        skipped: false,
        reason: `At ${JSON.stringify(scope)}: original=${lhs}, simplified=${rhs}. They differ.`,
      };
    }
  }
  if (compared === 0) return null;
  return {
    ok: true,
    kind: "simplification",
    skipped: false,
    reason: `Original and final expression agreed at ${compared} sample values.`,
  };
}

// Numeric final-answer fallback: try to evaluate the final answer expression cleanly.
function claimedFinalValue(finalAnswer: string): number | null {
  // Prefer the RHS if it looks like "x = ...".
  const eqSplit = finalAnswer.split("=");
  const candidate = eqSplit.length > 1 ? eqSplit[eqSplit.length - 1] : finalAnswer;
  const direct = safeEvaluate(candidate);
  if (direct != null) return direct;
  // Try candidateExpressions as a fallback.
  const numRegex = /-?\d+(?:\.\d+)?(?:\s*\/\s*-?\d+(?:\.\d+)?)?/g;
  const matches = candidate.match(numRegex);
  if (matches?.length) {
    const v = safeEvaluate(matches[matches.length - 1]);
    if (v != null) return v;
  }
  return null;
}

export function universalVerify(opts: {
  problem: string;
  domain: string | null | undefined;
  finalAnswer: string;
}): UniversalCheck {
  const { problem, domain, finalAnswer } = opts;
  if (!finalAnswer || !finalAnswer.trim()) {
    return { ok: false, kind: "none", skipped: false, reason: "No final answer produced." };
  }

  const checks: (UniversalCheck | null)[] = [
    gcdLcmCheck(problem, domain ?? null, finalAnswer),
    equationCheck(problem, finalAnswer),
    simplificationCheck(problem, finalAnswer),
    arithmeticCheck(problem, finalAnswer),
  ];

  for (const c of checks) {
    if (c) {
      logUniversal(problem, domain ?? null, finalAnswer, c);
      return c;
    }
  }

  // Fallback: could not devise a domain-appropriate check.
  const skipped: UniversalCheck = {
    ok: true, // don't block, but flag as skipped
    kind: "none",
    skipped: true,
    reason: "No universal check applicable (couldn't extract equations, arithmetic, or expression to compare).",
  };
  logUniversal(problem, domain ?? null, finalAnswer, skipped);
  return skipped;
}

function logUniversal(problem: string, domain: string | null, finalAnswer: string, c: UniversalCheck) {
  try {
    // eslint-disable-next-line no-console
    console.log("[universal-verify]", JSON.stringify({
      problem: problem.slice(0, 200),
      domain,
      final_answer: finalAnswer,
      kind: c.kind,
      ok: c.ok,
      skipped: c.skipped,
      reason: c.reason,
    }));
  } catch {}
}
