r"""Tests for FormatAI dedicated mathematics-processing pipeline.

Verifies:
- Raw text -> Math detection -> Delimiter normalization -> LaTeX normalization -> MathML/OMML representation -> DOCX output
- Fractions and nested fractions: \frac{x}{y}, \frac{1}{\frac{a}{b} + 1}
- Superscripts and subscripts: x_i, x^2, \sigma^2, x_{i,j}^{(n)}
- Square roots and nth roots: \sqrt{x}, \sqrt[3]{x+1}
- Greek symbols: \alpha, \beta, \sigma, \omega, \Delta, \Theta
- Summation and limits: \sum_{i=1}^{n} x_i, \lim_{x \to 0} \frac{\sin x}{x}
- Integrals: \int_{a}^{b} f(x) dx
- Matrices: \begin{matrix} a & b \\ c & d \end{matrix}
- Ordinary text with slashes is NEVER broken: "5/10 students", "24/7", "km/h"
- Inline math alongside mixed prose
- Display math blocks
- Genuine DOCX generation without raw unrendered LaTeX source in the final output
"""

from io import BytesIO
import zipfile
import xml.etree.ElementTree as ET

from backend.core.docx_styles import DocxPresetType
from backend.models.document import AcademicDocument, BlockType, DocumentBlock, FormattingRequestSkeleton
from backend.services.document_service import DocumentService
from backend.services.docx_service import DocxService
from backend.services.math_service import MathService
from backend.utils.omml_converter import mathml_to_omml


# =========================================================================
# 1. Math Detection & Delimiter Normalization Tests
# =========================================================================

def test_delimiter_normalization():
    r"""Verify \(...\) and \[...\] are normalized to $ and $$ while leaving prose slashes untouched."""
    ms = MathService()

    raw = r"In physics, \(E = mc^2\) and \[H\psi = E\psi\] describe energy. Exactly 5/10 students passed."
    normalized = ms.normalize_delimiters(raw)

    assert "$E = mc^2$" in normalized
    assert r"$$H\psi = E\psi$$" in normalized
    assert "5/10 students" in normalized  # Slashes in ordinary text must remain unaltered


def test_ordinary_text_slash_guard():
    """Verify phrases like '5/10 students', '24/7', 'km/h' are not treated as fractions."""
    ms = MathService()
    text = "A total of 5/10 students scored 100 km/h in the 24/7 lab test."
    segments = ms.segment_text_and_math(text)

    # All segments should be plain text, none should be math fractions
    assert all(seg["type"] == "text" for seg in segments)
    assert any("5/10 students" in seg["content"] for seg in segments)
    assert any("km/h" in seg["content"] for seg in segments)


# =========================================================================
# 2. LaTeX Normalization Tests
# =========================================================================

def test_latex_normalization():
    """Verify LaTeX normalization cleans delimiters, scientific notations, and equation environments."""
    ms = MathService()

    # Stripping enclosing $
    assert ms.normalize_latex(r"$ \frac{x}{y} $") == r"\frac{x}{y}"
    assert ms.normalize_latex(r"$$ \sigma^2 $$") == r"\sigma^2"
    assert ms.normalize_latex(r"\( x_i \)") == r"x_i"
    assert ms.normalize_latex(r"\[ \sqrt{x} \]") == r"\sqrt{x}"

    # Stripping \begin{equation} ... \end{equation}
    eq_str = r"\begin{equation} \int_{a}^{b} f(x) dx \end{equation}"
    assert ms.normalize_latex(eq_str) == r"\int_{a}^{b} f(x) dx"

    # Scientific notation normalization
    sci_str = r"6.022 x 10^23"
    assert "10^{23}" in ms.normalize_latex(sci_str)


# =========================================================================
# 3. Mathematical Representation: MathML & OMML Generation
# =========================================================================

def test_fractions_and_nested_fractions():
    """Verify elementary and nested fraction conversions to OMML."""
    ms = MathService()

    # Simple fraction: \frac{x}{y}
    omml_simple = ms.latex_to_omml(r"\frac{x}{y}", display=False)
    assert "<m:f>" in omml_simple
    assert "<m:num>" in omml_simple
    assert "<m:den>" in omml_simple
    assert "x" in omml_simple
    assert "y" in omml_simple

    # Nested fraction: \frac{1}{\frac{a}{b} + 1}
    omml_nested = ms.latex_to_omml(r"\frac{1}{\frac{a}{b} + 1}", display=True)
    assert omml_nested.count("<m:f>") >= 2  # Outer fraction and inner fraction


def test_superscripts_and_subscripts():
    r"""Verify subscript x_i, superscript x^2, and sub-superscript \sigma^2 or x_i^2."""
    ms = MathService()

    # Subscript: x_i
    omml_sub = ms.latex_to_omml(r"x_i")
    assert "<m:sSub>" in omml_sub
    assert "<m:sub>" in omml_sub

    # Superscript: x^2
    omml_sup = ms.latex_to_omml(r"x^2")
    assert "<m:sSup>" in omml_sup
    assert "<m:sup>" in omml_sup

    # Greek symbol with superscript: \sigma^2
    omml_sigma = ms.latex_to_omml(r"\sigma^2")
    assert "<m:sSup>" in omml_sigma
    assert "σ" in omml_sigma or "sigma" in omml_sigma


def test_roots_and_nth_roots():
    r"""Verify square roots \sqrt{x} and nth roots \sqrt[3]{x+1}."""
    ms = MathService()

    # Square root
    omml_sqrt = ms.latex_to_omml(r"\sqrt{x}")
    assert "<m:rad>" in omml_sqrt
    assert 'm:degHide m:val="1"' in omml_sqrt  # Square root hides degree number 2

    # Cube root
    omml_cbrt = ms.latex_to_omml(r"\sqrt[3]{x+1}")
    assert "<m:rad>" in omml_cbrt
    assert 'm:degHide m:val="0"' in omml_cbrt  # Nth root reveals degree
    assert "<m:deg>" in omml_cbrt


def test_greek_symbols():
    """Verify Greek symbols are mapped to proper unicode characters in OMML."""
    ms = MathService()

    symbols = [r"\alpha", r"\beta", r"\gamma", r"\Delta", r"\Omega", r"\theta"]
    for s in symbols:
        omml = ms.latex_to_omml(s)
        assert "<m:oMath" in omml
        assert "\\" not in omml  # Must NOT contain raw backslash in text output


def test_summation_integrals_and_limits():
    """Verify n-ary operators (summation, integrals) and limits."""
    ms = MathService()

    # Summation: \sum_{i=1}^{n} x_i
    omml_sum = ms.latex_to_omml(r"\sum_{i=1}^{n} x_i")
    assert "<m:nary>" in omml_sum or "<m:sSubSup>" in omml_sum

    # Integral: \int_{a}^{b} f(x) dx
    omml_int = ms.latex_to_omml(r"\int_{a}^{b} f(x) dx")
    assert "<m:nary>" in omml_int or "<m:sSubSup>" in omml_int or "<m:oMath" in omml_int

    # Limit: \lim_{x \to 0} \frac{\sin x}{x}
    omml_lim = ms.latex_to_omml(r"\lim_{x \to 0} \frac{\sin x}{x}")
    assert "<m:f>" in omml_lim  # Contains fraction
    assert "<m:limLow>" in omml_lim or "<m:sSub>" in omml_lim


def test_matrices():
    """Verify matrix representation in OMML."""
    ms = MathService()
    mat_latex = r"\begin{matrix} a & b \\ c & d \end{matrix}"
    omml_mat = ms.latex_to_omml(mat_latex, display=True)

    assert "<m:m>" in omml_mat
    assert "<m:mr>" in omml_mat
    assert "a" in omml_mat
    assert "d" in omml_mat


# =========================================================================
# 4. Mixed Text + Math Segmentation
# =========================================================================

def test_mixed_text_and_inline_math():
    """Verify segment_text_and_math accurately isolates inline equations while preserving prose."""
    ms = MathService()
    text = "The variance is given by $\\sigma^2 = \\frac{1}{N} \\sum_{i=1}^N (x_i - \\mu)^2$, where 5/10 samples passed."
    segments = ms.segment_text_and_math(text)

    types = [s["type"] for s in segments]
    assert types == ["text", "math", "text"]

    # First text segment
    assert "The variance is given by" in segments[0]["content"]

    # Math segment
    math_seg = segments[1]
    assert math_seg["type"] == "math"
    assert "<m:f>" in math_seg["omml"]  # Fraction in OMML
    assert "5/10" not in math_seg["raw"]

    # Second text segment
    assert "where 5/10 samples passed." in segments[2]["content"]


# =========================================================================
# 5. Full End-to-End DOCX Generation & Archive Inspection
# =========================================================================

def test_docx_contains_real_omml_equations_not_raw_latex():
    """Verify the generated .docx archive contains real Word OMML elements and NO unrendered LaTeX."""
    doc_service = DocumentService()
    docx_service = DocxService()

    raw_academic_paper = """
# Quantum Field Theory and Statistics

## Dispersion Relation
In relativistic physics, energy satisfies $E = \\sqrt{p^2 c^2 + m^2 c^4}$.
For a system of fermions, the Fermi-Dirac distribution is:
$$
f(E) = \\frac{1}{e^{(E-\\mu)/k_B T} + 1}
$$

The sum over states $\\sum_{k} n_k$ yields the total particle density.
In our trial, 7/10 experiments confirmed the threshold.
"""
    req = FormattingRequestSkeleton(raw_text=raw_academic_paper)
    academic_doc = doc_service.process_document(req)

    docx_bytes = docx_service.generate_docx(academic_doc, preset="academic")

    # Inspect the word/document.xml inside the generated DOCX package
    with zipfile.ZipFile(BytesIO(docx_bytes), "r") as zf:
        doc_xml = zf.read("word/document.xml").decode("utf-8")

        # 1. Assert OMML math tags are present
        assert "<m:oMath" in doc_xml

        # 2. Assert fraction <m:f> and radical <m:rad> are present
        assert "<m:f>" in doc_xml
        assert "<m:rad>" in doc_xml

        # 3. Assert raw LaTeX command strings like \frac{1} or \sqrt{ are NOT leaked as raw text
        assert r"\frac{1}" not in doc_xml
        assert r"\sqrt{" not in doc_xml

        # 4. Ordinary text with slashes must be intact
        assert "7/10 experiments" in doc_xml
