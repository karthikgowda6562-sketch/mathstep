import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Default to fast Flash for speed; escalate to Pro only when verification fails.
const PLANNER_MODEL = "google/gemini-2.5-flash";
const EXECUTOR_MODEL_FAST = "google/gemini-2.5-flash";
const EXECUTOR_MODEL_PRO = "google/gemini-2.5-pro";
const EXPLAIN_MODEL = "google/gemini-2.5-flash";

// ---------- Types ----------
export interface PlanStep {
  id: string;
  title: string;
}
export interface Plan {
  domain: string;
  difficulty: string;
  steps: PlanStep[];
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
}

interface ExecutorResponse {
  step_id: string;
  explanation: string;
  calculation: string;
  result: string;
  check_expression: string | null;
  guiding_question?: string;
}

function executorModelForDifficulty(_difficulty: string | null | undefined): string {
  // Always start with Flash for speed; Pro is reserved for retry-after-failure.
  return EXECUTOR_MODEL_FAST;
}

// ---------- Create session (planner) ----------
export const createTutorSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        problem: z.string().min(1).max(4000),
        mode: z.enum(["guided", "direct"]).default("direct"),
        imageDataUrl: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { callGeminiJSON } = await import("./ai.server");

    const systemPrompt = `You are the PLANNER for a step-by-step math tutor.
Your ONLY job is to name the steps required to solve the problem correctly.
Do NOT solve the problem. Do NOT reveal intermediate results or the final answer.
Think carefully about the correct mathematical approach before naming steps. Respect order of operations (PEMDAS/BODMAS), algebraic identities, calculus rules, geometry theorems, and unit consistency.
Return strict JSON: {"domain": string, "difficulty": "easy"|"medium"|"hard", "steps": [{"id": "s1", "title": "short step name"}]}

HARD LIMIT — MAXIMUM 3 STEPS TOTAL, no matter the difficulty:
- Very simple problems (basic arithmetic, a single fraction reduction): 1-2 steps is enough.
- Everything else: 2-3 steps maximum.
- COMBINE related sub-steps into ONE step. "Find GCD and simplify" is ONE step, not two. "Find prime factors of both numbers" is ONE step, not two separate steps per number. "Set up the equation and solve for x" can be one step for easy cases.
- Never produce more than 3 steps. If you're tempted to, merge them.

Titles must be short (max 70 chars) and describe WHAT will be done (e.g. "Divide top and bottom by 4", "Apply the quadratic formula"), not the answer.
The FINAL step must produce the answer — do not add a separate "state the final answer" ceremony step.`;

    const userContent: Array<
      { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }
    > = [{ type: "text", text: `Problem:\n${data.problem}` }];
    if (data.imageDataUrl) {
      userContent.push({ type: "image_url", image_url: { url: data.imageDataUrl } });
    }

    const plan = await callGeminiJSON<Plan>({
      model: PLANNER_MODEL,
      temperature: 0.3,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
    });

    if (!plan?.steps?.length) throw new Error("Planner returned no steps");
    // normalise IDs
    plan.steps = plan.steps.map((s, i) => ({ id: s.id || `s${i + 1}`, title: s.title }));

    const { data: row, error } = await context.supabase
      .from("tutor_sessions")
      .insert({
        user_id: context.userId,
        problem_text: data.problem,
        problem_image_url: data.imageDataUrl ?? null,
        domain: plan.domain ?? null,
        difficulty: plan.difficulty ?? null,
        plan: plan as unknown as never,
        mode: data.mode,
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);
    return { sessionId: row.id as string, plan };
  });

// ---------- Run next step (executor) ----------
export const runNextStep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ sessionId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { callGeminiJSON } = await import("./ai.server");
    const { verifyResult } = await import("./verify");

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

    if (idx >= plan.steps.length) {
      return { done: true, step: null, session };
    }
    const currentStep = plan.steps[idx];

    const difficulty = (plan.difficulty ?? "medium").toLowerCase();
    const useFormalTerms = difficulty === "hard" || difficulty === "advanced";
    const toneGuidance = useFormalTerms
      ? `This problem is HARD/ADVANCED. Use rigorous, complete methods and precise terminology, but keep sentences short and natural — no textbook filler.`
      : `This problem is ${difficulty.toUpperCase()}. Keep it casual and short. Use everyday words — say "the biggest number that divides both" instead of "greatest common divisor", "divide", "multiply", "share a factor of". Skip repetitive intermediate work (e.g. don't show every single division when breaking down a number — just state the final factorization or answer with one short reason why). Save formal terms for advanced problems only.`;
    const executorModel = executorModelForDifficulty(plan.difficulty);

    const systemPrompt = `You are the EXECUTOR for a step-by-step math tutor. Accuracy is the #1 priority. The SECOND priority is talking like a real human friend, not a textbook.

${toneGuidance}

How to WRITE (voice & style — this matters a LOT):
- Explain like you're talking out loud to a friend. 1-2 short plain sentences per step. NEVER a paragraph.
- No textbook phrasing, no formal proofs, no unnecessary formulas or terminology unless the problem truly requires it.
- Use everyday words: "divide", "multiply", "the biggest shared number" instead of "greatest common divisor" for easy/medium problems.
- Skip repetitive intermediate work. Don't show every single division line when breaking down a number — just state the final factorization or result with one short reason why.
- Just state things directly, like you're talking. Don't recap. Don't announce what you're about to do.

Rules of reasoning (accuracy — follow every time):
- Think through the step silently before writing. Prefer symbolic manipulation, then substitute numbers.
- Respect order of operations (PEMDAS/BODMAS).
- Distribute signs carefully. -(a - b) = -a + b.
- Keep exact values (fractions, radicals, pi, e); only decimal-approximate at the final step.
- Preserve units and keep them in the result.
- Use the CORRECT domain rules (quadratic formula, log/exponent laws, trig identities, derivative/integral rules, etc.). Never invent identities.
- Independently redo the arithmetic in your head before writing "result".
- Use ONLY facts established in the completed steps below. Do not skip ahead.

FORMATTING — critical for rendering:
- ALL math notation must be wrapped in $...$ (inline) or $$...$$ (block). This includes fractions, \\frac, \\div, \\times, \\sqrt, exponents, subscripts, and equations.
- NEVER write bare LaTeX like \\frac{4}{56} or \\div outside of $...$ — it will show as raw text to the student.
- NEVER use \\begin{align*}, \\begin{align}, \\begin{aligned}, \\begin{gather*}, arrays, cases, or any multi-line LaTeX environment. Use one simple single-line expression instead.
- Keep each calculation to one or two single-line expressions. Example: "$108 = 2^2 \\times 3^3$ and $144 = 2^4 \\times 3^2$". Do not stack aligned equations.
- Examples: write "$\\frac{4}{56}$", not "\\frac{4}{56}". Write "$12 \\div 4 = 3$", not "12 \\div 4 = 3".
- Plain arithmetic without LaTeX commands (like "12 / 4 = 3") is fine unwrapped.

Solve ONLY the current step. Return strict JSON:
{
  "step_id": string,
  "explanation": string,        // 1-2 short natural sentences. Plain-spoken. No textbook voice.
  "calculation": string,        // the math work. Single-line math only; no align environments. For medium, show key working and skip repetitive arithmetic lines.
  "result": string,             // the resulting value or expression of THIS step. Prefer exact form; add "≈ <decimal>" only when helpful.
  "check_expression": string | null,   // see STRICT RULES below
  "guiding_question": string    // one short casual question a tutor might ask before showing the calculation
}

STRICT RULES for check_expression (a real calculator will evaluate this):
- ONLY a raw evaluable mathjs expression using numbers and operators: + - * / ^ ( ) and functions sqrt(), abs(), sin(), cos(), tan(), log(), log10(), plus constants pi, e.
- NEVER include variable names (no x, y, n), equals signs, units, words, LaTeX, or commentary.
- If the step's result is an equation like "x = 4", check_expression is just: 4
- If the step is symbolic with no single numeric value, set check_expression to null.
- Substitute concrete numbers for any variable that already has a value from prior steps.
- log(x) is natural log; use log10(x) for base-10; trig is in radians.
- Before returning, mentally evaluate check_expression and confirm it equals the numeric value of "result".`;

    const historyText = history.length
      ? history
          .map(
            (h, i) =>
              `Step ${i + 1} (${h.title}):\nExplanation: ${h.explanation}\nCalculation: ${h.calculation}\nResult: ${h.result}${h.computed != null ? ` (verified numeric ≈ ${h.computed})` : ""}`,
          )
          .join("\n\n")
      : "(no previous steps yet)";

    const basePrompt = `Problem:\n${session.problem_text}\n\nFull plan:\n${plan.steps
      .map((s, i) => `${i + 1}. ${s.title}`)
      .join("\n")}\n\nCompleted so far:\n${historyText}\n\nCurrent step to solve: ${idx + 1}. ${currentStep.title} (id=${currentStep.id})`;

    async function askExecutor(extraNote?: string, modelOverride?: string) {
      return callGeminiJSON<ExecutorResponse>({
        model: modelOverride ?? executorModel,
        temperature: 0.1,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: extraNote ? `${basePrompt}\n\nIMPORTANT CORRECTION:\n${extraNote}` : basePrompt },
        ],
      });
    }

    let exec: ExecutorResponse;
    try {
      exec = await askExecutor();
    } catch (err) {
      console.warn("Executor returned malformed JSON:", err);
      exec = {
        step_id: currentStep.id,
        explanation: "I had trouble formatting this step, so please double-check it.",
        calculation: "The AI response for this step could not be read safely.",
        result: "Needs review",
        check_expression: null,
        guiding_question: "What should we check before moving on?",
      };
    }

    let check = verifyResult(exec.result, exec.check_expression);
    let retried = false;

    function buildCorrectionNote(prev: ExecutorResponse, c: typeof check) {
      return `Your previous result was wrong. Recheck your work step by step and try again.

Details from the independent calculator: result="${prev.result}"; check_expression=${JSON.stringify(prev.check_expression)}; computed check value=${c.computed ?? "not evaluable"}; parsed claimed value=${c.claimed ?? "not evaluable"}; reason=${c.reason}. The check_expression must be a literal exact numeric math expression (no variables, no words, no units) whose value equals the numeric value of result. If this step is purely symbolic, return check_expression: null.`;
    }

    // First retry — same (fast) model.
    if (!check.ok && !check.skipped) {
      retried = true;
      try {
        const retryExec = await askExecutor(buildCorrectionNote(exec, check));
        exec = retryExec;
        check = verifyResult(exec.result, exec.check_expression);
      } catch (err) {
        console.warn("Executor retry failed:", err);
      }
    }

    // Second retry — escalate to Pro for accuracy on this one step only.
    if (!check.ok && !check.skipped) {
      try {
        const proExec = await askExecutor(
          `${buildCorrectionNote(exec, check)}\n\nThis is a final recalculation attempt — take extra care and be exact.`,
          EXECUTOR_MODEL_PRO,
        );
        exec = proExec;
        check = verifyResult(exec.result, exec.check_expression);
      } catch (err) {
        console.warn("Executor Pro recalculation failed:", err);
      }
    }

    const verificationWarning =
      check.ok
        ? undefined
        : check.computed == null
          ? "Please double-check this step — its calculator check could not be evaluated."
          : "Please double-check this step — its result did not match the calculator check.";

    const completed: CompletedStep = {
      step_id: currentStep.id,
      title: currentStep.title,
      explanation: exec.explanation,
      calculation: exec.calculation,
      result: exec.result,
      check_expression: exec.check_expression ?? null,
      guiding_question: exec.guiding_question,
      verified: check.verified,
      verified_ok: check.ok,
      skipped: check.skipped,
      retried,
      computed: check.computed,
      verification_warning: verificationWarning,
    };

    const newHistory = [...history, completed];
    const newIdx = idx + 1;
    const isDone = newIdx >= plan.steps.length;

    const { error: uErr } = await context.supabase
      .from("tutor_sessions")
      .update({
        step_history: newHistory as unknown as never,
        current_step_index: newIdx,
        status: isDone ? "complete" : "in_progress",
        final_answer: isDone ? completed.result : null,
      })
      .eq("id", data.sessionId);
    if (uErr) throw new Error(uErr.message);

    return { done: isDone, step: completed, currentIndex: newIdx };
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
