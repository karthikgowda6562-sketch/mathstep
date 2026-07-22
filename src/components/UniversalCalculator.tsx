import { useState, useMemo } from "react";
import * as math from "mathjs";
import { FORMULA_DB, type FormulaDef } from "@/lib/formulas";
import { MathText } from "./MathText";

export function UniversalCalculator() {
  const [selectedId, setSelectedId] = useState<string>(FORMULA_DB[0].id);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const activeFormula = FORMULA_DB.find((f) => f.id === selectedId) as FormulaDef;

  const groupedFormulas = useMemo(() => {
    return FORMULA_DB.reduce((acc, formula) => {
      if (!acc[formula.category]) acc[formula.category] = [];
      acc[formula.category].push(formula);
      return acc;
    }, {} as Record<string, FormulaDef[]>);
  }, []);

  const handleFormulaChange = (newId: string) => {
    setSelectedId(newId);
    setInputs({});
  };

  const handleInputChange = (varId: string, value: string) => {
    setInputs((prev) => ({ ...prev, [varId]: value }));
  };

  const calculateResult = () => {
    const missingVars = activeFormula.variables.some((v) => !inputs[v.id]);
    if (missingVars) return "Enter all values";
    try {
      const scope = Object.fromEntries(
        Object.entries(inputs).map(([key, val]) => [key, Number(val)]),
      );
      const result = math.evaluate(activeFormula.mathjs, scope);
      return math.round(result, 4).toString();
    } catch {
      return "Calculation error";
    }
  };

  return (
    <div className="mx-auto max-w-xl rounded-xl border bg-card p-6 shadow-sm">
      <h2 className="mb-4 font-serif-display text-xl font-semibold">
        Universal Formula Calculator
      </h2>

      <select
        className="mb-6 w-full rounded-lg border border-input bg-background p-2 text-sm"
        value={selectedId}
        onChange={(e) => handleFormulaChange(e.target.value)}
      >
        {Object.entries(groupedFormulas).map(([category, formulas]) => (
          <optgroup key={category} label={category}>
            {formulas.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>

      <div className="mb-6 rounded-lg border bg-muted/40 p-4">
        <p className="mb-2 text-sm text-muted-foreground">{activeFormula.description}</p>
        <div className="py-2 text-lg">
          <MathText text={`$$${activeFormula.latex}$$`} />
        </div>
      </div>

      <div className="mb-6 space-y-4">
        {activeFormula.variables.map((v) => (
          <div key={v.id} className="flex flex-col">
            <label className="mb-1 text-sm font-medium">{v.label}</label>
            <input
              type="number"
              step="any"
              className="rounded-lg border border-input bg-background p-2 focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder={`Enter ${v.id}...`}
              value={inputs[v.id] || ""}
              onChange={(e) => handleInputChange(v.id, e.target.value)}
            />
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Result
        </span>
        <span className="font-serif-display text-2xl font-bold">{calculateResult()}</span>
      </div>
    </div>
  );
}
