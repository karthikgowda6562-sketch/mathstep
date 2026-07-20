import { InlineMath, BlockMath } from "react-katex";
import { Fragment } from "react";

// Render text that may contain $...$ inline or $$...$$ block LaTeX.
export function MathText({ text, className }: { text: string; className?: string }) {
  if (!text) return null;
  // Split on $$...$$ first, then $...$
  const blockParts = text.split(/(\$\$[^$]+\$\$)/g);
  return (
    <span className={className}>
      {blockParts.map((chunk, i) => {
        if (chunk.startsWith("$$") && chunk.endsWith("$$")) {
          return <BlockMath key={i} math={chunk.slice(2, -2)} />;
        }
        // inline split
        const inlineParts = chunk.split(/(\$[^$\n]+\$)/g);
        return (
          <Fragment key={i}>
            {inlineParts.map((p, j) => {
              if (p.startsWith("$") && p.endsWith("$") && p.length > 2) {
                try {
                  return <InlineMath key={j} math={p.slice(1, -1)} />;
                } catch {
                  return <span key={j}>{p}</span>;
                }
              }
              return <span key={j}>{p}</span>;
            })}
          </Fragment>
        );
      })}
    </span>
  );
}
