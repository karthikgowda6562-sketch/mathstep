import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import {
  getSession,
  runNextStep,
  explainStep,
  similarProblem,
  setSessionMode,
  createTutorSession,
  checkGuidedAnswer,
  type CompletedStep,
  type Plan,
} from "@/lib/tutor.functions";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { MathText } from "@/components/MathText";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle2,
  HelpCircle,
  Loader2,
  Sparkles,
  AlertTriangle,
  MessageCircle,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/solve/$sessionId")({
  component: SolvePage,
});

interface SessionRow {
  id: string;
  problem_text: string;
  plan: Plan;
  step_history: CompletedStep[];
  current_step_index: number;
  mode: "guided" | "direct";
  status: string;
  final_answer: string | null;
}

function SolvePage() {
  const { sessionId } = Route.useParams();
  const navigate = useNavigate();
  const load = useServerFn(getSession);
  const nextStep = useServerFn(runNextStep);
  const changeMode = useServerFn(setSessionMode);
  const similar = useServerFn(similarProblem);
  const createNew = useServerFn(createTutorSession);

  const [session, setSession] = useState<SessionRow | null>(null);
  const [loadingStep, setLoadingStep] = useState(false);
  const [justRevealedId, setJustRevealedId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const s = (await load({ data: { sessionId } })) as unknown as SessionRow;
    setSession(s);
  }, [load, sessionId]);

  useEffect(() => {
    refresh().catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load"));
  }, [refresh]);

  const total = session?.plan?.steps?.length ?? 0;
  const done = session?.current_step_index ?? 0;
  const isComplete = !!session && done >= total && total > 0;

  const revealNext = useCallback(async () => {
    setLoadingStep(true);
    try {
      const res = await nextStep({ data: { sessionId } });
      if (res.step) setJustRevealedId(res.step.step_id);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoadingStep(false);
    }
  }, [nextStep, refresh, sessionId]);

  // Auto-reveal steps one after another until the problem is solved
  useEffect(() => {
    if (!session) return;
    if (loadingStep) return;
    if (total === 0) return;
    if (done >= total) return;
    revealNext();
  }, [session, loadingStep, done, total, revealNext]);

  async function toggleGuided(v: boolean) {
    if (!session) return;
    await changeMode({ data: { sessionId, mode: v ? "guided" : "direct" } });
    setSession({ ...session, mode: v ? "guided" : "direct" });
  }

  async function onSimilar() {
    if (!session) return;
    toast.info("Generating a similar problem…");
    try {
      const { problem } = await similar({ data: { sessionId } });
      const res = await createNew({ data: { problem, mode: session.mode } });
      navigate({ to: "/solve/$sessionId", params: { sessionId: res.sessionId } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  if (!session) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-6 py-6">
        <Link to="/">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-1 h-4 w-4" /> New problem
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <Switch
            id="guided"
            checked={session.mode === "guided"}
            onCheckedChange={toggleGuided}
          />
          <Label htmlFor="guided" className="text-sm">Guided</Label>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 pb-24">
        <div className="rounded-2xl border bg-card p-6 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Problem</p>
          <div className="mt-2 text-lg leading-relaxed">
            <MathText text={session.problem_text} />
          </div>
          {session.plan?.domain && (
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span className="rounded-full bg-secondary px-2 py-0.5">{session.plan.domain}</span>
              {session.plan.difficulty && (
                <span className="rounded-full bg-secondary px-2 py-0.5">
                  {session.plan.difficulty}
                </span>
              )}
            </div>
          )}
        </div>

        {total > 0 && (
          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between text-sm text-muted-foreground">
              <span>Step {Math.min(done, total)} of {total}</span>
              <span>{Math.round((done / total) * 100)}%</span>
            </div>
            <Progress value={(done / total) * 100} />
          </div>
        )}

        <ol className="mt-8 space-y-4">
          {session.plan?.steps?.map((s, i) => {
            const completed = session.step_history[i];
            const isCurrent = i === done && !isComplete;
            const guidedHidden = false;
            return (
              <StepItem
                key={s.id}
                index={i}
                title={s.title}
                completed={completed}
                isCurrent={isCurrent}
                sessionId={sessionId}
                guidedHidden={guidedHidden}
                onRevealCalc={() => setJustRevealedId(null)}
                onReveal={revealNext}
                loading={loadingStep}
              />
            );
          })}
        </ol>

        {isComplete && session.final_answer && (
          <div className="mt-10 rounded-2xl border-2 border-primary/20 bg-primary/5 p-6">
            <div className="flex items-center gap-2 text-primary">
              <Sparkles className="h-5 w-5" />
              <p className="text-sm font-medium uppercase tracking-wide">Final answer</p>
            </div>
            <div className="mt-3 font-serif-display text-3xl font-semibold">
              <MathText text={session.final_answer} />
            </div>
            <div className="mt-6">
              <Button onClick={onSimilar}>Generate a similar practice problem</Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function StepItem(props: {
  index: number;
  title: string;
  completed?: CompletedStep;
  isCurrent: boolean;
  loading: boolean;
  onReveal: () => void;
  sessionId: string;
  guidedHidden: boolean;
  onRevealCalc: () => void;
}) {
  const { index, title, completed, isCurrent, loading, onReveal, guidedHidden } = props;
  const explain = useServerFn(explainStep);
  const checkAnswer = useServerFn(checkGuidedAnswer);
  const [asking, setAsking] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [studentAnswer, setStudentAnswer] = useState("");
  const [checking, setChecking] = useState(false);
  const [feedback, setFeedback] = useState<{
    verdict: "correct" | "partial" | "incorrect";
    feedback: string;
  } | null>(null);

  async function submitGuidedAnswer() {
    if (!completed || !studentAnswer.trim()) return;
    setChecking(true);
    try {
      const r = await checkAnswer({
        data: {
          sessionId: props.sessionId,
          stepId: completed.step_id,
          answer: studentAnswer,
        },
      });
      setFeedback(r);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setChecking(false);
    }
  }

  async function ask() {
    if (!completed || !question.trim()) return;
    setAsking(true);
    try {
      const r = await explain({
        data: { sessionId: props.sessionId, stepId: completed.step_id, question },
      });
      setAnswer(r.answer);
      setQuestion("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setAsking(false);
    }
  }

  if (!completed && !isCurrent) {
    return (
      <li className="rounded-xl border border-dashed bg-card/40 p-4 opacity-60">
        <p className="text-sm text-muted-foreground">
          <span className="font-medium">Step {index + 1}.</span> {title}
        </p>
      </li>
    );
  }

  if (isCurrent && !completed) {
    return (
      <li className="rounded-xl border bg-card p-6 shadow-sm">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Working on</p>
        <p className="mt-1 font-medium">
          Step {index + 1}. {title}
        </p>
        <div className="mt-3 flex items-center text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Solving…
        </div>
      </li>
    );
  }

  if (!completed) return null;

  return (
    <li className="rounded-xl border bg-card p-6 shadow-sm">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        <span>Step {index + 1}</span>
        {completed.verified && completed.verified_ok && (
          <span className="inline-flex items-center gap-1 text-success">
            <CheckCircle2 className="h-3.5 w-3.5" /> verified
          </span>
        )}
        {completed.skipped && (
          <span className="inline-flex items-center gap-1 text-muted-foreground" title="This step is symbolic — no numeric calculator check applies.">
            symbolic step (no numeric check)
          </span>
        )}
        {!completed.verified_ok && !completed.skipped && (
          <span className="inline-flex items-center gap-1 text-warning" title={completed.verification_warning ?? "Please double-check this step"}>
            <AlertTriangle className="h-3.5 w-3.5" /> please double-check this step
          </span>
        )}
        {completed.retried && (
          <span className="text-muted-foreground" title="Executor was auto-retried after a failed calculator check.">· auto-retried</span>
        )}
      </div>
      <p className="mt-1 font-medium">{completed.title}</p>

      {guidedHidden ? (
        <div className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-4">
          <p className="text-sm font-medium">Before we go on…</p>
          <div className="mt-1 text-sm">
            <MathText text={completed.guiding_question ?? ""} />
          </div>
          <Textarea
            value={studentAnswer}
            onChange={(e) => setStudentAnswer(e.target.value)}
            placeholder="Type your answer to the question above"
            className="mt-3 min-h-16 bg-background"
            disabled={checking}
          />
          {feedback && (
            <div
              className={`mt-3 rounded-md border p-3 text-sm ${
                feedback.verdict === "correct"
                  ? "border-success/40 bg-success/10 text-success-foreground"
                  : feedback.verdict === "partial"
                    ? "border-warning/40 bg-warning/10"
                    : "border-destructive/40 bg-destructive/10"
              }`}
            >
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide">
                {feedback.verdict === "correct" ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" /> Nice — that's right
                  </>
                ) : feedback.verdict === "partial" ? (
                  <>
                    <AlertTriangle className="h-3.5 w-3.5" /> Almost there
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-3.5 w-3.5" /> Not quite
                  </>
                )}
              </div>
              <div className="mt-1">
                <MathText text={feedback.feedback} />
              </div>
            </div>
          )}
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={submitGuidedAnswer}
              disabled={checking || !studentAnswer.trim()}
            >
              {checking ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : null}
              Check my answer
            </Button>
            <Button size="sm" onClick={props.onRevealCalc}>
              Show the solution
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-3 text-[15px] leading-relaxed">
            <MathText text={completed.explanation} />
          </div>
          {completed.calculation && (
            <div className="calc-block mt-3">
              <MathText text={completed.calculation} />
            </div>
          )}
          <div className="mt-3 flex items-baseline gap-2 text-sm">
            <span className="text-muted-foreground">Result:</span>
            <span className="font-medium">
              <MathText text={completed.result} />
            </span>
          </div>

          <div className="mt-4 border-t pt-4">
            {answer && (
              <div className="mb-3 rounded-lg bg-accent/40 p-3 text-sm">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <MessageCircle className="h-3.5 w-3.5" /> Re-explanation
                </div>
                <div className="mt-1">
                  <MathText text={answer} />
                </div>
              </div>
            )}
            {asking ? (
              <div className="flex items-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> thinking…
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <Textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Why did you do that? Ask anything about this step…"
                  className="min-h-10 flex-1 bg-background"
                />
                <Button size="sm" variant="outline" onClick={ask} disabled={!question.trim()}>
                  <HelpCircle className="mr-1 h-4 w-4" /> Ask
                </Button>
              </div>
            )}
          </div>
        </>
      )}
    </li>
  );
}
