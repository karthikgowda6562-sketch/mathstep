import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listSessions } from "@/lib/tutor.functions";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/history")({
  component: HistoryPage,
});

function HistoryPage() {
  const list = useServerFn(listSessions);
  const { data, isLoading } = useQuery({
    queryKey: ["sessions"],
    queryFn: () => list(),
  });

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="flex items-center justify-between">
        <Link to="/">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-1 h-4 w-4" /> New problem
          </Button>
        </Link>
        <h1 className="font-serif-display text-xl font-semibold">Your problems</h1>
      </div>

      <div className="mt-8 space-y-3">
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {data && data.length === 0 && (
          <p className="text-sm text-muted-foreground">No problems yet — start one from the home page.</p>
        )}
        {data?.map((s) => {
          const plan = s.plan as { steps?: { id: string }[] } | null;
          const total = plan?.steps?.length ?? 0;
          return (
            <Link
              key={s.id}
              to="/solve/$sessionId"
              params={{ sessionId: s.id }}
              className="block rounded-xl border bg-card p-4 transition-colors hover:border-primary/40"
            >
              <p className="line-clamp-2 text-sm">{s.problem_text}</p>
              <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                <span>{new Date(s.created_at).toLocaleString()}</span>
                <span>·</span>
                <span>
                  {s.status === "complete"
                    ? "Complete"
                    : `Step ${s.current_step_index}/${total}`}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
