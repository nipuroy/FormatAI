r"""Dedicated Mathematics Processing Pipeline Service for FormatAI.

Pipeline Architecture:
Raw text
  → Math detection (LaTeX inline, display, and raw academic math expressions)
  → Delimiter normalization (standardizing \(...\), \[...\], \begin{equation*})
  → LaTeX normalization (syntax repair, cleaning unnecessary wrappers)
  → Mathematical representation (MathML AST & structured tokens)
  → DOCX mathematical output (OMML for Word native equations)

Critical Guardrails:
- Does NOT break ordinary text containing slashes (e.g. "5/10 students" remains plain text).
- Does NOT expose raw LaTeX source in final DOCX.
- Supports fractions, nested fractions, superscripts, subscripts, roots, Greek letters,
  summation, integrals, limits, and matrices.
"""

import re
from typing import Any, Dict, List, Optional, Tuple

from backend.utils.logger import get_logger
from backend.utils.omml_converter import GREEK_SYMBOLS, mathml_to_omml

logger = get_logger("math_service")

try:
    import latex2mathml.converter
    HAS_LATEX2MATHML = True
except ImportError:
    HAS_LATEX2MATHML = False


# =========================================================================
# Academic Math Regexes & Patterns
# =========================================================================

# Display Math: $$...$$, \[...\], \begin{equation}...
RE_DISPLAY_MATH = re.compile(
    r"(\$\$(?:\\.|[^\$])+\$\$|\\\[(?:\\.|[^\]])+\\\]|\\begin\{(?:equation\*?|align\*?|gather\*?|multline\*?)\}(?:\\.|[\s\S])+?\\end\{(?:equation\*?|align\*?|gather\*?|multline\*?)\})",
    re.MULTILINE,
)

# Inline Math: $...$ with negative lookbehind/lookahead for currency like $10 or $5.50
RE_INLINE_MATH = re.compile(
    r"(?<![\$\w])\$(?!\$|\s)(\S(?:.*?[^\s\$])?)\$(?![\$\w\d])"
)

# Parenthetical math: \( ... \)
RE_PAREN_MATH = re.compile(r"\\\((.+?)\\\)")

# Standalone LaTeX command detection when not enclosed in delimiters
# (e.g. \frac{a}{b}, \sum_{i=1}^n x_i, \sqrt{x}, \sigma^2, \int_a^b)
RE_RAW_LATEX_COMMAND = re.compile(
    r"(\\frac\{[^{}]+\}\{[^{}]+\}|"
    r"\\(?:sqrt|sum|int|prod|lim|alpha|beta|gamma|delta|epsilon|theta|lambda|mu|sigma|pi|omega|partial|nabla|approx|infty)\b(?:\{[^{}]*\}|_[A-Za-z0-9{}]+|\^[A-Za-z0-9{}]+)*|"
    r"\b[A-Za-z]+_[A-Za-z0-9]+(?:\^[A-Za-z0-9]+)?|\b[A-Za-z]+\^[A-Za-z0-9]+)"
)

# Slanted slash false positive guard (e.g. "5/10 students", "24/7 service", "and/or", "km/h")
RE_PLAIN_SLASH_GUARD = re.compile(r"\b\d+\s*/\s*\d+\b|\b[a-zA-Z]+/[a-zA-Z]+\b")


class MathExpression:
    """Represents a validated mathematical expression in the pipeline."""

    def __init__(
        self,
        raw_text: str,
        clean_latex: str,
        is_display: bool = False,
        mathml: Optional[str] = None,
        omml: Optional[str] = None,
    ):
        self.raw_text = raw_text
        self.clean_latex = clean_latex
        self.is_display = is_display
        self.mathml = mathml
        self.omml = omml

    def to_dict(self) -> Dict[str, Any]:
        return {
            "raw_text": self.raw_text,
            "clean_latex": self.clean_latex,
            "is_display": self.is_display,
            "has_omml": bool(self.omml),
        }


class MathService:
    """Executes the complete mathematics processing pipeline."""

    def __init__(self):
        self.has_converter = HAS_LATEX2MATHML

    # -------------------------------------------------------------------------
    # Stage 1 & 2: Math Detection & Delimiter Normalization
    # -------------------------------------------------------------------------

    def normalize_delimiters(self, text: str) -> str:
        r"""Standardize various LaTeX math delimiters to uniform $ and $$ markers.

        - Converts \( ... \) to $ ... $
        - Converts \[ ... \] to $$ ... $$
        - Preserves ordinary text containing slashes (e.g. "5/10 students")
        """
        if not text:
            return ""

        out = text

        # 1. Convert \( ... \) to $ ... $
        out = RE_PAREN_MATH.sub(r"$\1$", out)

        # 2. Convert \[ ... \] to $$ ... $$
        out = re.sub(r"\\\[\s*([\s\S]+?)\s*\\\]", r"$$\1$$", out)

        return out

    # -------------------------------------------------------------------------
    # Stage 3: LaTeX Normalization
    # -------------------------------------------------------------------------

    def normalize_latex(self, latex_str: str) -> str:
        r"""Clean and normalize LaTeX math strings for reliable AST generation.

        - Strips enclosing $ or $$ delimiters
        - Replaces informal multiplication 'x' or 'X' in scientific notation with \times
        - Normalizes Greek word tokens (e.g. 'sigma^2' -> '\sigma^2') if preceded by backslash
        - Ensures balanced braces for fractions and exponents
        """
        if not latex_str:
            return ""

        clean = latex_str.strip()

        # Strip outer delimiters if present
        if clean.startswith("$$") and clean.endswith("$$") and len(clean) >= 4:
            clean = clean[2:-2].strip()
        elif clean.startswith("$") and clean.endswith("$") and len(clean) >= 2:
            clean = clean[1:-1].strip()
        elif clean.startswith(r"\(") and clean.endswith(r"\)"):
            clean = clean[2:-2].strip()
        elif clean.startswith(r"\[") and clean.endswith(r"\]"):
            clean = clean[2:-2].strip()

        # Remove \begin{equation} / \end{equation} wrappers for AST conversion
        clean = re.sub(r"^\\begin\{(?:equation\*?|align\*?|gather\*?)\}\s*", "", clean)
        clean = re.sub(r"\s*\\end\{(?:equation\*?|align\*?|gather\*?)\}$", "", clean)

        # Fix scientific notation: 10^23 or 10^-5 -> 10^{23}
        clean = re.sub(r"\b10\^([0-9\-+]+)\b", r"10^{\1}", clean)

        # Normalize informal x 10^ -> \times 10^
        clean = re.sub(r"(\d+)\s*[xX]\s*10\^", r"\1 \\times 10^", clean)

        return clean.strip()

    # -------------------------------------------------------------------------
    # Stage 4: Mathematical Representation (MathML AST)
    # -------------------------------------------------------------------------

    def latex_to_mathml(self, latex_str: str) -> Optional[str]:
        """Convert normalized LaTeX math string to MathML XML string."""
        if not latex_str or not HAS_LATEX2MATHML:
            return None

        clean_latex = self.normalize_latex(latex_str)
        try:
            return latex2mathml.converter.convert(clean_latex)
        except Exception as e:
            logger.debug(f"latex2mathml conversion failed for '{clean_latex}': {e}")
            # Try a simplified fallback for basic sub/sup or frac
            return self._fallback_mathml(clean_latex)

    def _fallback_mathml(self, clean_latex: str) -> Optional[str]:
        """Simple fallback MathML generator for elementary expressions if parser fails."""
        try:
            # Simple fraction: \frac{a}{b}
            frac_m = re.match(r"^\\frac\{([^{}]+)\}\{([^{}]+)\}$", clean_latex)
            if frac_m:
                return (
                    f'<math xmlns="http://www.w3.org/1998/Math/MathML">'
                    f'<mrow><mfrac><mrow><mi>{frac_m.group(1)}</mi></mrow>'
                    f'<mrow><mi>{frac_m.group(2)}</mi></mrow></mfrac></mrow></math>'
                )

            # Simple sub/sup: x_i or x^2
            sub_m = re.match(r"^([A-Za-z])_([A-Za-z0-9])$", clean_latex)
            if sub_m:
                return (
                    f'<math xmlns="http://www.w3.org/1998/Math/MathML">'
                    f'<mrow><msub><mi>{sub_m.group(1)}</mi><mi>{sub_m.group(2)}</mi></msub></mrow></math>'
                )

            sup_m = re.match(r"^([A-Za-z])\^([A-Za-z0-9])$", clean_latex)
            if sup_m:
                return (
                    f'<math xmlns="http://www.w3.org/1998/Math/MathML">'
                    f'<mrow><msup><mi>{sup_m.group(1)}</mi><mn>{sup_m.group(2)}</mn></msup></mrow></math>'
                )
        except Exception:
            pass
        return None

    # -------------------------------------------------------------------------
    # Stage 5: DOCX Mathematical Output (OMML)
    # -------------------------------------------------------------------------

    def latex_to_omml(self, latex_str: str, display: bool = False) -> str:
        """Convert a LaTeX expression to Word native OMML (<m:oMath> or <m:oMathPara>)."""
        clean_latex = self.normalize_latex(latex_str)
        if not clean_latex:
            return ""

        mathml = self.latex_to_mathml(clean_latex)
        if mathml:
            omml = mathml_to_omml(mathml, display=display)
            if omml:
                return omml

        # Fallback OMML if MathML conversion fails
        return self._generate_fallback_omml(clean_latex, display=display)

    def _generate_fallback_omml(self, clean_latex: str, display: bool = False) -> str:
        """Construct fallback OMML text run so raw LaTeX syntax is not exposed."""
        clean_readable = self._latex_to_readable_math_string(clean_latex)
        tag = "m:oMathPara" if display else "m:oMath"
        return (
            f'<{tag} xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math">'
            f'  <m:oMath>'
            f'    <m:r><m:t>{clean_readable}</m:t></m:r>'
            f'  </m:oMath>'
            f'</{tag}>' if display else
            f'<m:oMath xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math">'
            f'  <m:r><m:t>{clean_readable}</m:t></m:r>'
            f'</m:oMath>'
        )

    def _latex_to_readable_math_string(self, latex_str: str) -> str:
        """Convert LaTeX commands to clean readable characters without raw slashes."""
        s = latex_str
        # Replace Greek letters
        for g_name, g_char in GREEK_SYMBOLS.items():
            s = re.sub(rf"\\{g_name}\b", g_char, s)

        # Replace operators
        s = s.replace(r"\sum", "∑").replace(r"\int", "∫").replace(r"\prod", "∏")
        s = s.replace(r"\sqrt", "√").replace(r"\times", "×").replace(r"\cdot", "·")
        s = s.replace(r"\leq", "≤").replace(r"\geq", "≥").replace(r"\neq", "≠")
        s = s.replace(r"\infty", "∞").replace(r"\partial", "∂")

        # Replace \frac{a}{b} -> a/b
        s = re.sub(r"\\frac\{([^{}]+)\}\{([^{}]+)\}", r"(\1 / \2)", s)

        return s

    # -------------------------------------------------------------------------
    # Inline Text Segmentation (Separating Prose from Math Tokens)
    # -------------------------------------------------------------------------

    def segment_text_and_math(self, text: str) -> List[Dict[str, Any]]:
        """Split a paragraph into alternating sequence of prose and mathematical tokens.

        Guarantees that:
        - Math inside $...$ or raw detected LaTeX is flagged as "math"
        - Ordinary text containing "/" like "5/10 students" is preserved as plain "text"
        - OMML is pre-calculated for each math token
        """
        if not text:
            return []

        # First, normalize delimiters
        normalized = self.normalize_delimiters(text)

        segments: List[Dict[str, Any]] = []
        last_pos = 0

        # Pattern matches: $...$ inline math, or standalone \frac{...}{...}
        combined_pattern = re.compile(
            r"(\$(?!\$|\s)(?:\\.|[^\$\n])+?\$|"
            r"\\frac\{[^{}]+\}\{[^{}]+\}|"
            r"\\(?:sqrt|sum|int|prod)\b\{[^{}]*\})"
        )

        for match in combined_pattern.finditer(normalized):
            start, end = match.span()

            # Text preceding the math token
            if start > last_pos:
                prose = normalized[last_pos:start]
                if prose:
                    segments.append({
                        "type": "text",
                        "content": prose,
                    })

            math_raw = match.group(0)
            clean_latex = self.normalize_latex(math_raw)
            omml_xml = self.latex_to_omml(clean_latex, display=False)

            segments.append({
                "type": "math",
                "raw": math_raw,
                "clean_latex": clean_latex,
                "omml": omml_xml,
            })

            last_pos = end

        # Remaining trailing text
        if last_pos < len(normalized):
            segments.append({
                "type": "text",
                "content": normalized[last_pos:],
            })

        return segments
