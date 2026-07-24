import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// One fast model powers the whole solve; mathjs does all arithmetic.
const SOLVER_MODEL = "google/gemini-2.5-flash";
const SOLVER_MODEL_PRO = "google/gemini-2.5-pro";
const EXPLAIN_MODEL = "google/gemini-2.5-flash";
const EXECUTOR_MODEL_FAST = SOLVER_MODEL; // used by checkGuidedAnswer

// ---------- Types ----------
export interface PlanStep {
  id: string;
  title: string;
}
export interface Plan {
  domain: string;
  difficulty: string;
  summary?: string;
  steps: PlanStep[];
  precomputed?: PrecomputedStep[];
}
export type StepResultType = "scalar" | "matrix" | "list";
export interface ResultListItem {
  label: string;
  value: string;
  computed?: number | null;
}
export interface PrecomputedStep {
  id: string;
  title: string;
  explanation: string;
  calculation: string;
  result: string;
  check_expression: string | null;
  guiding_question?: string;
  computed?: number | null;
  eval_error?: string;
  result_type: StepResultType;
  result_matrix?: number[][];
  result_list?: ResultListItem[];
}
export interface CompletedStep {
  step_id: string;
  title: string;
  explanation: string;
  calculation: string;
  result: string;
  check_expression: string | null;
  guiding_question?: string;
  verified: boolean;
  verified_ok: boolean;
  skipped?: boolean;
  retried?: boolean;
  computed?: number | null;
  verification_warning?: string;
  result_type?: StepResultType;
  result_matrix?: number[][];
  result_list?: ResultListItem[];
}

interface AiSolutionStep {
  title: string;
  explanation: string;
  result_type?: StepResultType;
  mathjs_expression?: string;
  matrix_expression?: string;
  list_items?: Array<{ label: string; mathjs_expression: string }>;
}
interface AiSolution {
  summary: string;
  steps: AiSolutionStep[];
}

// The solver system prompt lives in ai.server.ts so it is co-located with the AI gateway helpers.
// It is imported dynamically inside solveWithAi to keep this server-function module client-safe.

async function solveWithAi(
  problem: string,
  imageDataUrl: string | undefined,
  model: string,
  correction?: string,
): Promise<AiSolution> {
  const { callGeminiJSON, SOLVER_SYSTEM_PROMPT, sanitizeAiSolution } = await import("./ai.server");
  const userContent: Array<
    { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }
  > = [
    {
      type: "text",
      text: correction
        ? `Problem:\n${problem}\n\nIMPORTANT CORRECTION:\n${correction}`
        : `Problem:\n${problem}`,
    },
  ];
  if (imageDataUrl) userContent.push({ type: "image_url", image_url: { url: imageDataUrl } });
  const raw = await callGeminiJSON<AiSolution>({
    model,
    temperature: 0.1,
    messages: [
      { role: "system", content: SOLVER_SYSTEM_PROMPT },
      { role: "user", content: userContent },
    ],
  });
  return sanitizeAiSolution(raw);
}

function formatNumber(v: number): string {
  return Math.abs(v - Math.round(v)) < 1e-9 ? String(Math.round(v)) : String(Number(v.toFixed(6)));
}

function serializeMatrix(m: number[][]): string {
  return `[${m.map((row) => `[${row.map(formatNumber).join(",")}]`).join(",")}]`;
}

async function precomputeSteps(sol: AiSolution): Promise<PrecomputedStep[]> {
  const { safeEvaluate, safeEvaluateMatrix } = await import("./verify");
  const trimmed = (sol.steps ?? []).slice(0, 3);
  return trimmed.map((s, i): PrecomputedStep => {
    // Infer result_type if the model forgot it: matrix_expression → matrix,
    // list_items → list, else scalar.
    let kind: StepResultType = s.result_type ?? "scalar";
    if (!s.result_type) {
      if (s.matrix_expression && s.matrix_expression.trim()) kind = "matrix";
      else if (s.list_items && s.list_items.length) kind = "list";
    }

    const base = {
      id: `s${i + 1}`,
      title: s.title,
      explanation: s.explanation,
    };

    if (kind === "matrix") {
      const expr = (s.matrix_expression ?? "").trim();
      const matrix = expr ? safeEvaluateMatrix(expr) : null;
      if (matrix) {
        return {
          ...base,
          calculation: expr ? `$${expr}$` : "",
          result: serializeMatrix(matrix),
          check_expression: expr || null,
          computed: null,
          result_type: "matrix",
          result_matrix: matrix,
        };
      }
      return {
        ...base,
        calculation: expr ? `$${expr}$` : "",
        result: "",
        check_expression: expr || null,
        computed: null,
        eval_error: "mathjs could not evaluate this matrix expression",
        result_type: "matrix",
      };
    }

    if (kind === "list") {
      const items = (s.list_items ?? []).map((it) => {
        const expr = (it.mathjs_expression ?? "").trim();
        const v = expr ? safeEvaluate(expr) : null;
        return {
          label: it.label,
          value: v == null ? (expr || "?") : formatNumber(v),
          computed: v,
        };
      });
      const anyBad = items.some((it) => it.computed == null);
      return {
        ...base,
        calculation: "",
        result: items.map((it) => `${it.label}: ${it.value}`).join(", "),
        check_expression: null,
        computed: null,
        result_type: "list",
        result_list: items,
        eval_error: anyBad ? "one or more list items could not be evaluated" : undefined,
      };
    }

    // scalar (default)
    const expr = (s.mathjs_expression ?? "").trim();
    let result = "";
    let computed: number | null = null;
    let eval_error: string | undefined;
    let calculation = "";
    if (expr) {
      const v = safeEvaluate(expr);
      if (v == null) {
        eval_error = "mathjs could not evaluate this expression";
        calculation = `$${expr}$`;
      } else {
        computed = v;
        result = formatNumber(v);
        calculation = `$${expr} = ${result}$`;
      }
    }
    return {
      ...base,
      calculation,
      result,
      check_expression: expr || null,
      computed,
      eval_error,
      result_type: "scalar",
    };
  });
}

// ---------- Create session (one AI call, mathjs does the math) ----------
export const createTutorSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        problem: z.string().min(1).max(4000),
        mode: z.enum(["guided", "direct"]).default("direct"),
        imageDataUrl: z
          .string()
          .max(7_000_000, "Image too large")
          .regex(
            /^data:image\/(png|jpe?g|gif|webp|heic|heif);base64,[A-Za-z0-9+/=]+$/,
            "Invalid image data URL",
          )
          .optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    let solution = await solveWithAi(data.problem, data.imageDataUrl, SOLVER_MODEL);
    let precomputed = await precomputeSteps(solution);

    const badStep = precomputed.find((p) => p.eval_error);
    if (badStep) {
      try {
        const retry = await solveWithAi(
          data.problem,
          data.imageDataUrl,
          SOLVER_MODEL_PRO,
          `Your previous mathjs_expression for step "${badStep.title}" could not be evaluated by mathjs (expression: ${JSON.stringify(badStep.check_expression)}). Every mathjs_expression must be raw numeric arithmetic — no variables, words, units, or LaTeX. If the step has no calculation, use an empty string.`,
        );
        const retryPrecomputed = await precomputeSteps(retry);
        if (retryPrecomputed.every((p) => !p.eval_error)) {
          solution = retry;
          precomputed = retryPrecomputed;
        }
      } catch (err) {
        console.warn("Solver Pro retry failed:", err);
      }
    }

    if (!precomputed.length) throw new Error("Solver returned no steps");

    const plan: Plan = {
      domain: "math",
      difficulty: "medium",
      summary: solution.summary,
      steps: precomputed.map((p) => ({ id: p.id, title: p.title })),
      precomputed,
    };

    const { data: row, error } = await context.supabase
      .from("tutor_sessions")
      .insert({
        user_id: context.userId,
        problem_text: data.problem,
        problem_image_url: data.imageDataUrl ?? null,
        domain: plan.domain,
        difficulty: plan.difficulty,
        plan: plan as unknown as never,
        mode: data.mode,
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);
    return { sessionId: row.id as string, plan };
  });

// ---------- Reveal next step (from precomputed cache — instant) ----------
export const runNextStep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ sessionId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: session, error: sErr } = await context.supabase
      .from("tutor_sessions")
      .select("*")
      .eq("id", data.sessionId)
      .eq("user_id", context.userId)
      .single();
    if (sErr || !session) throw new Error("Session not found");

    const plan = session.plan as unknown as Plan;
    const history = (session.step_history as unknown as CompletedStep[]) ?? [];
    const idx = session.current_step_index as number;
    const precomputed = plan.precomputed ?? [];

    if (idx >= precomputed.length) {
      return { done: true, step: null, session };
    }

    const p = precomputed[idx];
    const kind: StepResultType = p.result_type ?? "scalar";
    const scalarHasExpr = kind === "scalar" && !!p.check_expression;
    const scalarOk = scalarHasExpr && p.computed != null;
    const matrixOk = kind === "matrix" && !!p.result_matrix && p.result_matrix.length > 0;
    const listOk =
      kind === "list" && !!p.result_list && p.result_list.every((it) => it.computed != null);

    const verified = scalarHasExpr || matrixOk || listOk;
    const verified_ok =
      (kind !== "scalar" || !scalarHasExpr || scalarOk) &&
      (kind !== "matrix" || matrixOk) &&
      (kind !== "list" || listOk);
    const skipped = kind === "scalar" && !scalarHasExpr;

    const completed: CompletedStep = {
      step_id: p.id,
      title: p.title,
      explanation: p.explanation,
      calculation: p.calculation,
      result: p.result || (scalarHasExpr ? "Needs review" : ""),
      check_expression: p.check_expression,
      guiding_question: p.guiding_question,
      verified,
      verified_ok,
      skipped,
      retried: false,
      computed: p.computed ?? null,
      result_type: kind,
      result_matrix: p.result_matrix,
      result_list: p.result_list,
      verification_warning: !verified_ok
        ? "Please double-check this step — its calculator check could not be evaluated."
        : undefined,
    };

    const newHistory = [...history, completed];
    const newIdx = idx + 1;
    const isDone = newIdx >= precomputed.length;

    if (isDone) {
      const { universalVerify } = await import("./verify");
      const finalCheck = universalVerify({
        problem: session.problem_text,
        domain: session.domain,
        finalAnswer: completed.result,
      });

      const { error: uErr } = await context.supabase
        .from("tutor_sessions")
        .update({
          step_history: newHistory as unknown as never,
          current_step_index: newIdx,
          status: "complete",
          final_answer: completed.result || null,
          final_verification: finalCheck as unknown as never,
        })
        .eq("id", data.sessionId);
      if (uErr) throw new Error(uErr.message);
      return { done: true, step: completed, currentIndex: newIdx };
    }

    const { error: uErr } = await context.supabase
      .from("tutor_sessions")
      .update({
        step_history: newHistory as unknown as never,
        current_step_index: newIdx,
        status: "in_progress",
      })
      .eq("id", data.sessionId);
    if (uErr) throw new Error(uErr.message);

    return { done: false, step: completed, currentIndex: newIdx };
  });

// ---------- Explain step ----------
export const explainStep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        sessionId: z.string().uuid(),
        stepId: z.string(),
        question: z.string().min(1).max(1000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { callGeminiText } = await import("./ai.server");

    const { data: session, error } = await context.supabase
      .from("tutor_sessions")
      .select("problem_text, plan, step_history")
      .eq("id", data.sessionId)
      .eq("user_id", context.userId)
      .single();
    if (error || !session) throw new Error("Session not found");

    const history = (session.step_history as unknown as CompletedStep[]) ?? [];
    const step = history.find((h) => h.step_id === data.stepId);
    if (!step) throw new Error("Step not found");

    const answer = await callGeminiText({
      model: EXPLAIN_MODEL,
      temperature: 0.5,
      messages: [
        {
          role: "system",
          content:
            "You are a patient math tutor. Re-explain the given step clearly and briefly, answering the student's question. Keep it under 6 sentences. Use plain English; LaTeX between $...$ only for formulas.",
        },
        {
          role: "user",
          content: `Problem: ${session.problem_text}\n\nStep title: ${step.title}\nOriginal explanation: ${step.explanation}\nCalculation: ${step.calculation}\nResult: ${step.result}\n\nStudent asks: ${data.question}`,
        },
      ],
    });

    return { answer };
  });

// ---------- Check student's guided-mode answer ----------
export const checkGuidedAnswer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        sessionId: z.string().uuid(),
        stepId: z.string(),
        answer: z.string().min(1).max(1000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { callGeminiJSON } = await import("./ai.server");

    const { data: session, error } = await context.supabase
      .from("tutor_sessions")
      .select("problem_text, step_history")
      .eq("id", data.sessionId)
      .eq("user_id", context.userId)
      .single();
    if (error || !session) throw new Error("Session not found");

    const history = (session.step_history as unknown as CompletedStep[]) ?? [];
    const step = history.find((h) => h.step_id === data.stepId);
    if (!step) throw new Error("Step not found");

    const res = await callGeminiJSON<{
      verdict: "correct" | "partial" | "incorrect";
      feedback: string;
    }>({
      model: EXECUTOR_MODEL_FAST,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "You are a warm, encouraging math tutor grading a student's attempt at ONE step of a problem. Compare their answer to the expected result for this step. Return strict JSON: {\"verdict\": \"correct\"|\"partial\"|\"incorrect\", \"feedback\": string}. Feedback: 1-2 short sentences, kind tone, do NOT reveal the full calculation — nudge them if wrong. LaTeX between $...$ allowed.",
        },
        {
          role: "user",
          content: `Problem: ${session.problem_text}\n\nStep: ${step.title}\nGuiding question: ${step.guiding_question ?? "(none)"}\nExpected result for this step: ${step.result}\n\nStudent's answer: ${data.answer}`,
        },
      ],
    });

    return res;
  });

// ---------- Generate similar practice problem ----------
export const similarProblem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ sessionId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { callGeminiText } = await import("./ai.server");

    const { data: session, error } = await context.supabase
      .from("tutor_sessions")
      .select("problem_text, domain, difficulty")
      .eq("id", data.sessionId)
      .eq("user_id", context.userId)
      .single();
    if (error || !session) throw new Error("Session not found");

    const problem = await callGeminiText({
      model: EXPLAIN_MODEL,
      temperature: 0.8,
      messages: [
        {
          role: "system",
          content:
            "You generate practice problems. Given an original problem, produce ONE new problem of similar topic and difficulty. Return ONLY the problem text — no solution, no numbering, no preamble.",
        },
        {
          role: "user",
          content: `Original problem: ${session.problem_text}\nTopic: ${session.domain ?? "math"}\nDifficulty: ${session.difficulty ?? "medium"}`,
        },
      ],
    });
    return { problem: problem.trim() };
  });

// ---------- Session read helpers ----------
export const getSession = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ sessionId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("tutor_sessions")
      .select("*")
      .eq("id", data.sessionId)
      .eq("user_id", context.userId)
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listSessions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("tutor_sessions")
      .select("id, problem_text, created_at, status, current_step_index, plan")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const setSessionMode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        sessionId: z.string().uuid(),
        mode: z.enum(["guided", "direct"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("tutor_sessions")
      .update({ mode: data.mode })
      .eq("id", data.sessionId)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Debug: verification stats for the last 5 sessions ----------
export const verificationDebug = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("tutor_sessions")
      .select("id, problem_text, created_at, step_history")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(5);
    if (error) throw new Error(error.message);

    return (data ?? []).map((row) => {
      const history = (row.step_history as unknown as CompletedStep[]) ?? [];
      const steps = history.map((h, i) => ({
        index: i + 1,
        title: h.title,
        result: h.result,
        check_expression: h.check_expression,
        computed: h.computed ?? null,
        verified: h.verified,
        verified_ok: h.verified_ok,
        skipped: h.skipped ?? false,
        retried: h.retried ?? false,
      }));
      return {
        sessionId: row.id,
        problem: row.problem_text,
        createdAt: row.created_at,
        totals: {
          steps: steps.length,
          retried: steps.filter((s) => s.retried).length,
          failed: steps.filter((s) => !s.verified_ok && !s.skipped).length,
          skipped: steps.filter((s) => s.skipped).length,
          verified: steps.filter((s) => s.verified_ok && !s.skipped).length,
        },
        steps,
      };
    });
  });
