import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { createTutorSession } from "@/lib/tutor.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Sparkles, ImagePlus, X, LogOut, History } from "lucide-react";
import { FormulaPicker } from "@/components/FormulaPicker";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MathStep — Verified AI Math Tutor" },
      {
        name: "description",
        content: "MathStep breaks math problems into verified, plain-spoken steps with follow-up explanations.",
      },
      { property: "og:title", content: "MathStep — Verified AI Math Tutor" },
      {
        property: "og:description",
        content: "Solve math problems one verified step at a time with a patient AI tutor.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();
  const createSession = useServerFn(createTutorSession);
  const [problem, setProblem] = useState("");
  const [mode, setMode] = useState<"guided" | "direct">("direct");
  const [imageData, setImageData] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<{ email?: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setSession({ email: data.user.email ?? undefined });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s?.user ? { email: s.user.email ?? undefined } : null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function onImage(f: File) {
    if (f.size > 4 * 1024 * 1024) {
      toast.error("Image too large (max 4MB)");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setImageData(reader.result as string);
    reader.readAsDataURL(f);
  }

  async function onSubmit() {
    if (!problem.trim() && !imageData) {
      toast.error("Enter a problem or upload an image");
      return;
    }
    if (!session) {
      toast.error("Please sign in to solve a problem");
      navigate({ to: "/auth" });
      return;
    }
    setLoading(true);
    try {
      const res = await createSession({
        data: { problem: problem.trim() || "See attached image.", mode, imageDataUrl: imageData ?? undefined },
      });
      navigate({ to: "/solve/$sessionId", params: { sessionId: res.sessionId } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create session");
    } finally {
      setLoading(false);
    }
  }

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
        <nav className="flex items-center gap-2 text-sm">
          <Link to="/formulas">
            <Button variant="ghost" size="sm">
              <Calculator className="mr-1 h-4 w-4" /> Formulas
            </Button>
          </Link>
          {session ? (
            <>
              <Link to="/history">
                <Button variant="ghost" size="sm">
                  <History className="mr-1 h-4 w-4" /> History
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  await supabase.auth.signOut();
                  toast.success("Signed out");
                }}
              >
                <LogOut className="mr-1 h-4 w-4" /> Sign out
              </Button>
            </>
          ) : (
            <Link to="/auth">
              <Button variant="ghost" size="sm">Sign in</Button>
            </Link>
          )}
        </nav>
      </header>

      <main className="mx-auto max-w-3xl px-6 pb-16 pt-8">
        <div className="text-center">
          <p className="text-sm font-medium text-primary">Step-by-step AI math tutor</p>
          <h1 className="mt-3 font-serif-display text-4xl font-semibold tracking-tight md:text-5xl">
            Learn the how, not just the answer.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground">
            Paste a math problem and MathStep will break it into calm, verified steps —
            revealing them one at a time so you actually follow along.
          </p>
        </div>

        <div className="mt-10 rounded-2xl border bg-card p-6 shadow-sm">
          <Label htmlFor="problem" className="text-sm text-muted-foreground">
            Your math problem
          </Label>
          <Textarea
            id="problem"
            value={problem}
            onChange={(e) => setProblem(e.target.value)}
            placeholder="e.g. Solve for x: 3(x - 4) + 2 = 5x - 6"
            className="mt-2 min-h-32 resize-none bg-background text-base leading-relaxed"
          />

          {imageData && (
            <div className="mt-3 flex items-center gap-3 rounded-lg border bg-muted/40 p-2">
              <img src={imageData} alt="Uploaded problem" className="h-16 w-16 rounded object-cover" />
              <span className="flex-1 truncate text-sm text-muted-foreground">Image attached</span>
              <Button variant="ghost" size="icon" onClick={() => setImageData(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && onImage(e.target.files[0])}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
              >
                <ImagePlus className="mr-1 h-4 w-4" />
                Upload image
              </Button>

              <div className="flex items-center gap-2">
                <Switch
                  id="guided"
                  checked={mode === "guided"}
                  onCheckedChange={(v) => setMode(v ? "guided" : "direct")}
                />
                <Label htmlFor="guided" className="text-sm">
                  Guided mode
                </Label>
              </div>
            </div>
            <Button onClick={onSubmit} disabled={loading} size="lg">
              {loading ? "Planning…" : "Start solving"}
            </Button>
          </div>
        </div>

        <div className="mt-10 grid gap-4 text-sm text-muted-foreground md:grid-cols-3">
          <Feature title="One step at a time" text="Steps reveal in sequence so nothing feels overwhelming." />
          <Feature title="Independently verified" text="Every calculation is checked by a math engine before you see it." />
          <Feature title="Ask why, anytime" text="Tap 'Why did you do that?' on any step for a fresh explanation." />
        </div>
      </main>
    </div>
  );
}

function Feature({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-xl border bg-card/60 p-4">
      <p className="font-medium text-foreground">{title}</p>
      <p className="mt-1 text-sm">{text}</p>
    </div>
  );
}
