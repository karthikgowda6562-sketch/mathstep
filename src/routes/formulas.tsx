import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { UniversalCalculator } from "@/components/UniversalCalculator";
import { Sparkles } from "lucide-react";

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

      <main className="mx-auto max-w-5xl px-6 pb-16 pt-4">
        <UniversalCalculator />
      </main>
    </div>
  );
}
