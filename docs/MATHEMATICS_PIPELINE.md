# FormatAI Mathematics Processing Pipeline Documentation

## 1. Overview & Pipeline Stages
FormatAI provides a professional mathematics-processing engine that converts raw academic text containing mathematical expressions directly into Microsoft Word native Office Math Markup Language (OMML).

### Pipeline Flow:
```
Raw text
  │
  ▼
1. Math Detection
   - Identifies inline math ($...$), display math ($$...$$, \[...\]),
     and raw LaTeX equation blocks (\begin{equation}...)
   - Negative lookahead/lookbehind prevents misidentifying monetary figures ($10, $5.50)
   - Guarded regex prevents ordinary prose containing slashes ("5/10 students", "24/7", "km/h")
     from being corrupted into fractions
  │
  ▼
2. Delimiter Normalization
   - Standardizes \(...\) to $...$
   - Standardizes \[...\] and \begin{equation} to $$...$$
  │
  ▼
3. LaTeX Normalization
   - Cleans leading/trailing outer delimiters
   - Normalizes scientific notations (e.g. `10^23` -> `10^{23}`)
   - Normalizes multiplication symbols (e.g. `x 10^` -> `\times 10^`)
  │
  ▼
4. Mathematical Representation
   - Translates LaTeX syntax trees into W3C MathML DOM nodes via `latex2mathml`
  │
  ▼
5. Word OMML Conversion (`backend/utils/omml_converter.py`)
   - Translates MathML constructs to native Microsoft Word OMML:
     • Fractions: `<mfrac>` -> `<m:f>` with `<m:num>` and `<m:den>`
     • Superscripts: `<msup>` -> `<m:sSup>`
     • Subscripts: `<msub>` -> `<m:sSub>`
     • Sub-Superscripts: `<msubsup>` -> `<m:sSubSup>`
     • Radicals: `<msqrt>`, `<mroot>` -> `<m:rad>`
     • Operators: `<mo>` -> `<m:nary>` (Summation ∑, Integral ∫, Product ∏)
     • Limits: `<munder>` -> `<m:limLow>`
     • Matrices: `<mtable>` -> `<m:m>` with `<m:mr>` and `<m:e>`
     • Greek symbols: mapped to Unicode characters within `<m:r><m:t>`
  │
  ▼
6. DOCX Mathematical Output (`backend/services/docx_service.py`)
   - Appends `<m:oMath>` / `<m:oMathPara>` directly into the Word document XML
   - Ensures the generated document is 100% editable in Word with zero raw LaTeX source exposure
```

---

## 2. Supported Mathematical Syntax
- **Fractions**: `\frac{x}{y}`, complex nested fractions `\frac{1}{\frac{a}{b} + 1}`
- **Powers & Indices**: `x^2`, `x_i`, `\sigma^2`, `x_{i,j}^{(n)}`
- **Roots**: `\sqrt{x}`, `\sqrt[3]{x+1}`, `\sqrt[n]{\alpha + \beta}`
- **Greek Alphabet**: `\alpha, \beta, \gamma, \delta, \epsilon, \zeta, \eta, \theta, \kappa, \lambda, \mu, \nu, \xi, \pi, \rho, \sigma, \tau, \phi, \chi, \psi, \omega` (both lowercase and uppercase `\Delta, \Theta, \Lambda, \Xi, \Pi, \Sigma, \Phi, \Psi, \Omega`)
- **Summations & Products**: `\sum_{i=1}^{n} x_i`, `\prod_{j=1}^{k} \lambda_j`
- **Integrals**: `\int_{a}^{b} f(x) dx`, `\iint_D dx dy`, `\oint_C \vec{F} \cdot d\vec{r}`
- **Limits**: `\lim_{x \to 0} \frac{\sin x}{x}`, `\lim_{n \to \infty} (1 + \frac{1}{n})^n`
- **Matrices & Arrays**: `\begin{matrix} a & b \\ c & d \end{matrix}`
- **Equations**: Display equations centered on their own lines; inline equations seamlessly flowing within paragraphs.

---

## 3. Known Limitations & Technical Boundaries
1. **Multi-line Equation Alignment Labels (`&` alignment across multiple lines)**:
   - Word OMML supports equation arrays via `<m:eqArr>`. Currently, multi-line `align` environments without matrix wrappers will fall back to single `<m:oMathPara>` blocks or sequential display equation lines.
2. **Specialized Non-standard LaTeX Packages**:
   - Custom TikZ diagrams, commutative diagrams (`tikz-cd`, `xy-pic`), and chemical reaction schemes using `chemfig` are diagrammatic/vector graphics and are not native Word formula equations.
3. **Complex Custom Macros**:
   - User-defined LaTeX macros (`\newcommand` or `\def`) are not expanded prior to MathML parsing unless standard standard LaTeX commands are used.
4. **Equation Numbering Callouts in Word**:
   - While display equations are centered according to academic presets, right-tab equation numbering (e.g. `(1.1)`) uses standard paragraph layout rather than Word's hidden table alignment template.
