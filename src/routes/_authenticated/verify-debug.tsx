import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { verificationDebug } from "@/lib/tutor.functions";

export const Route = createFileRoute("/_authenticated/verify-debug")({
  head: () => ({
    meta: [
      { title: "Verification debug · MathStep" },
      { name: "description", content: "Inspect recent MathStep sessions to see which steps were auto-retried or skipped by the calculator verifier." },
      { property: "og:title", content: "Verification debug · MathStep" },
      { property: "og:description", content: "Recent verification outcomes per step." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: VerifyDebugPage,
});

function VerifyDebugPage() {
  const fetchDebug = useServerFn(verificationDebug);
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["verify-debug"],
    queryFn: () => fetchDebug({ data: undefined }),
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Verification debug</h1>
          <p className="text-sm text-muted-foreground">
            Last 5 sessions — which steps were auto-retried, skipped, or failed the calculator check.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => refetch()}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
          >
            {isFetching ? "Refreshing…" : "Refresh"}
          </button>
          <Link to="/history" className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted">
            History
          </Link>
        </div>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}

      <div className="space-y-6">
        {data?.map((s) => (
          <section key={s.sessionId} className="rounded-xl border bg-card p-5 shadow-sm">
            <header className="mb-3">
              <p className="text-sm font-medium truncate">{s.problem}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(s.createdAt as string).toLocaleString()} · steps: {s.totals.steps} · verified:{" "}
                <span className="text-success">{s.totals.verified}</span> · retried:{" "}
                <span className="text-warning">{s.totals.retried}</span> · skipped:{" "}
                {s.totals.skipped} · failed:{" "}
                <span className="text-destructive">{s.totals.failed}</span>
              </p>
            </header>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-muted-foreground">
                  <tr>
                    <th className="py-1 pr-2">#</th>
                    <th className="py-1 pr-2">Title</th>
                    <th className="py-1 pr-2">Result</th>
                    <th className="py-1 pr-2">check_expression</th>
                    <th className="py-1 pr-2">computed</th>
                    <th className="py-1 pr-2">status</th>
                  </tr>
                </thead>
                <tbody>
                  {s.steps.map((st) => (
                    <tr key={st.index} className="border-t align-top">
                      <td className="py-1 pr-2">{st.index}</td>
                      <td className="py-1 pr-2">{st.title}</td>
                      <td className="py-1 pr-2 font-mono">{st.result}</td>
                      <td className="py-1 pr-2 font-mono">{st.check_expression ?? "null"}</td>
                      <td className="py-1 pr-2 font-mono">{st.computed ?? "—"}</td>
                      <td className="py-1 pr-2">
                        {st.skipped
                          ? "skipped"
                          : st.verified_ok
                            ? "ok"
                            : "FAIL"}
                        {st.retried ? " · retried" : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
        {data && data.length === 0 && (
          <p className="text-sm text-muted-foreground">No sessions yet.</p>
        )}
      </div>
    </div>
  );
}
