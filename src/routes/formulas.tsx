import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { evaluate } from "mathjs";
import { FORMULA_DB, type FormulaDef } from "@/lib/formulas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MathText } from "@/components/MathText";
import { Sparkles, Calculator, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/formulas")({
  head: () => ({
    meta: [
      { title: "Formula Calculator — MathStep" },
      {
        name: "description",
        content: "Plug numbers into common geometry, algebra, physics, and finance formulas and get instant, mathjs-verified answers.",
      },
      { property: "og:title", content: "Formula Calculator — MathStep" },
      {
        property: "og:description",
        content: "Instant, verified answers for common math, physics, and finance formulas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FormulasPage,
});

function FormulasPage() {
  const categories = useMemo(() => {
    const map = new Map<string, FormulaDef[]>();
    for (const f of FORMULA_DB) {
      if (!map.has(f.category)) map.set(f.category, []);
      map.get(f.category)!.push(f);
    }
    return Array.from(map.entries());
  }, []);

  const [selectedId, setSelectedId] = useState<string>(FORMULA_DB[0].id);
  const selected = FORMULA_DB.find((f) => f.id === selectedId)!;

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="h-4 w-4" />
          </div>
          <span className="font-serif-display text-xl font-semibold tracking-tight">
            MathStep
          </span>
        </Link>
        <Link to="/">
          <Button variant="ghost" size="sm">Back</Button>
        </Link>
      </header>

      <main className="mx-auto grid max-w-5xl gap-6 px-6 pb-16 md:grid-cols-[260px_1fr]">
        <aside className="rounded-2xl border bg-card p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Calculator className="h-4 w-4" /> Formulas
          </h2>
          <div className="space-y-4">
            {categories.map(([cat, items]) => (
              <div key={cat}>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {cat}
                </p>
                <ul className="space-y-1">
                  {items.map((f) => (
                    <li key={f.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(f.id)}
                        className={`w-full rounded-md px-2 py-1.5 text-left text-sm transition ${
                          f.id === selectedId
                            ? "bg-primary/10 text-foreground"
                            : "text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        {f.name}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </aside>

        <FormulaPanel key={selected.id} formula={selected} />
      </main>
    </div>
  );
}

function FormulaPanel({ formula }: { formula: FormulaDef }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function compute() {
    setError(null);
    setResult(null);
    const scope: Record<string, number> = {};
    for (const v of formula.variables) {
      const raw = (values[v.id] ?? "").trim();
      if (raw === "") {
        setError(`Please enter a value for ${v.label}.`);
        return;
      }
      const num = Number(raw);
      if (!Number.isFinite(num)) {
        setError(`"${raw}" is not a valid number for ${v.label}.`);
        return;
      }
      scope[v.id] = num;
    }
    try {
      const out = evaluate(formula.mathjs, scope);
      const num = typeof out === "number" ? out : Number((out as { valueOf: () => number }).valueOf());
      if (!Number.isFinite(num)) {
        setError("The result could not be evaluated as a finite number.");
        return;
      }
      const rounded = Math.abs(num - Math.round(num)) < 1e-9 ? Math.round(num) : Number(num.toFixed(6));
      setResult(String(rounded));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Evaluation failed.");
    }
  }

  return (
    <section className="rounded-2xl border bg-card p-6 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {formula.category}
      </p>
      <h1 className="mt-1 font-serif-display text-2xl font-semibold tracking-tight">
        {formula.name}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">{formula.description}</p>

      <div className="mt-4 rounded-xl border bg-muted/40 px-4 py-3">
        <MathText text={`$${formula.latex}$`} />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {formula.variables.map((v) => (
          <div key={v.id}>
            <Label htmlFor={`var-${v.id}`} className="text-sm">
              {v.label}
            </Label>
            <Input
              id={`var-${v.id}`}
              type="number"
              inputMode="decimal"
              step="any"
              value={values[v.id] ?? ""}
              onChange={(e) => setValues((s) => ({ ...s, [v.id]: e.target.value }))}
              placeholder="Enter a number"
              className="mt-1"
            />
          </div>
        ))}
      </div>

      <div className="mt-6 flex items-center gap-3">
        <Button onClick={compute}>Calculate</Button>
        <span className="text-xs text-muted-foreground">
          Evaluated with mathjs — no AI in the loop.
        </span>
      </div>

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {result != null && !error && (
        <div className="mt-4 rounded-xl border bg-primary/5 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Result
          </p>
          <p className="mt-1 font-serif-display text-3xl font-semibold">{result}</p>
        </div>
      )}
    </section>
  );
}
