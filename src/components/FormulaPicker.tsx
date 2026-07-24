import { useEffect, useMemo, useState } from "react";
import {
  FORMULA_CATEGORIES,
  FORMULA_DB,
  type Formula,
  type FormulaCategory,
  type MatrixFormula,
} from "@/lib/formulas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { MathText } from "@/components/MathText";
import { FunctionSquare } from "lucide-react";

type Props = {
  onInsert: (text: string) => void;
};

export function FormulaPicker({ onInsert }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState<FormulaCategory>(
    FORMULA_CATEGORIES[0],
  );
  const [matrixFormula, setMatrixFormula] = useState<MatrixFormula | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return FORMULA_DB.filter(
      (f) =>
        f.category === activeCat &&
        (q === "" ||
          f.name.toLowerCase().includes(q) ||
          f.description.toLowerCase().includes(q)),
    );
  }, [query, activeCat]);

  function handlePick(f: Formula) {
    if (f.kind === "standard") {
      onInsert(f.templateText);
      setOpen(false);
    } else {
      setMatrixFormula(f);
      setOpen(false);
    }
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="sm">
            <FunctionSquare className="mr-1 h-4 w-4" />
            Formulas
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[min(94vw,560px)] p-3"
        >
          <div className="flex flex-col gap-2 sm:flex-row">
            <Select
              value={activeCat}
              onValueChange={(v) => setActiveCat(v as FormulaCategory)}
            >
              <SelectTrigger className="w-full sm:w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FORMULA_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Search formulas…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1"
            />
          </div>

          <div className="mt-3 max-h-80 overflow-y-auto pr-1">
            <div className="grid gap-2">
              {filtered.length === 0 && (
                <p className="p-3 text-sm text-muted-foreground">
                  No formulas match.
                </p>
              )}
              {filtered.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => handlePick(f)}
                  className="rounded-md border bg-card p-3 text-left transition hover:bg-accent"
                >
                  <p className="text-sm font-medium">{f.name}</p>
                  <div className="mt-1 overflow-x-auto text-sm">
                    <MathText text={`$$${f.latex}$$`} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {f.description}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <MatrixEntryDialog
        formula={matrixFormula}
        onClose={() => setMatrixFormula(null)}
        onConfirm={(text) => {
          onInsert(text);
          setMatrixFormula(null);
        }}
      />
    </>
  );
}

function MatrixEntryDialog({
  formula,
  onClose,
  onConfirm,
}: {
  formula: MatrixFormula | null;
  onClose: () => void;
  onConfirm: (text: string) => void;
}) {
  const [size, setSize] = useState<2 | 3>(2);
  const [matrices, setMatrices] = useState<string[][][]>([]);

  useEffect(() => {
    if (!formula) return;
    const empty = () =>
      Array.from({ length: size }, () =>
        Array.from({ length: size }, () => ""),
      );
    setMatrices(Array.from({ length: formula.operands }, empty));
  }, [formula, size]);

  if (!formula) return null;

  function updateCell(mi: number, r: number, c: number, v: string) {
    setMatrices((prev) => {
      const next = prev.map((m) => m.map((row) => row.slice()));
      next[mi][r][c] = v;
      return next;
    });
  }

  function serialize(m: string[][]) {
    return (
      "[" +
      m
        .map(
          (row) =>
            "[" +
            row.map((v) => (v.trim() === "" ? "0" : v.trim())).join(",") +
            "]",
        )
        .join(",") +
      "]"
    );
  }

  function confirm() {
    if (!formula) return;
    const parts = matrices.map(serialize);
    onConfirm(formula.build(parts));
  }

  return (
    <Dialog open={!!formula} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{formula.name}</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-3">
          <Label className="text-sm">Size</Label>
          <div className="flex gap-1">
            {[2, 3].map((s) => (
              <Button
                key={s}
                type="button"
                size="sm"
                variant={size === s ? "default" : "outline"}
                onClick={() => setSize(s as 2 | 3)}
              >
                {s}×{s}
              </Button>
            ))}
          </div>
        </div>

        <div className="mt-2 space-y-4">
          {matrices.map((mat, mi) => (
            <div key={mi}>
              <p className="mb-1 text-xs text-muted-foreground">
                Matrix {String.fromCharCode(65 + mi)}
              </p>
              <div
                className="grid gap-1"
                style={{
                  gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`,
                }}
              >
                {mat.map((row, r) =>
                  row.map((val, c) => (
                    <Input
                      key={`${r}-${c}`}
                      value={val}
                      inputMode="decimal"
                      onChange={(e) => updateCell(mi, r, c, e.target.value)}
                      className="h-10 text-center"
                    />
                  )),
                )}
              </div>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={confirm}>Insert into problem</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
