import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Use the strongest available Gemini for accuracy on math reasoning.
const PLANNER_MODEL = "google/gemini-2.5-pro";
const EXECUTOR_MODEL = "google/gemini-2.5-pro";
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
  check_expression: string;
  guiding_question?: string;
  verified: boolean;
  verified_ok: boolean;
  computed?: number | null;
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

    const systemPrompt = `You are the PLANNER for a rigorous step-by-step math tutor.
Your ONLY job is to name the steps required to solve the problem correctly.
Do NOT solve the problem. Do NOT reveal intermediate results or the final answer.
Think carefully about the correct mathematical approach before naming steps. Respect order of operations (PEMDAS/BODMAS), algebraic identities, calculus rules, geometry theorems, and unit consistency.
Return strict JSON: {"domain": string, "difficulty": "easy"|"medium"|"hard", "steps": [{"id": "s1", "title": "short step name"}]}
Use 2 to 8 steps. Titles must be short (max 70 chars) and describe WHAT will be done (e.g. "Apply the quadratic formula", "Isolate x"), not the answer.
The FINAL step must state or verify the answer (e.g. "State the final answer" or "Verify by substitution").`;

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

    const systemPrompt = `You are the EXECUTOR for a rigorous step-by-step math tutor. Accuracy is the #1 priority.

Rules of reasoning (follow every time):
- Think through the step silently before writing. Prefer symbolic manipulation, then substitute numbers.
- Respect order of operations (PEMDAS/BODMAS). Multiplication/division before addition/subtraction. Parentheses first. Exponents before multiplication.
- Distribute signs carefully. -(a - b) = -a + b. Watch minus signs on every line.
- Keep exact values (fractions, radicals, pi, e) whenever possible; only decimal-approximate at the FINAL step, and give at least 4 significant figures.
- Preserve units. Convert to consistent units before combining. Keep units in the result.
- Use the CORRECT rules for the domain: quadratic formula, factoring, log/exponent laws, trig identities, derivative/integral rules, geometry theorems, probability axioms, matrix rules, etc.
- Never invent identities. If unsure, expand from definitions.
- Independently redo the arithmetic of this step in your head before writing "result".
- Use ONLY facts established in the completed steps below. Do not skip ahead or assume a later step.

Solve ONLY the current step. Return strict JSON:
{
  "step_id": string,
  "explanation": string,        // 1-3 short sentences in plain English, WHY this step is done
  "calculation": string,        // the math work for this step. Wrap formulas in $...$ (LaTeX). Show intermediate simplification.
  "result": string,             // the resulting value or expression of THIS step only. Prefer exact form; add "≈ <decimal>" when helpful.
  "check_expression": string,   // a plain mathjs-evaluable numeric expression whose value equals the numeric value of the step's result (e.g. "(-3 + sqrt(9 - 4*1*-4)) / (2*1)"). No LaTeX, no words, no units. If the result is purely symbolic with unbound variables, return "".
  "guiding_question": string    // one short question a tutor could ask before showing the calculation
}

mathjs syntax for check_expression: use *, /, +, -, ^, sqrt(), abs(), sin/cos/tan (radians), log(x) is natural log, log10(x), pi, e. Substitute concrete numbers for any variable that already has a value from prior steps.`;

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

    async function askExecutor(extraNote?: string) {
      return callGeminiJSON<{
        step_id: string;
        explanation: string;
        calculation: string;
        result: string;
        check_expression: string;
        guiding_question?: string;
      }>({
        model: EXECUTOR_MODEL,
        temperature: 0.1,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: extraNote ? `${basePrompt}\n\nIMPORTANT CORRECTION:\n${extraNote}` : basePrompt },
        ],
      });
    }

    let exec = await askExecutor();
    let check = verifyResult(exec.result, exec.check_expression);
    if (check.verified && !check.ok) {
      // retry once with explicit feedback about the mismatch
      const note = `Your previous attempt had an arithmetic mismatch. You wrote result="${exec.result}" but the check_expression "${exec.check_expression}" evaluates to ${check.computed}. Recompute the step carefully. Either fix the result to match a correct check_expression, or fix the check_expression so it truly represents the step's numeric result. Re-derive from scratch.`;
      exec = await askExecutor(note);
      check = verifyResult(exec.result, exec.check_expression);
    }


    const completed: CompletedStep = {
      step_id: currentStep.id,
      title: currentStep.title,
      explanation: exec.explanation,
      calculation: exec.calculation,
      result: exec.result,
      check_expression: exec.check_expression,
      guiding_question: exec.guiding_question,
      verified: check.verified,
      verified_ok: check.ok,
      computed: check.computed,
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
      model: EXECUTOR_MODEL,
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
      model: EXECUTOR_MODEL,
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
      model: EXECUTOR_MODEL,
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
