export type FormulaDef = {
  id: string;
  category: string;
  name: string;
  description: string;
  variables: { id: string; label: string }[];
  mathjs: string;
  latex: string;
};

export const FORMULA_DB: FormulaDef[] = [
  // --- GEOMETRY ---
  {
    id: "area_circle",
    category: "Geometry",
    name: "Area of a Circle",
    description: "Calculate the area using the radius.",
    variables: [{ id: "r", label: "Radius (r)" }],
    mathjs: "pi * r^2",
    latex: "A = \\pi r^2",
  },
  {
    id: "vol_cylinder",
    category: "Geometry",
    name: "Volume of a Cylinder",
    description: "Calculate volume using radius and height.",
    variables: [
      { id: "r", label: "Radius (r)" },
      { id: "h", label: "Height (h)" },
    ],
    mathjs: "pi * r^2 * h",
    latex: "V = \\pi r^2 h",
  },
  // --- ALGEBRA ---
  {
    id: "pythagorean",
    category: "Algebra",
    name: "Pythagorean Theorem (Hypotenuse)",
    description: "Find the hypotenuse (c) of a right triangle.",
    variables: [
      { id: "a", label: "Side a" },
      { id: "b", label: "Side b" },
    ],
    mathjs: "sqrt(a^2 + b^2)",
    latex: "c = \\sqrt{a^2 + b^2}",
  },
  // --- PHYSICS / KINEMATICS ---
  {
    id: "kinetic_energy",
    category: "Physics",
    name: "Kinetic Energy",
    description: "Calculate energy of an object in motion.",
    variables: [
      { id: "m", label: "Mass (kg)" },
      { id: "v", label: "Velocity (m/s)" },
    ],
    mathjs: "0.5 * m * v^2",
    latex: "KE = \\frac{1}{2}mv^2",
  },
  // --- FINANCE ---
  {
    id: "simple_interest",
    category: "Finance",
    name: "Simple Interest",
    description: "Calculate interest over time.",
    variables: [
      { id: "P", label: "Principal ($)" },
      { id: "r", label: "Annual Rate (decimal, e.g., 0.05)" },
      { id: "t", label: "Time (years)" },
    ],
    mathjs: "P * r * t",
    latex: "I = P r t",
  },
];

export function getFormula(id: string): FormulaDef | undefined {
  return FORMULA_DB.find((f) => f.id === id);
}
