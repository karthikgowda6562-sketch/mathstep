import { jsonrepair } from "jsonrepair";

// Server-only helper for calling Lovable AI Gateway (Gemini).
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

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
  try {
    return { ok: true, value: JSON.parse(raw) as T };
  } catch {
    // Gemini sometimes returns otherwise-valid JSON with bare LaTeX backslashes
    // inside strings, e.g. "\times" or "\begin{pmatrix}". Bare backslashes are
    // invalid JSON and can also be misread as \t / \b escapes. Repair those before
    // giving up so LaTeX-heavy math steps do not crash the solver.
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
        output += char;
      } else if (next === "u" && /^[0-9a-fA-F]{4}$/.test(raw.slice(i + 2, i + 6))) {
        output += char;
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
