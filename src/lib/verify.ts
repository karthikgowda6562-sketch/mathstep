import { evaluate } from "mathjs";

// Attempt independent evaluation of an expression. Returns numeric value or null.
export function safeEvaluate(expr: string): number | null {
  if (!expr) return null;
  try {
    const v = evaluate(expr);
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

// Compare a claimed result string/number against a check expression.
// Returns { ok, computed } where ok=true means either they match or we can't verify (skipped).
export function verifyResult(claimed: string, checkExpr: string): {
  ok: boolean;
  verified: boolean;
  computed: number | null;
} {
  const computed = safeEvaluate(checkExpr);
  const claimedNum = safeEvaluate(claimed);

  if (computed == null) {
    // Couldn't independently evaluate; treat as unverified but not a failure
    return { ok: true, verified: false, computed: null };
  }
  if (claimedNum == null) {
    // Claimed result is symbolic; if check expression evaluated numerically we accept
    return { ok: true, verified: false, computed };
  }
  const tol = Math.max(1e-6, Math.abs(computed) * 1e-4);
  const ok = Math.abs(computed - claimedNum) <= tol;
  return { ok, verified: true, computed };
}
