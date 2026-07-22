export type FormulaCategory =
  | "Algebra"
  | "Geometry"
  | "Trigonometry"
  | "Matrices"
  | "Straight Line"
  | "Calculus";

export type StandardFormula = {
  kind: "standard";
  id: string;
  category: FormulaCategory;
  name: string;
  description: string;
  /** Template inserted into the problem input. Use `___` for user-fillable slots. */
  template: string;
};

export type MatrixFormula = {
  kind: "matrix";
  id: string;
  category: "Matrices";
  name: string;
  description: string;
  /** How many matrices the user needs to enter. */
  operands: 1 | 2;
  /** Builds the final problem string from filled matrices, e.g. [[1,2],[3,4]] */
  build: (matrices: string[]) => string;
};

export type Formula = StandardFormula | MatrixFormula;

export const FORMULA_DB: Formula[] = [
  // ===== ALGEBRA =====
  {
    kind: "standard",
    id: "quadratic",
    category: "Algebra",
    name: "Quadratic Formula",
    description: "Solve ax² + bx + c = 0.",
    template: "Solve using the quadratic formula: ax^2 + bx + c = 0 where a=___, b=___, c=___",
  },
  {
    kind: "standard",
    id: "linear_eq",
    category: "Algebra",
    name: "Linear Equation ax + b = c",
    description: "Solve for x in a linear equation.",
    template: "Solve for x: a*x + b = c where a=___, b=___, c=___",
  },

  // ===== GEOMETRY =====
  {
    kind: "standard",
    id: "circle_area",
    category: "Geometry",
    name: "Area of a Circle",
    description: "A = π r²",
    template: "Find the area of a circle with radius r=___",
  },
  {
    kind: "standard",
    id: "circle_circ",
    category: "Geometry",
    name: "Circumference of a Circle",
    description: "C = 2π r",
    template: "Find the circumference of a circle with radius r=___",
  },
  {
    kind: "standard",
    id: "rect_area",
    category: "Geometry",
    name: "Area of a Rectangle",
    description: "A = l × w",
    template: "Find the area of a rectangle with length l=___ and width w=___",
  },
  {
    kind: "standard",
    id: "rect_perim",
    category: "Geometry",
    name: "Perimeter of a Rectangle",
    description: "P = 2(l + w)",
    template: "Find the perimeter of a rectangle with length l=___ and width w=___",
  },
  {
    kind: "standard",
    id: "triangle_area",
    category: "Geometry",
    name: "Area of a Triangle",
    description: "A = ½ b h",
    template: "Find the area of a triangle with base b=___ and height h=___",
  },
  {
    kind: "standard",
    id: "pythagorean",
    category: "Geometry",
    name: "Pythagorean Theorem",
    description: "a² + b² = c²",
    template: "Using the Pythagorean theorem, find the hypotenuse c where a=___ and b=___",
  },

  // ===== TRIGONOMETRY =====
  {
    kind: "standard",
    id: "right_triangle",
    category: "Trigonometry",
    name: "Right Triangle — solve",
    description: "Use sin/cos/tan to solve a right triangle.",
    template: "Solve the right triangle where the known angle is ___ degrees and the ___ side = ___",
  },
  {
    kind: "standard",
    id: "law_sines",
    category: "Trigonometry",
    name: "Law of Sines",
    description: "a/sin A = b/sin B = c/sin C",
    template: "Using the Law of Sines, find the unknown side/angle where a=___, A=___°, b=___, B=___°",
  },
  {
    kind: "standard",
    id: "law_cosines",
    category: "Trigonometry",
    name: "Law of Cosines",
    description: "c² = a² + b² − 2ab cos C",
    template: "Using the Law of Cosines, find c where a=___, b=___, and angle C=___°",
  },

  // ===== MATRICES =====
  {
    kind: "matrix",
    id: "mat_add",
    category: "Matrices",
    name: "Matrix Addition / Subtraction",
    description: "Add or subtract two matrices of the same size.",
    operands: 2,
    build: ([a, b]) => `Add the matrices ${a} + ${b}`,
  },
  {
    kind: "matrix",
    id: "mat_mul",
    category: "Matrices",
    name: "Matrix Multiplication",
    description: "Multiply two matrices.",
    operands: 2,
    build: ([a, b]) => `Multiply the matrices ${a} * ${b}`,
  },
  {
    kind: "matrix",
    id: "mat_det",
    category: "Matrices",
    name: "Determinant",
    description: "Find the determinant of a 2×2 or 3×3 matrix.",
    operands: 1,
    build: ([a]) => `Find the determinant of ${a}`,
  },
  {
    kind: "matrix",
    id: "mat_inv",
    category: "Matrices",
    name: "Inverse",
    description: "Find the inverse of a matrix.",
    operands: 1,
    build: ([a]) => `Find the inverse of ${a}`,
  },
  {
    kind: "matrix",
    id: "mat_trans",
    category: "Matrices",
    name: "Transpose",
    description: "Find the transpose of a matrix.",
    operands: 1,
    build: ([a]) => `Find the transpose of ${a}`,
  },

  // ===== STRAIGHT LINE =====
  {
    kind: "standard",
    id: "slope",
    category: "Straight Line",
    name: "Slope Between Two Points",
    description: "m = (y₂ − y₁)/(x₂ − x₁)",
    template: "Find the slope of the line through (x1, y1) = (___, ___) and (x2, y2) = (___, ___)",
  },
  {
    kind: "standard",
    id: "line_eq",
    category: "Straight Line",
    name: "Equation of a Line",
    description: "y = m x + b",
    template: "Find the equation of the line with slope m=___ passing through the point (___, ___)",
  },
  {
    kind: "standard",
    id: "distance",
    category: "Straight Line",
    name: "Distance Between Two Points",
    description: "d = √((x₂−x₁)² + (y₂−y₁)²)",
    template: "Find the distance between the points (___, ___) and (___, ___)",
  },
  {
    kind: "standard",
    id: "midpoint",
    category: "Straight Line",
    name: "Midpoint",
    description: "M = ((x₁+x₂)/2, (y₁+y₂)/2)",
    template: "Find the midpoint of the segment from (___, ___) to (___, ___)",
  },

  // ===== CALCULUS =====
  {
    kind: "standard",
    id: "derivative",
    category: "Calculus",
    name: "Derivative (Power Rule)",
    description: "d/dx [xⁿ] = n xⁿ⁻¹",
    template: "Find the derivative with respect to x of: ___",
  },
  {
    kind: "standard",
    id: "definite_integral",
    category: "Calculus",
    name: "Definite Integral",
    description: "∫ₐᵇ f(x) dx",
    template: "Evaluate the definite integral of ___ with respect to x from x=___ to x=___",
  },
  {
    kind: "standard",
    id: "avg_rate",
    category: "Calculus",
    name: "Average Rate of Change",
    description: "(f(b) − f(a)) / (b − a)",
    template: "Find the average rate of change of f(x) = ___ from x=___ to x=___",
  },
];

export const FORMULA_CATEGORIES: FormulaCategory[] = [
  "Algebra",
  "Geometry",
  "Trigonometry",
  "Matrices",
  "Straight Line",
  "Calculus",
];
