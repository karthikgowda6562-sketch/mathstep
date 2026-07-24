// DCET C20 Mathematics Syllabus formula library.
// Five primary categories map to the DCET C20 modules.

export type FormulaCategory =
  | "Fundamental & Basic Math"
  | "Matrices & Determinants"
  | "Straight Lines"
  | "Trigonometry"
  | "Differential Calculus"
  | "Integral Calculus";

export type StandardFormula = {
  kind: "standard";
  id: string;
  category: FormulaCategory;
  name: string;
  description: string;
  /** KaTeX-formatted LaTeX preview shown in the picker. */
  latex: string;
  /** Text inserted into the problem input. Use `___` for user-fillable slots. */
  templateText: string;
};

export type MatrixFormula = {
  kind: "matrix";
  id: string;
  category: "Matrices & Determinants";
  name: string;
  description: string;
  latex: string;
  operands: 1 | 2;
  build: (matrices: string[]) => string;
};

export type Formula = StandardFormula | MatrixFormula;

export const FORMULA_CATEGORIES: FormulaCategory[] = [
  "Fundamental & Basic Math",
  "Matrices & Determinants",
  "Straight Lines",
  "Trigonometry",
  "Differential Calculus",
  "Integral Calculus",
];

export const FORMULA_DB: Formula[] = [
  // =====================================================================
  // 0. FUNDAMENTAL & BASIC MATH
  // =====================================================================

  // -- Algebraic Identities --
  {
    kind: "standard",
    id: "identity-square-sum",
    category: "Fundamental & Basic Math",
    name: "Perfect Square (Sum)",
    description: "Expansion of (a + b) squared.",
    latex: String.raw`(a + b)^2 = a^2 + 2ab + b^2`,
    templateText: "Expand (___ + ___)^2",
  },
  {
    kind: "standard",
    id: "identity-square-diff",
    category: "Fundamental & Basic Math",
    name: "Perfect Square (Difference)",
    description: "Expansion of (a − b) squared.",
    latex: String.raw`(a - b)^2 = a^2 - 2ab + b^2`,
    templateText: "Expand (___ - ___)^2",
  },
  {
    kind: "standard",
    id: "identity-diff-of-squares",
    category: "Fundamental & Basic Math",
    name: "Difference of Squares",
    description: "Factor a² − b² as a product of sum and difference.",
    latex: String.raw`a^2 - b^2 = (a - b)(a + b)`,
    templateText: "Factor ___^2 - ___^2",
  },
  {
    kind: "standard",
    id: "identity-cube-sum",
    category: "Fundamental & Basic Math",
    name: "Cube of a Sum",
    description: "Expansion of (a + b) cubed.",
    latex: String.raw`(a + b)^3 = a^3 + 3a^2 b + 3a b^2 + b^3`,
    templateText: "Expand (___ + ___)^3",
  },
  {
    kind: "standard",
    id: "identity-sum-diff-cubes",
    category: "Fundamental & Basic Math",
    name: "Sum/Difference of Cubes",
    description: "Factor a³ ± b³ into linear and quadratic factors.",
    latex: String.raw`a^3 \pm b^3 = (a \pm b)(a^2 \mp ab + b^2)`,
    templateText: "Factor ___^3 ± ___^3",
  },
  {
    kind: "standard",
    id: "quadratic-formula",
    category: "Fundamental & Basic Math",
    name: "Quadratic Formula",
    description: "Solve ax² + bx + c = 0 for x.",
    latex: String.raw`x = \dfrac{-b \pm \sqrt{b^2 - 4ac}}{2a}`,
    templateText:
      "Solve using the quadratic formula: ___x^2 + ___x + ___ = 0",
  },

  // -- Exponent & Power Laws --
  {
    kind: "standard",
    id: "exp-product",
    category: "Fundamental & Basic Math",
    name: "Exponent Product Rule",
    description: "Multiply powers with the same base by adding exponents.",
    latex: String.raw`a^m \cdot a^n = a^{m+n}`,
    templateText: "Simplify ___^___ · ___^___",
  },
  {
    kind: "standard",
    id: "exp-quotient",
    category: "Fundamental & Basic Math",
    name: "Exponent Quotient Rule",
    description: "Divide powers with the same base by subtracting exponents.",
    latex: String.raw`\dfrac{a^m}{a^n} = a^{m-n}`,
    templateText: "Simplify ___^___ / ___^___",
  },
  {
    kind: "standard",
    id: "exp-power",
    category: "Fundamental & Basic Math",
    name: "Power of a Power",
    description: "Raise a power to another power by multiplying exponents.",
    latex: String.raw`(a^m)^n = a^{m \cdot n}`,
    templateText: "Simplify (___^___)^___",
  },
  {
    kind: "standard",
    id: "exp-negative-zero",
    category: "Fundamental & Basic Math",
    name: "Negative & Zero Exponents",
    description: "Reciprocal for negative exponents; any nonzero base to 0 is 1.",
    latex: String.raw`a^{-n} = \dfrac{1}{a^n},\ \ a^0 = 1`,
    templateText: "Simplify ___^(___)",
  },

  // -- Logarithm Laws --
  {
    kind: "standard",
    id: "log-product",
    category: "Fundamental & Basic Math",
    name: "Logarithm Product Rule",
    description: "Log of a product is the sum of the logs.",
    latex: String.raw`\log_b(xy) = \log_b x + \log_b y`,
    templateText: "Expand log_(___)(___ · ___)",
  },
  {
    kind: "standard",
    id: "log-quotient",
    category: "Fundamental & Basic Math",
    name: "Logarithm Quotient Rule",
    description: "Log of a quotient is the difference of the logs.",
    latex: String.raw`\log_b\!\left(\dfrac{x}{y}\right) = \log_b x - \log_b y`,
    templateText: "Expand log_(___)(___/___)",
  },
  {
    kind: "standard",
    id: "log-power",
    category: "Fundamental & Basic Math",
    name: "Logarithm Power Rule",
    description: "Exponents come out in front of a logarithm.",
    latex: String.raw`\log_b(x^k) = k\,\log_b x`,
    templateText: "Simplify log_(___)(___^___)",
  },
  {
    kind: "standard",
    id: "log-change-of-base",
    category: "Fundamental & Basic Math",
    name: "Change of Base",
    description: "Rewrite a logarithm using natural logs.",
    latex: String.raw`\log_b a = \dfrac{\ln a}{\ln b}`,
    templateText: "Evaluate log_(___)(___) using change of base.",
  },

  // -- Basic Geometry & Mensuration --
  {
    kind: "standard",
    id: "circle-area",
    category: "Fundamental & Basic Math",
    name: "Area of a Circle",
    description: "Area of a circle in terms of its radius.",
    latex: String.raw`A = \pi r^2`,
    templateText: "Find the area of a circle with radius r = ___",
  },
  {
    kind: "standard",
    id: "circle-circumference",
    category: "Fundamental & Basic Math",
    name: "Circumference of a Circle",
    description: "Perimeter of a circle in terms of its radius.",
    latex: String.raw`C = 2\pi r`,
    templateText: "Find the circumference of a circle with radius r = ___",
  },
  {
    kind: "standard",
    id: "triangle-area",
    category: "Fundamental & Basic Math",
    name: "Area of a Triangle",
    description: "Half of base times height.",
    latex: String.raw`A = \tfrac{1}{2} b h`,
    templateText: "Find the area of a triangle with base b = ___ and height h = ___",
  },
  {
    kind: "standard",
    id: "rectangle-area",
    category: "Fundamental & Basic Math",
    name: "Area of a Rectangle",
    description: "Length times width.",
    latex: String.raw`A = l \times w`,
    templateText: "Find the area of a rectangle with length l = ___ and width w = ___",
  },
  {
    kind: "standard",
    id: "cylinder-volume",
    category: "Fundamental & Basic Math",
    name: "Volume of a Cylinder",
    description: "Base area times height.",
    latex: String.raw`V = \pi r^2 h`,
    templateText: "Find the volume of a cylinder with radius r = ___ and height h = ___",
  },
  {
    kind: "standard",
    id: "sphere-volume",
    category: "Fundamental & Basic Math",
    name: "Volume of a Sphere",
    description: "Volume of a sphere from its radius.",
    latex: String.raw`V = \tfrac{4}{3}\pi r^3`,
    templateText: "Find the volume of a sphere with radius r = ___",
  },
  {
    kind: "standard",
    id: "cone-volume",
    category: "Fundamental & Basic Math",
    name: "Volume of a Cone",
    description: "One-third of the cylinder with the same base and height.",
    latex: String.raw`V = \tfrac{1}{3}\pi r^2 h`,
    templateText: "Find the volume of a cone with radius r = ___ and height h = ___",
  },
  {
    kind: "standard",
    id: "cube-volume",
    category: "Fundamental & Basic Math",
    name: "Volume of a Cube",
    description: "Edge length cubed.",
    latex: String.raw`V = a^3`,
    templateText: "Find the volume of a cube with edge a = ___",
  },

  // -- Basic Probability & Statistics --
  {
    kind: "standard",
    id: "mean",
    category: "Fundamental & Basic Math",
    name: "Arithmetic Mean",
    description: "Average of a data set.",
    latex: String.raw`\bar{x} = \dfrac{\sum x}{n}`,
    templateText: "Find the mean of the data set: ___",
  },
  {
    kind: "standard",
    id: "classical-probability",
    category: "Fundamental & Basic Math",
    name: "Classical Probability",
    description: "Favourable outcomes divided by total outcomes.",
    latex: String.raw`P(A) = \dfrac{n(A)}{n(S)}`,
    templateText:
      "Find P(A) given n(A) = ___ favourable outcomes out of n(S) = ___ total outcomes.",
  },

  // =====================================================================
  // 1. MATRICES & DETERMINANTS
  // =====================================================================

  // -- Algebra of Matrices --
  {
    kind: "matrix",
    id: "mat-add",
    category: "Matrices & Determinants",
    name: "Matrix Addition",
    description: "Add two matrices of the same order element-wise.",
    latex: String.raw`A + B = [a_{ij} + b_{ij}]`,
    operands: 2,
    build: ([a, b]) => `Add the matrices ${a} + ${b}`,
  },
  {
    kind: "matrix",
    id: "mat-sub",
    category: "Matrices & Determinants",
    name: "Matrix Subtraction",
    description: "Subtract two matrices of the same order element-wise.",
    latex: String.raw`A - B = [a_{ij} - b_{ij}]`,
    operands: 2,
    build: ([a, b]) => `Subtract the matrices ${a} - ${b}`,
  },
  {
    kind: "standard",
    id: "mat-scalar-mul",
    category: "Matrices & Determinants",
    name: "Scalar Multiplication",
    description: "Multiply every entry of a matrix by a scalar.",
    latex: String.raw`kA = [k \cdot a_{ij}]`,
    templateText: "Compute k*A where k=___ and A = [[___,___],[___,___]]",
  },
  {
    kind: "matrix",
    id: "mat-mul",
    category: "Matrices & Determinants",
    name: "Matrix Multiplication",
    description: "Multiply two conformable matrices (2×2 or 3×3).",
    latex: String.raw`(AB)_{ij} = \sum_k a_{ik} b_{kj}`,
    operands: 2,
    build: ([a, b]) => `Multiply the matrices ${a} * ${b}`,
  },
  {
    kind: "matrix",
    id: "mat-transpose",
    category: "Matrices & Determinants",
    name: "Transpose",
    description: "Swap rows and columns of a matrix.",
    latex: String.raw`(A^{T})_{ij} = a_{ji}`,
    operands: 1,
    build: ([a]) => `Find the transpose of ${a}`,
  },

  // -- Determinants --
  {
    kind: "standard",
    id: "det-2x2",
    category: "Matrices & Determinants",
    name: "Determinant of 2×2",
    description: "|A| = ad − bc for a 2×2 matrix.",
    latex: String.raw`|A| = ad - bc`,
    templateText: "Find the determinant of [[___,___],[___,___]]",
  },
  {
    kind: "matrix",
    id: "det-3x3",
    category: "Matrices & Determinants",
    name: "Determinant of 3×3",
    description: "Expand along the first row using cofactors.",
    latex: String.raw`|A| = a_{11}(a_{22}a_{33} - a_{23}a_{32}) - a_{12}(a_{21}a_{33} - a_{23}a_{31}) + a_{13}(a_{21}a_{32} - a_{22}a_{31})`,
    operands: 1,
    build: ([a]) => `Find the determinant of ${a}`,
  },
  {
    kind: "standard",
    id: "singular-matrix",
    category: "Matrices & Determinants",
    name: "Singular Matrix Condition",
    description: "A matrix is singular when its determinant is zero.",
    latex: String.raw`|A| = 0`,
    templateText: "Check whether the matrix [[___,___],[___,___]] is singular.",
  },

  // -- Cramer's Rule --
  {
    kind: "standard",
    id: "cramer-2",
    category: "Matrices & Determinants",
    name: "Cramer's Rule (2 variables)",
    description: "Solve a 2-variable linear system using determinants.",
    latex: String.raw`x = \frac{D_x}{D},\ \ y = \frac{D_y}{D}`,
    templateText:
      "Solve using Cramer's rule:\n___x + ___y = ___\n___x + ___y = ___",
  },
  {
    kind: "standard",
    id: "cramer-3",
    category: "Matrices & Determinants",
    name: "Cramer's Rule (3 variables)",
    description: "Solve a 3-variable linear system using determinants.",
    latex: String.raw`x = \frac{D_x}{D},\ \ y = \frac{D_y}{D},\ \ z = \frac{D_z}{D}`,
    templateText:
      "Solve using Cramer's rule:\n___x + ___y + ___z = ___\n___x + ___y + ___z = ___\n___x + ___y + ___z = ___",
  },

  // -- Inverses & Eigenvalues --
  {
    kind: "matrix",
    id: "mat-inverse",
    category: "Matrices & Determinants",
    name: "Inverse of a Matrix",
    description: "Inverse using adjoint divided by determinant.",
    latex: String.raw`A^{-1} = \frac{1}{|A|}\,\text{adj}(A)`,
    operands: 1,
    build: ([a]) => `Find the inverse of ${a}`,
  },
  {
    kind: "standard",
    id: "char-eqn-2x2",
    category: "Matrices & Determinants",
    name: "Characteristic Equation (2×2)",
    description: "Quadratic in λ using trace and determinant of A.",
    latex: String.raw`\lambda^2 - \text{tr}(A)\,\lambda + |A| = 0`,
    templateText:
      "Find the characteristic equation of A = [[___,___],[___,___]]",
  },
  {
    kind: "matrix",
    id: "eigenvalues",
    category: "Matrices & Determinants",
    name: "Eigenvalues",
    description: "Solve |A − λI| = 0 for the eigenvalues of A.",
    latex: String.raw`|A - \lambda I| = 0`,
    operands: 1,
    build: ([a]) => `Find the eigenvalues of ${a}`,
  },

  // =====================================================================
  // 2. STRAIGHT LINES
  // =====================================================================
  {
    kind: "standard",
    id: "slope-angle",
    category: "Straight Lines",
    name: "Slope from Angle",
    description: "Slope equals the tangent of the inclination angle.",
    latex: String.raw`m = \tan\theta`,
    templateText: "Find the slope of a line inclined at ___ degrees to the x-axis.",
  },
  {
    kind: "standard",
    id: "slope-2pts",
    category: "Straight Lines",
    name: "Slope Between Two Points",
    description: "Rise over run between two points.",
    latex: String.raw`m = \dfrac{y_2 - y_1}{x_2 - x_1}`,
    templateText:
      "Find the slope of the line through (x1, y1) = (___, ___) and (x2, y2) = (___, ___)",
  },
  {
    kind: "standard",
    id: "intercepts",
    category: "Straight Lines",
    name: "x- and y-Intercepts",
    description: "Points where the line crosses the axes.",
    latex: String.raw`\text{x-intercept} = a,\ \ \text{y-intercept} = b`,
    templateText: "Find the x- and y-intercepts of the line ___x + ___y = ___",
  },
  {
    kind: "standard",
    id: "slope-intercept",
    category: "Straight Lines",
    name: "Slope–Intercept Form",
    description: "Line with a given slope and y-intercept.",
    latex: String.raw`y = mx + c`,
    templateText:
      "Write the equation of the line with slope m=___ and y-intercept c=___",
  },
  {
    kind: "standard",
    id: "point-slope",
    category: "Straight Lines",
    name: "Point–Slope Form",
    description: "Line through a point with a given slope.",
    latex: String.raw`y - y_1 = m(x - x_1)`,
    templateText:
      "Find the equation of the line with slope m=___ passing through (___, ___)",
  },
  {
    kind: "standard",
    id: "two-point",
    category: "Straight Lines",
    name: "Two-Point Form",
    description: "Line passing through two given points.",
    latex: String.raw`y - y_1 = \dfrac{y_2 - y_1}{x_2 - x_1}(x - x_1)`,
    templateText:
      "Find the equation of the line through (___, ___) and (___, ___)",
  },
  {
    kind: "standard",
    id: "intercept-form",
    category: "Straight Lines",
    name: "Intercept Form",
    description: "Line with x-intercept a and y-intercept b.",
    latex: String.raw`\dfrac{x}{a} + \dfrac{y}{b} = 1`,
    templateText:
      "Find the equation of the line with x-intercept ___ and y-intercept ___",
  },
  {
    kind: "standard",
    id: "general-form",
    category: "Straight Lines",
    name: "General Form",
    description: "Standard general equation of a straight line.",
    latex: String.raw`Ax + By + C = 0`,
    templateText: "Analyse the line ___x + ___y + ___ = 0",
  },
  {
    kind: "standard",
    id: "angle-between-lines",
    category: "Straight Lines",
    name: "Angle Between Two Lines",
    description: "Angle between two lines given their slopes.",
    latex: String.raw`\tan\theta = \left|\dfrac{m_1 - m_2}{1 + m_1 m_2}\right|`,
    templateText:
      "Find the angle between the lines with slopes m1=___ and m2=___",
  },
  {
    kind: "standard",
    id: "parallel-line",
    category: "Straight Lines",
    name: "Parallel Line",
    description: "Line parallel to Ax + By + C = 0 through a point.",
    latex: String.raw`m_1 = m_2,\quad Ax + By + K = 0`,
    templateText:
      "Find the line parallel to ___x + ___y + ___ = 0 and passing through (___, ___)",
  },
  {
    kind: "standard",
    id: "perpendicular-line",
    category: "Straight Lines",
    name: "Perpendicular Line",
    description: "Line perpendicular to Ax + By + C = 0 through a point.",
    latex: String.raw`m_1 \cdot m_2 = -1,\quad Bx - Ay + K = 0`,
    templateText:
      "Find the line perpendicular to ___x + ___y + ___ = 0 and passing through (___, ___)",
  },
  {
    kind: "standard",
    id: "perp-distance",
    category: "Straight Lines",
    name: "Perpendicular Distance from a Point",
    description: "Shortest distance from a point to a line.",
    latex: String.raw`d = \dfrac{|Ax_1 + By_1 + C|}{\sqrt{A^2 + B^2}}`,
    templateText:
      "Find the perpendicular distance from (___, ___) to the line ___x + ___y + ___ = 0",
  },

  // =====================================================================
  // 3. TRIGONOMETRY
  // =====================================================================
  {
    kind: "standard",
    id: "rad-to-deg",
    category: "Trigonometry",
    name: "Radians to Degrees",
    description: "Convert an angle from radians to degrees.",
    latex: String.raw`\text{deg} = \text{rad} \times \dfrac{180}{\pi}`,
    templateText: "Convert ___ radians to degrees.",
  },
  {
    kind: "standard",
    id: "deg-to-rad",
    category: "Trigonometry",
    name: "Degrees to Radians",
    description: "Convert an angle from degrees to radians.",
    latex: String.raw`\text{rad} = \text{deg} \times \dfrac{\pi}{180}`,
    templateText: "Convert ___ degrees to radians.",
  },
  {
    kind: "standard",
    id: "astc",
    category: "Trigonometry",
    name: "ASTC Rule (Quadrant Signs)",
    description: "Signs of trig ratios in the four quadrants.",
    latex: String.raw`\text{I: All } +,\ \text{II: sin } +,\ \text{III: tan } +,\ \text{IV: cos } +`,
    templateText:
      "Using the ASTC rule, find the sign and value of ___(___°).",
  },
  {
    kind: "standard",
    id: "sin-sum-diff",
    category: "Trigonometry",
    name: "sin(A ± B)",
    description: "Sine of the sum or difference of two angles.",
    latex: String.raw`\sin(A \pm B) = \sin A \cos B \pm \cos A \sin B`,
    templateText: "Evaluate sin(___ ± ___).",
  },
  {
    kind: "standard",
    id: "cos-sum-diff",
    category: "Trigonometry",
    name: "cos(A ± B)",
    description: "Cosine of the sum or difference of two angles.",
    latex: String.raw`\cos(A \pm B) = \cos A \cos B \mp \sin A \sin B`,
    templateText: "Evaluate cos(___ ± ___).",
  },
  {
    kind: "standard",
    id: "tan-sum-diff",
    category: "Trigonometry",
    name: "tan(A ± B)",
    description: "Tangent of the sum or difference of two angles.",
    latex: String.raw`\tan(A \pm B) = \dfrac{\tan A \pm \tan B}{1 \mp \tan A \tan B}`,
    templateText: "Evaluate tan(___ ± ___).",
  },
  {
    kind: "standard",
    id: "sin-2a",
    category: "Trigonometry",
    name: "sin 2A",
    description: "Double-angle identity for sine.",
    latex: String.raw`\sin 2A = 2\sin A\cos A = \dfrac{2\tan A}{1 + \tan^2 A}`,
    templateText: "Evaluate sin(2 × ___).",
  },
  {
    kind: "standard",
    id: "cos-2a",
    category: "Trigonometry",
    name: "cos 2A",
    description: "Double-angle identities for cosine.",
    latex: String.raw`\cos 2A = \cos^2 A - \sin^2 A = 2\cos^2 A - 1 = 1 - 2\sin^2 A = \dfrac{1 - \tan^2 A}{1 + \tan^2 A}`,
    templateText: "Evaluate cos(2 × ___).",
  },
  {
    kind: "standard",
    id: "tan-2a",
    category: "Trigonometry",
    name: "tan 2A",
    description: "Double-angle identity for tangent.",
    latex: String.raw`\tan 2A = \dfrac{2\tan A}{1 - \tan^2 A}`,
    templateText: "Evaluate tan(2 × ___).",
  },
  {
    kind: "standard",
    id: "sin-3a",
    category: "Trigonometry",
    name: "sin 3A",
    description: "Triple-angle identity for sine.",
    latex: String.raw`\sin 3A = 3\sin A - 4\sin^3 A`,
    templateText: "Evaluate sin(3 × ___).",
  },
  {
    kind: "standard",
    id: "cos-3a",
    category: "Trigonometry",
    name: "cos 3A",
    description: "Triple-angle identity for cosine.",
    latex: String.raw`\cos 3A = 4\cos^3 A - 3\cos A`,
    templateText: "Evaluate cos(3 × ___).",
  },
  {
    kind: "standard",
    id: "prod-to-sum",
    category: "Trigonometry",
    name: "Product to Sum/Difference",
    description: "Convert products of sines and cosines to sums.",
    latex: String.raw`\begin{aligned}2\sin A\cos B &= \sin(A+B) + \sin(A-B)\\ 2\cos A\sin B &= \sin(A+B) - \sin(A-B)\\ 2\cos A\cos B &= \cos(A+B) + \cos(A-B)\\ 2\sin A\sin B &= \cos(A-B) - \cos(A+B)\end{aligned}`,
    templateText: "Convert 2·___(___)·___(___) to a sum or difference.",
  },
  {
    kind: "standard",
    id: "sum-to-prod",
    category: "Trigonometry",
    name: "Sum/Difference to Product",
    description: "Convert sums of sines/cosines to products.",
    latex: String.raw`\begin{aligned}\sin C + \sin D &= 2\sin\tfrac{C+D}{2}\cos\tfrac{C-D}{2}\\ \sin C - \sin D &= 2\cos\tfrac{C+D}{2}\sin\tfrac{C-D}{2}\\ \cos C + \cos D &= 2\cos\tfrac{C+D}{2}\cos\tfrac{C-D}{2}\\ \cos C - \cos D &= -2\sin\tfrac{C+D}{2}\sin\tfrac{C-D}{2}\end{aligned}`,
    templateText: "Convert ___(___) ± ___(___) to a product.",
  },

  // =====================================================================
  // 4. DIFFERENTIAL CALCULUS & APPLICATIONS
  // =====================================================================
  {
    kind: "standard",
    id: "d-power",
    category: "Differential Calculus",
    name: "Power Rule",
    description: "Derivative of x raised to a power.",
    latex: String.raw`\dfrac{d}{dx}(x^n) = n x^{n-1}`,
    templateText: "Differentiate x^___ with respect to x.",
  },
  {
    kind: "standard",
    id: "d-exp",
    category: "Differential Calculus",
    name: "Derivative of eˣ",
    description: "The exponential function is its own derivative.",
    latex: String.raw`\dfrac{d}{dx}(e^x) = e^x`,
    templateText: "Differentiate e^x with respect to x.",
  },
  {
    kind: "standard",
    id: "d-ax",
    category: "Differential Calculus",
    name: "Derivative of aˣ",
    description: "General exponential derivative with base a.",
    latex: String.raw`\dfrac{d}{dx}(a^x) = a^x \ln a`,
    templateText: "Differentiate ___^x with respect to x.",
  },
  {
    kind: "standard",
    id: "d-ln",
    category: "Differential Calculus",
    name: "Derivative of ln x",
    description: "Derivative of the natural logarithm.",
    latex: String.raw`\dfrac{d}{dx}(\ln x) = \dfrac{1}{x}`,
    templateText: "Differentiate ln(___) with respect to x.",
  },
  {
    kind: "standard",
    id: "d-trig",
    category: "Differential Calculus",
    name: "Trigonometric Derivatives",
    description: "Standard derivatives of the six trig functions.",
    latex: String.raw`\begin{aligned}(\sin x)' &= \cos x & (\cos x)' &= -\sin x\\ (\tan x)' &= \sec^2 x & (\cot x)' &= -\csc^2 x\\ (\sec x)' &= \sec x \tan x & (\csc x)' &= -\csc x \cot x\end{aligned}`,
    templateText: "Differentiate ___(x) with respect to x.",
  },
  {
    kind: "standard",
    id: "d-inv-trig",
    category: "Differential Calculus",
    name: "Inverse Trig Derivatives",
    description: "Derivatives of arcsin, arccos, and arctan.",
    latex: String.raw`(\arcsin x)' = \dfrac{1}{\sqrt{1-x^2}},\ \ (\arccos x)' = -\dfrac{1}{\sqrt{1-x^2}},\ \ (\arctan x)' = \dfrac{1}{1+x^2}`,
    templateText: "Differentiate arc___(x) with respect to x.",
  },
  {
    kind: "standard",
    id: "product-rule",
    category: "Differential Calculus",
    name: "Product Rule",
    description: "Derivative of a product of two functions.",
    latex: String.raw`\dfrac{d}{dx}(u \cdot v) = u\dfrac{dv}{dx} + v\dfrac{du}{dx}`,
    templateText:
      "Using the product rule, differentiate (___) · (___) with respect to x.",
  },
  {
    kind: "standard",
    id: "quotient-rule",
    category: "Differential Calculus",
    name: "Quotient Rule",
    description: "Derivative of a quotient of two functions.",
    latex: String.raw`\dfrac{d}{dx}\!\left(\dfrac{u}{v}\right) = \dfrac{v\,du/dx - u\,dv/dx}{v^2}`,
    templateText:
      "Using the quotient rule, differentiate (___) / (___) with respect to x.",
  },
  {
    kind: "standard",
    id: "chain-rule",
    category: "Differential Calculus",
    name: "Chain Rule",
    description: "Derivative of a composite function.",
    latex: String.raw`\dfrac{dy}{dx} = \dfrac{dy}{du}\cdot\dfrac{du}{dx}`,
    templateText:
      "Using the chain rule, differentiate ___(___(x)) with respect to x.",
  },
  {
    kind: "standard",
    id: "second-derivative",
    category: "Differential Calculus",
    name: "Second Derivative",
    description: "Derivative of the first derivative.",
    latex: String.raw`\dfrac{d^2 y}{dx^2} = \dfrac{d}{dx}\!\left(\dfrac{dy}{dx}\right)`,
    templateText: "Find d²y/dx² for y = ___",
  },
  {
    kind: "standard",
    id: "tangent-line",
    category: "Differential Calculus",
    name: "Equation of Tangent",
    description: "Tangent line at a point using the derivative as slope.",
    latex: String.raw`m_t = \left.\dfrac{dy}{dx}\right|_{(x_1,y_1)},\ \ y - y_1 = m_t(x - x_1)`,
    templateText:
      "Find the tangent to y = ___ at the point (___, ___).",
  },
  {
    kind: "standard",
    id: "normal-line",
    category: "Differential Calculus",
    name: "Equation of Normal",
    description: "Normal line is perpendicular to the tangent.",
    latex: String.raw`m_n = -\dfrac{1}{m_t},\ \ y - y_1 = m_n(x - x_1)`,
    templateText:
      "Find the normal to y = ___ at the point (___, ___).",
  },
  {
    kind: "standard",
    id: "rate-of-change",
    category: "Differential Calculus",
    name: "Rate of Change",
    description: "Relate rates using the chain rule in time.",
    latex: String.raw`\dfrac{dy}{dt} = \dfrac{dy}{dx}\cdot\dfrac{dx}{dt}`,
    templateText:
      "Given y = ___ and dx/dt = ___, find dy/dt when x = ___.",
  },
  {
    kind: "standard",
    id: "maxima-minima",
    category: "Differential Calculus",
    name: "Maxima and Minima",
    description:
      "Stationary points where dy/dx = 0; classify with the second derivative.",
    latex: String.raw`\dfrac{dy}{dx} = 0;\ \ \dfrac{d^2y}{dx^2} < 0 \Rightarrow \text{max},\ \ \dfrac{d^2y}{dx^2} > 0 \Rightarrow \text{min}`,
    templateText: "Find the local maxima and minima of y = ___",
  },

  // =====================================================================
  // 5. INTEGRAL CALCULUS & APPLICATIONS
  // =====================================================================
  {
    kind: "standard",
    id: "int-power",
    category: "Integral Calculus",
    name: "Power Rule for Integration",
    description: "Antiderivative of xⁿ (n ≠ −1).",
    latex: String.raw`\int x^n\,dx = \dfrac{x^{n+1}}{n+1} + C,\ n \neq -1`,
    templateText: "Integrate x^___ with respect to x.",
  },
  {
    kind: "standard",
    id: "int-inv-x",
    category: "Integral Calculus",
    name: "Integral of 1/x",
    description: "Antiderivative of the reciprocal function.",
    latex: String.raw`\int \dfrac{1}{x}\,dx = \ln|x| + C`,
    templateText: "Integrate 1/x with respect to x.",
  },
  {
    kind: "standard",
    id: "int-exp",
    category: "Integral Calculus",
    name: "Integral of eˣ",
    description: "The exponential function is its own antiderivative.",
    latex: String.raw`\int e^x\,dx = e^x + C`,
    templateText: "Integrate e^x with respect to x.",
  },
  {
    kind: "standard",
    id: "int-trig",
    category: "Integral Calculus",
    name: "Trigonometric Integrals",
    description: "Standard antiderivatives of trig functions.",
    latex: String.raw`\begin{aligned}\int \sin x\,dx &= -\cos x + C & \int \cos x\,dx &= \sin x + C\\ \int \sec^2 x\,dx &= \tan x + C & \int \csc^2 x\,dx &= -\cot x + C\\ \int \sec x\tan x\,dx &= \sec x + C & \int \csc x\cot x\,dx &= -\csc x + C\end{aligned}`,
    templateText: "Integrate ___(x) with respect to x.",
  },
  {
    kind: "standard",
    id: "int-arctan",
    category: "Integral Calculus",
    name: "Integral → arctan",
    description: "Standard form giving inverse tangent.",
    latex: String.raw`\int \dfrac{1}{1+x^2}\,dx = \arctan x + C`,
    templateText: "Integrate 1/(1 + x^2) with respect to x.",
  },
  {
    kind: "standard",
    id: "int-arcsin",
    category: "Integral Calculus",
    name: "Integral → arcsin",
    description: "Standard form giving inverse sine.",
    latex: String.raw`\int \dfrac{1}{\sqrt{1-x^2}}\,dx = \arcsin x + C`,
    templateText: "Integrate 1/sqrt(1 - x^2) with respect to x.",
  },
  {
    kind: "standard",
    id: "int-substitution",
    category: "Integral Calculus",
    name: "Integration by Substitution",
    description: "Let u = g(x) to simplify the integrand.",
    latex: String.raw`\int f(g(x))\,g'(x)\,dx = \int f(u)\,du`,
    templateText:
      "Using substitution u = ___, integrate ___ with respect to x.",
  },
  {
    kind: "standard",
    id: "int-by-parts",
    category: "Integral Calculus",
    name: "Integration by Parts (ILATE)",
    description: "Choose u by ILATE: Inverse, Log, Algebraic, Trig, Exp.",
    latex: String.raw`\int u\,dv = uv - \int v\,du`,
    templateText:
      "Using integration by parts (ILATE), integrate (___) · (___) with respect to x.",
  },
  {
    kind: "standard",
    id: "partial-fractions",
    category: "Integral Calculus",
    name: "Partial Fractions",
    description: "Decompose a rational function before integrating.",
    latex: String.raw`\dfrac{P(x)}{(x-a)(x-b)} = \dfrac{A}{x-a} + \dfrac{B}{x-b}`,
    templateText:
      "Decompose ___/((x - ___)(x - ___)) into partial fractions and integrate.",
  },
  {
    kind: "standard",
    id: "def-integral",
    category: "Integral Calculus",
    name: "Definite Integral",
    description: "Evaluate using the fundamental theorem of calculus.",
    latex: String.raw`\int_a^b f(x)\,dx = F(b) - F(a)`,
    templateText:
      "Evaluate the integral of ___ with respect to x from x = ___ to x = ___",
  },
  {
    kind: "standard",
    id: "def-prop-1",
    category: "Integral Calculus",
    name: "Property: f(a+b−x)",
    description: "Symmetry property of definite integrals on [a, b].",
    latex: String.raw`\int_a^b f(x)\,dx = \int_a^b f(a+b-x)\,dx`,
    templateText:
      "Use the property to evaluate the integral of ___ from x = ___ to x = ___",
  },
  {
    kind: "standard",
    id: "def-prop-2",
    category: "Integral Calculus",
    name: "Property: f(a−x)",
    description: "Symmetry property of definite integrals on [0, a].",
    latex: String.raw`\int_0^a f(x)\,dx = \int_0^a f(a-x)\,dx`,
    templateText:
      "Use the property to evaluate the integral of ___ from x = 0 to x = ___",
  },
  {
    kind: "standard",
    id: "area-under-curve",
    category: "Integral Calculus",
    name: "Area Under a Curve",
    description: "Signed area between the curve and the x-axis.",
    latex: String.raw`A = \int_a^b y\,dx \ \ \text{or}\ \ A = \int_c^d x\,dy`,
    templateText:
      "Find the area under y = ___ between x = ___ and x = ___",
  },
  {
    kind: "standard",
    id: "volume-revolution",
    category: "Integral Calculus",
    name: "Volume of Revolution (X-axis)",
    description: "Volume swept by rotating y = f(x) about the x-axis.",
    latex: String.raw`V = \pi \int_a^b y^2\,dx`,
    templateText:
      "Find the volume generated by rotating y = ___ about the x-axis from x = ___ to x = ___",
  },
];
