import { jsonrepair } from "jsonrepair";

// Server-only helper for calling Lovable AI Gateway (Gemini).
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

// System prompt for the one-shot math solver. Enforces zero mental math,
// strict mathjs delegation, and modular arithmetic compatibility.
export const SOLVER_SYSTEM_PROMPT = `You are an ultra-fast, highly accurate math assistant designed to solve problems instantly for beginners. Your goal is to break down the solution into the most direct, straightforward path possible.

IMPORTANT: You are a structural planner ONLY. Never perform mental arithmetic or write computed answers inside the explanation string. Every single numerical calculation must be evaluated by mathjs via mathjs_expression. For modular operations, use valid mathjs syntax mod(expression, modulus). Explanations must be plain-spoken, beginner-friendly, and no longer than 2 sentences.

You MUST adhere strictly to the following rules:

1. MAXIMUM 3 STEPS: Compress the solution into 2 or 3 steps at most. Combine minor arithmetic operations into a single step. Do not drag out the solution.

2. STEP STRUCTURE:
   - Step 1: Break down the problem logically (e.g., binary exponent decomposition: 42 = 32 + 8 + 2).
   - Step 2: Compute necessary intermediate terms using mathjs_expression (e.g., evaluate key powers modulo N).
   - Step 3: Combine intermediate results into the final mathjs_expression for exact evaluation.

3. BEGINNER-ORIENTED EXPLANATIONS: Explain the logic in plain, everyday language. Do not use advanced mathematical jargon or textbook phrasing. Keep it strictly under 2 short sentences per step.

4. ZERO MENTAL MATH: NEVER compute intermediate or final numbers in your head or write hardcoded numerical results inside the explanation. Refer to values using clear math concepts (e.g., "Now multiply the calculated remainders together modulo 191").

5. 100% ACCURACY VIA DELEGATION: NEVER compute final numerical values yourself. Provide a mathjs expression and let the backend evaluate it.

6. MODULAR ARITHMETIC STANDARD: For modular exponentiation or modular arithmetic, use valid mathjs expressions:
   - mod(a, b) for a mod b
   - mod(2^32, 191) or mod(pow(2, 32), 191)
   - mod(147 * 65 * 4, 191)

7. ELEMENTARY METHODS FIRST: Prefer basic arithmetic and simple algebra over advanced formulas.

8. STRICT FORMATTING RULE (NO DOLLAR SIGNS, NO LATEX IN TEXT):
   Do NOT use dollar signs ($ or $$) or LaTeX code blocks inside any JSON text field ("title", "explanation", "summary", or list item "label"). Express all math concepts in plain readable text using unicode where helpful. Examples:
   - Write "2^8 mod 191 = 65" instead of "$2^8 \\pmod{191}$".
   - Write "3 × 4" or "3 * 4" instead of "$3 \\cdot 4$".
   - Write "sqrt(2)" or "√2" instead of "$\\sqrt{2}$".
   - Write "a/b" instead of "$\\frac{a}{b}$".
   Never emit \\pmod, \\cdot, \\times, \\frac, \\sqrt, \\begin{...}, or any other backslash LaTeX command inside JSON text fields. Keep text clean, simple, and free of escaped code symbols. Use plain hyphens for words like "top-left".

Each step MUST have a "result_type" of exactly one of: "scalar", "matrix", or "list".

- "scalar": the step produces a single number.
    Provide "mathjs_expression" as a raw arithmetic expression using ONLY numbers and operators (+ - * / ^ ( ) sqrt abs sin cos tan log log10 pi e mod pow). No variables, equals signs, words, units, or LaTeX. If the step is purely explanatory with no calculation, use an empty string.
    Omit matrix_expression and list_items (or leave them empty).

- "matrix": the step produces a 2D matrix (e.g. matrix addition, multiplication, transpose, inverse).
    Provide "matrix_expression" as a raw mathjs expression that evaluates to a 2D matrix, e.g. "[[1,2],[3,4]] + [[5,6],[7,8]]" or "inv([[1,2],[3,4]])" or "transpose([[1,2],[3,4]])". Use commas inside the matrix literals.
    Leave "mathjs_expression" empty. The backend evaluates the matrix and renders it as a grid — do not describe individual cells inside the explanation.

- "list": the step produces several distinct scalar values at once (e.g. "find each entry").
    Provide "list_items" as an array of {"label": "...", "mathjs_expression": "..."} objects, one per computed value.
    Leave "mathjs_expression" empty. The backend evaluates each item and shows them as a labeled list.

Respond ONLY with a valid JSON object of this shape:

{
  "summary": "1-sentence plain-English overview.",
  "steps": [
    {
      "title": "Short title of the step",
      "explanation": "Beginner-friendly explanation.",
      "result_type": "scalar" | "matrix" | "list",
      "mathjs_expression": "..." ,
      "matrix_expression": "..." ,
      "list_items": [{"label": "...", "mathjs_expression": "..."}]
    }
  ]
}`;

type Msg =
  | { role: "system" | "user" | "assistant"; content: string }
  | {
      role: "user";
      content: Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string } }
      >;
    };

export async function callGeminiJSON<T>(opts: {
  model: string;
  messages: Msg[];
  temperature?: number;
}): Promise<T> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Missing LOVABLE_API_KEY");

  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: opts.model,
      temperature: opts.temperature ?? 0.4,
      response_format: { type: "json_object" },
      messages: opts.messages,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    if (res.status === 429) throw new Error("AI rate limit reached. Try again in a moment.");
    if (res.status === 402)
      throw new Error("AI credits exhausted. Please add credits to continue.");
    throw new Error(`AI request failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  const text: string = data?.choices?.[0]?.message?.content ?? "";
  const cleaned = cleanJsonResponse(text);
  const candidates = jsonCandidates(cleaned);

  for (const candidate of candidates) {
    const parsed = tryParseJson<T>(candidate);
    if (parsed.ok) return parsed.value;
  }

  const preview = cleaned.slice(0, 200).replace(/\s+/g, " ");
  throw new Error(
    `AI returned non-JSON response${preview ? ` (starts with: "${preview}")` : " (empty response)"}`,
  );
}

function cleanJsonResponse(text: string): string {
  return text
    .replace(/^\uFEFF/, "")
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```$/i, "")
    .trim();
}

function jsonCandidates(text: string): string[] {
  const candidates = new Set<string>();
  const add = (value: string | null) => {
    const trimmed = value?.trim();
    if (trimmed) candidates.add(trimmed);
  };

  add(text);
  add(extractBalancedJsonObject(text));

  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first !== -1 && last > first) add(text.slice(first, last + 1));

  return [...candidates];
}

function tryParseJson<T>(raw: string): { ok: true; value: T } | { ok: false } {
  // Gemini sometimes returns otherwise-valid JSON with bare LaTeX backslashes
  // inside strings, e.g. "\times" or "\begin{pmatrix}". Bare backslashes are
  // invalid JSON and can also be misread as valid \t / \b / \f escapes, silently
  // corrupting math text. If the raw body looks LaTeX-heavy, repair first.
  if (hasPotentialBareLatex(raw)) {
    try {
      return { ok: true, value: JSON.parse(escapeBareBackslashesInJsonStrings(raw)) as T };
    } catch {
      // fall through to normal parsing/repair
    }
  }

  try {
    return { ok: true, value: JSON.parse(raw) as T };
  } catch {
    // fall through to repair strategies
  }

  for (const candidate of [escapeBareBackslashesInJsonStrings(raw), repairJson(raw)]) {
    if (!candidate) continue;
    try {
      return { ok: true, value: JSON.parse(candidate) as T };
    } catch {
      // try next repair strategy
    }
  }

  return { ok: false };
}

function hasPotentialBareLatex(raw: string): boolean {
  return /\\(?:begin|end|times|cdot|div|frac|sqrt|left|right|pmatrix|bmatrix|matrix|theta|alpha|beta|gamma|delta|pi|sin|cos|tan|log|ln|sum|int|lim|approx|leq|geq|neq|infty|text|mathbf|mathbb|overline|hat|bar|vec|dots|ldots|cdots)\b/.test(raw);
}

function repairJson(raw: string): string | null {
  try {
    return jsonrepair(raw);
  } catch {
    return null;
  }
}

function extractBalancedJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i += 1) {
    const char = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
    } else if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }

  return null;
}

function escapeBareBackslashesInJsonStrings(raw: string): string {
  let output = "";
  let inString = false;

  for (let i = 0; i < raw.length; i += 1) {
    const char = raw[i];
    const next = raw[i + 1];

    if (char === '"' && !isEscaped(raw, i)) {
      inString = !inString;
      output += char;
      continue;
    }

    if (inString && char === "\\") {
      if (next === '"' || next === "\\" || next === "/") {
        output += char + next;
        i += 1;
      } else if (next === "u" && /^[0-9a-fA-F]{4}$/.test(raw.slice(i + 2, i + 6))) {
        output += raw.slice(i, i + 6);
        i += 5;
      } else {
        output += "\\\\";
      }
      continue;
    }

    output += char;
  }

  return output;
}

function isEscaped(text: string, index: number): boolean {
  let slashCount = 0;
  for (let i = index - 1; i >= 0 && text[i] === "\\"; i -= 1) {
    slashCount += 1;
  }
  return slashCount % 2 === 1;
}

export async function callGeminiText(opts: {
  model: string;
  messages: Msg[];
  temperature?: number;
}): Promise<string> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Missing LOVABLE_API_KEY");

  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: opts.model,
      temperature: opts.temperature ?? 0.5,
      messages: opts.messages,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    if (res.status === 429) throw new Error("AI rate limit reached. Try again in a moment.");
    if (res.status === 402)
      throw new Error("AI credits exhausted. Please add credits to continue.");
    throw new Error(`AI request failed (${res.status}): ${body}`);
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? "";
}
