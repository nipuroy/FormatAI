"""Text processing and academic pattern recognition utilities.

Provides regex-based detection and normalization for:
- Mathematical expressions (LaTeX inline & display)
- Scientific notation
- Chemical formulas
- Academic citations & references
- Typography normalization (smart quotes, dashes, ligatures)
"""

import re
from typing import Any, Dict, List, Tuple
from backend.utils.formatting import clean_text, estimate_word_count, sanitize_filename

# =========================================================================
# Academic Pattern Definitions
# =========================================================================

# LaTeX Math Environments: $$...$$, \[...\], \begin{equation}...\end{equation}, \begin{align}...\end{align}
RE_DISPLAY_MATH = re.compile(
    r"(\$\$(?:\\.|[^\$])+\$\$|\\\[(?:\\.|[^\]])+\\\]|\\begin\{(?:equation\*?|align\*?|gather\*?|multline\*?)\}(?:\\.|[\s\S])+?\\end\{(?:equation\*?|align\*?|gather\*?|multline\*?)\})",
    re.MULTILINE,
)

# Inline Math: $...$ (not preceded or followed by another $)
RE_INLINE_MATH = re.compile(r"(?<!\$)\$(?!\$)(.+?)(?<!\$)\$(?!\$)")

# Scientific notation: e.g. 6.022 \times 10^{23}, 1.602 x 10^-19, 3.0e8, 4.5E-12
RE_SCIENTIFIC_NOTATION = re.compile(
    r"(?:\b\d+(?:\.\d+)?\s*(?:\\times|[x×])\s*10\s*[\^]?\s*\{?[-+]?\d+\}?|\b\d+(?:\.\d+)?[eE][-+]?\d+\b)"
)

# Chemical formulas: H2O, CO2, C6H12O6, H2SO4, Fe2O3, Ca(OH)2, or \ce{...}
RE_CE_LATEX = re.compile(r"\\ce\{([^}]+)\}")
RE_CHEMICAL_FORMULA = re.compile(
    r"\b(?:[A-Z][a-z]?\d*)+(?:\([A-Z][a-z]?\d*\)\d*)*\b"
)
KNOWN_CHEMICALS = {
    "H2O", "CO2", "CO", "O2", "N2", "H2", "CH4", "C6H12O6", "NaCl", "HCl",
    "H2SO4", "HNO3", "NaOH", "KOH", "CaCO3", "CaO", "Fe2O3", "NH3", "NO2",
    "C2H5OH", "CH3COOH", "ATP", "ADP", "DNA", "RNA"
}

# Academic Citations:
# 1. Author-date (APA / Harvard): (Smith, 2020), (Smith et al., 2021), (Smith & Jones, 2019)
RE_CITATION_AUTHOR_DATE = re.compile(
    r"\(([A-Z][A-Za-z\-]+(?:\s+et\s+al\.?|\s+and\s+[A-Z][A-Za-z\-]+|\s*&\s*[A-Z][A-Za-z\-]+)?,\s*(?:19|20)\d{2}[a-z]?)\)"
)
# 2. Numeric / IEEE: [1], [1, 2], [1-4], [12]
RE_CITATION_NUMERIC = re.compile(r"\[(\d+(?:\s*[\-,]\s*\d+)*)\]")

# AI Conversational Intro & Outro Noise
RE_AI_INTRO_NOISE = re.compile(
    r"^(?:(?:Sure|Certainly|Here|Below|Here is|Here's|As requested|I have formatted)[\w\s,:—\-\.!?]*?(?:\n+|\:\s*\n+))",
    re.IGNORECASE,
)
RE_AI_OUTRO_NOISE = re.compile(
    r"(?:\n+(?:Hope this helps|Let me know if you need|Feel free to ask|I have preserved|Good luck with your research)[\w\s,:—\-\.!?]*)$",
    re.IGNORECASE,
)


# =========================================================================
# Detection Functions
# =========================================================================

def detect_math_expressions(text: str) -> List[Dict[str, Any]]:
    """Detect both inline and display LaTeX math expressions in text."""
    results = []

    # Display math
    for match in RE_DISPLAY_MATH.finditer(text):
        results.append({
            "type": "display_math",
            "content": match.group(1),
            "start": match.start(),
            "end": match.end(),
        })

    # Inline math
    for match in RE_INLINE_MATH.finditer(text):
        results.append({
            "type": "inline_math",
            "content": match.group(1),
            "raw": match.group(0),
            "start": match.start(),
            "end": match.end(),
        })

    return results


def detect_scientific_notation(text: str) -> List[str]:
    """Extract instances of scientific notation."""
    matches = RE_SCIENTIFIC_NOTATION.findall(text)
    return [m.strip() for m in matches]


def detect_chemical_formulas(text: str) -> List[str]:
    r"""Detect chemical formulas including LaTeX \ce{} or common chemical tokens."""
    formulas = []

    # LaTeX \ce{}
    for match in RE_CE_LATEX.finditer(text):
        formulas.append(match.group(1).strip())

    # Common chemical formulas
    tokens = re.findall(r"\b[A-Za-z0-9\(\)]+\b", text)
    for tok in tokens:
        if tok in KNOWN_CHEMICALS:
            formulas.append(tok)
        elif (
            len(tok) >= 3
            and any(c.isupper() for c in tok)
            and any(c.isdigit() for c in tok)
            and any(c in {"H", "C", "O", "N", "S", "P", "Fe", "Cu", "Zn", "Ca", "Na", "Cl"} for c in tok)
        ):
            if tok not in formulas:
                formulas.append(tok)

    return list(dict.fromkeys(formulas))


def detect_citations(text: str) -> List[Dict[str, str]]:
    """Detect in-text citations conforming to APA, Harvard, or IEEE styles."""
    citations = []

    for match in RE_CITATION_AUTHOR_DATE.finditer(text):
        citations.append({
            "style": "author_date",
            "raw": match.group(0),
            "entry": match.group(1),
        })

    for match in RE_CITATION_NUMERIC.finditer(text):
        # Exclude common single digits that are likely math indexes or list numbers
        citations.append({
            "style": "numeric",
            "raw": match.group(0),
            "entry": match.group(1),
        })

    return citations


# =========================================================================
# Normalization Functions
# =========================================================================

def normalize_spacing(text: str) -> str:
    """Normalize irregular spacing, carriage returns, and excessive empty lines."""
    if not text:
        return ""

    # Convert Windows CRLF and CR to LF
    normalized = text.replace("\r\n", "\n").replace("\r", "\n")

    # Replace horizontal tabs with 4 spaces
    normalized = normalized.replace("\t", "    ")

    # Strip trailing whitespace on each line
    lines = [line.rstrip() for line in normalized.split("\n")]
    normalized = "\n".join(lines)

    # Collapse more than 2 consecutive blank lines into at most 2
    normalized = re.sub(r"\n{3,}", "\n\n", normalized)

    return normalized.strip()


def normalize_typography(text: str) -> str:
    """Normalize academic typography: smart quotes, en-dashes for ranges, em-dashes."""
    if not text:
        return ""

    out = text

    # Protect code blocks, math blocks, and table rows from typography alteration
    code_blocks: List[str] = []
    def _save_code(m):
        code_blocks.append(m.group(0))
        return f"__CODE_BLOCK_{len(code_blocks)-1}__"

    out = re.sub(r"```[\s\S]*?```", _save_code, out)
    out = re.sub(r"`[^`\n]+`", _save_code, out)
    out = re.sub(r"\$\$[\s\S]*?\$\$", _save_code, out)
    out = re.sub(r"\$[^\$\n]+\$", _save_code, out)
    out = re.sub(r"^[ \t]*\|.*\|[ \t]*$", _save_code, out, flags=re.MULTILINE)

    # Replace double hyphens -- with en-dash – (especially for page numbers / number ranges)
    out = re.sub(r"(\d+)\s*--\s*(\d+)", r"\1–\2", out)
    out = re.sub(r"(\b[A-Za-z]+)\s*--\s*([A-Za-z]+)", r"\1—\2", out)

    # Replace triple hyphens --- with em-dash —
    out = re.sub(r"(?<!-)---(?!-)", "—", out)

    # Convert ellipsis ... to …
    out = re.sub(r"\.{3}", "…", out)

    # Smart double quotes: "text" -> “text”
    out = re.sub(r'(^|[\s\(\[\{])"([^\s"][^"]*?)"', r'\1“\2”', out)
    # Smart single quotes: 'text' -> ‘text’
    out = re.sub(r"(^|[\s\(\[\{])'([^\s'][^']*?)'", r"\1‘\2’", out)

    # Restore code and math blocks
    for i, block in enumerate(code_blocks):
        out = out.replace(f"__CODE_BLOCK_{i}__", block)

    return out


def fix_mathematical_representation(text: str) -> str:
    """Fix common mathematical formatting errors, ensuring balanced delimiters and LaTeX tags."""
    if not text:
        return ""

    out = text

    # Convert broken bracket math \( ... \) to $ ... $
    out = re.sub(r"\\\((.+?)\\\)", r"$\1$", out)

    # Convert \[ ... \] to display math $$ ... $$
    out = re.sub(r"\\\[\s*([\s\S]+?)\s*\\\]", r"$$\n\1\n$$", out)

    # Normalize scientific notation with 'x' inside math to \times
    def _fix_times(match):
        return f"{match.group(1)} \\times 10^{{{match.group(2)}}}"

    out = re.sub(r"(\d+(?:\.\d+)?)\s*[xX]\s*10\^\{?([-+]?\d+)\}?", _fix_times, out)

    return out


def remove_broken_formatting_artifacts(text: str) -> str:
    """Clean unclosed formatting tags (unmatched **, __), orphan markdown markers."""
    if not text:
        return ""

    lines = text.split("\n")
    cleaned_lines = []

    for line in lines:
        stripped = line.strip()
        # If line has odd number of asterisks, fix single unclosed bold/italic
        # (excluding horizontal rules ***)
        if stripped not in {"***", "---", "___"}:
            double_stars = line.count("**")
            if double_stars % 2 != 0:
                # If there's an unmatched trailing **, remove or close it
                if line.endswith("**"):
                    line = line[:-2]
                else:
                    line = line + "**"

        cleaned_lines.append(line)

    return "\n".join(cleaned_lines)
