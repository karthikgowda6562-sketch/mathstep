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
  const cleaned = text
    .replace(/^\uFEFF/, "")
    .replace(/```(?:json)?\s*([\s\S]*?)```/gi, "$1")
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const first = cleaned.indexOf("{");
    const last = cleaned.lastIndexOf("}");
    if (first !== -1 && last > first) {
      try {
        return JSON.parse(cleaned.slice(first, last + 1)) as T;
      } catch {
        /* fall through */
      }
    }
    const preview = cleaned.slice(0, 200).replace(/\s+/g, " ");
    throw new Error(
      `AI returned non-JSON response${preview ? ` (starts with: "${preview}")` : " (empty response)"}`,
    );
  }
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
