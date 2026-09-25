"""Conversion utility from MathML AST to Word OpenXML Office Math Markup Language (OMML).

Transforms MathML elements (<mfrac>, <msup>, <msub>, <msubsup>, <msqrt>, <mroot>,
<mtable>, <mtr>, <mtd>, <mo>, <mi>, <mn>, etc.) into Microsoft Word OMML:
<m:oMath>
  <m:f> (fraction)
  <m:sSup> (superscript)
  <m:sSub> (subscript)
  <m:sSubSup> (sub-superscript)
  <m:rad> (radical / square root / nth root)
  <m:nary> (n-ary operators: sum, integral, product)
  <m:m> (matrix)
  <m:r> (run with <m:t>)
"""

import xml.etree.ElementTree as ET
import xml.sax.saxutils as saxutils
from typing import List, Optional

OMML_NS = "http://schemas.openxmlformats.org/officeDocument/2006/math"
W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"

# Common Greek and Math symbol mapping from LaTeX/Unicode tokens
GREEK_SYMBOLS = {
    "alpha": "α", "beta": "β", "gamma": "γ", "delta": "δ", "epsilon": "ε",
    "zeta": "ζ", "eta": "η", "theta": "θ", "iota": "ι", "kappa": "κ",
    "lambda": "λ", "mu": "μ", "nu": "ν", "xi": "ξ", "pi": "π", "rho": "ρ",
    "sigma": "σ", "tau": "τ", "upsilon": "υ", "phi": "φ", "chi": "χ",
    "psi": "ψ", "omega": "ω",
    "Gamma": "Γ", "Delta": "Δ", "Theta": "Θ", "Lambda": "Λ", "Xi": "Ξ",
    "Pi": "Π", "Sigma": "Σ", "Upsilon": "Υ", "Phi": "Φ", "Psi": "Ψ", "Omega": "Ω",
}

NARY_OPERATORS = {
    "∑": "∑", "\\sum": "∑", "sum": "∑",
    "∫": "∫", "\\int": "∫", "int": "∫",
    "∏": "∏", "\\prod": "∏", "prod": "∏",
    "⋂": "⋂", "\\bigcap": "⋂",
    "⋃": "⋃", "\\bigcup": "⋃",
}


def _strip_ns(tag: str) -> str:
    """Remove XML namespace from tag name."""
    if "}" in tag:
        return tag.split("}", 1)[1]
    return tag


def mathml_to_omml(mathml_str: str, display: bool = False) -> str:
    """Convert a MathML XML string into an OMML (<m:oMath> or <m:oMathPara>) XML string."""
    try:
        root = ET.fromstring(mathml_str)
    except ET.ParseError:
        return ""

    body_xml = _convert_element(root)

    if display:
        return (
            f'<m:oMathPara xmlns:m="{OMML_NS}" xmlns:w="{W_NS}">'
            f'  <m:oMath>{body_xml}</m:oMath>'
            f'</m:oMathPara>'
        )
    else:
        return f'<m:oMath xmlns:m="{OMML_NS}" xmlns:w="{W_NS}">{body_xml}</m:oMath>'


def _convert_element(elem: ET.Element) -> str:
    """Recursively convert a MathML ElementTree node to its OMML equivalent."""
    tag = _strip_ns(elem.tag)

    # 1. Container elements: <math>, <mrow>, <mstyle>, <mpadded>, <semantics>
    if tag in ("math", "mrow", "mstyle", "mpadded", "semantics"):
        children_xml = [_convert_element(child) for child in elem]
        return "".join(children_xml)

    # 2. Text tokens: <mi> (identifier), <mn> (number), <mo> (operator), <mtext> (text)
    if tag in ("mi", "mn", "mo", "mtext"):
        raw_text = "".join(elem.itertext()).strip()
        if not raw_text:
            return ""

        # Map greek name if present
        text_val = GREEK_SYMBOLS.get(raw_text, raw_text)
        escaped = saxutils.escape(text_val)

        # Build OMML run <m:r>
        rpr = ""
        # Distinguish numbers / operators from italic identifiers
        if tag == "mn":
            rpr = '<m:rPr><m:sty m:val="p"/></m:rPr>'
        elif tag == "mo":
            rpr = '<m:rPr><m:lit/></m:rPr>'

        return f'<m:r>{rpr}<m:t>{escaped}</m:t></m:r>'

    # 3. Fraction: <mfrac> -> <m:f>
    if tag == "mfrac":
        children = list(elem)
        num_xml = _convert_element(children[0]) if len(children) > 0 else ""
        den_xml = _convert_element(children[1]) if len(children) > 1 else ""
        return (
            f'<m:f>'
            f'  <m:fPr/>'
            f'  <m:num>{num_xml}</m:num>'
            f'  <m:den>{den_xml}</m:den>'
            f'</m:f>'
        )

    # 4. Superscript: <msup> -> <m:sSup>
    if tag == "msup":
        children = list(elem)
        base_xml = _convert_element(children[0]) if len(children) > 0 else ""
        sup_xml = _convert_element(children[1]) if len(children) > 1 else ""
        return (
            f'<m:sSup>'
            f'  <m:sSupPr/>'
            f'  <m:e>{base_xml}</m:e>'
            f'  <m:sup>{sup_xml}</m:sup>'
            f'</m:sSup>'
        )

    # 5. Subscript: <msub> -> <m:sSub>
    if tag == "msub":
        children = list(elem)
        # Check if this is a limit-like operator or standard sub
        base_elem = children[0] if len(children) > 0 else None
        base_text = "".join(base_elem.itertext()).strip() if base_elem is not None else ""

        base_xml = _convert_element(children[0]) if len(children) > 0 else ""
        sub_xml = _convert_element(children[1]) if len(children) > 1 else ""

        # Check for limit with under-text e.g. \lim_{x \to 0}
        if base_text.lower() in ("lim", "max", "min", "inf", "sup"):
            return (
                f'<m:limLow>'
                f'  <m:limLowPr/>'
                f'  <m:e>{base_xml}</m:e>'
                f'  <m:lim>{sub_xml}</m:lim>'
                f'</m:limLow>'
            )

        return (
            f'<m:sSub>'
            f'  <m:sSubPr/>'
            f'  <m:e>{base_xml}</m:e>'
            f'  <m:sub>{sub_xml}</m:sub>'
            f'</m:sSub>'
        )

    # 6. Sub-Superscript: <msubsup> -> <m:sSubSup> or <m:nary>
    if tag == "msubsup":
        children = list(elem)
        base_elem = children[0] if len(children) > 0 else None
        base_text = "".join(base_elem.itertext()).strip() if base_elem is not None else ""

        base_xml = _convert_element(children[0]) if len(children) > 0 else ""
        sub_xml = _convert_element(children[1]) if len(children) > 1 else ""
        sup_xml = _convert_element(children[2]) if len(children) > 2 else ""

        # Check if base is an n-ary operator (sum, integral, product)
        if base_text in ("∑", "∫", "∏", "⋂", "⋃") or any(k in base_text for k in ("sum", "int", "prod")):
            op_char = saxutils.escape(base_text if base_text in ("∑", "∫", "∏", "⋂", "⋃") else "∑")
            return (
                f'<m:nary>'
                f'  <m:naryPr><m:chr m:val="{op_char}"/><m:limLoc m:val="undOvr"/></m:naryPr>'
                f'  <m:sub>{sub_xml}</m:sub>'
                f'  <m:sup>{sup_xml}</m:sup>'
                f'  <m:e/>'
                f'</m:nary>'
            )

        return (
            f'<m:sSubSup>'
            f'  <m:sSubSupPr/>'
            f'  <m:e>{base_xml}</m:e>'
            f'  <m:sub>{sub_xml}</m:sub>'
            f'  <m:sup>{sup_xml}</m:sup>'
            f'</m:sSubSup>'
        )

    # 7. Radicals / Square roots / Nth roots: <msqrt>, <mroot> -> <m:rad>
    if tag == "msqrt":
        inner_xml = "".join(_convert_element(c) for c in elem)
        return (
            f'<m:rad>'
            f'  <m:radPr><m:degHide m:val="1"/></m:radPr>'
            f'  <m:deg/>'
            f'  <m:e>{inner_xml}</m:e>'
            f'</m:rad>'
        )

    if tag == "mroot":
        children = list(elem)
        base_xml = _convert_element(children[0]) if len(children) > 0 else ""
        deg_xml = _convert_element(children[1]) if len(children) > 1 else ""
        return (
            f'<m:rad>'
            f'  <m:radPr><m:degHide m:val="0"/></m:radPr>'
            f'  <m:deg>{deg_xml}</m:deg>'
            f'  <m:e>{base_xml}</m:e>'
            f'</m:rad>'
        )

    # 8. Under/Over: <munder>, <mover>, <munderover>
    if tag in ("munder", "munderover"):
        children = list(elem)
        base_elem = children[0] if len(children) > 0 else None
        base_text = "".join(base_elem.itertext()).strip() if base_elem is not None else ""
        base_xml = _convert_element(children[0]) if len(children) > 0 else ""
        sub_xml = _convert_element(children[1]) if len(children) > 1 else ""

        if tag == "munderover":
            sup_xml = _convert_element(children[2]) if len(children) > 2 else ""
            if base_text in ("∑", "∫", "∏"):
                return (
                    f'<m:nary>'
                    f'  <m:naryPr><m:chr m:val="{saxutils.escape(base_text)}"/><m:limLoc m:val="undOvr"/></m:naryPr>'
                    f'  <m:sub>{sub_xml}</m:sub>'
                    f'  <m:sup>{sup_xml}</m:sup>'
                    f'  <m:e/>'
                    f'</m:nary>'
                )
            return (
                f'<m:sSubSup>'
                f'  <m:sSubSupPr/>'
                f'  <m:e>{base_xml}</m:e>'
                f'  <m:sub>{sub_xml}</m:sub>'
                f'  <m:sup>{sup_xml}</m:sup>'
                f'</m:sSubSup>'
            )

        # <munder>
        if base_text.lower() in ("lim", "max", "min"):
            return (
                f'<m:limLow>'
                f'  <m:limLowPr/>'
                f'  <m:e>{base_xml}</m:e>'
                f'  <m:lim>{sub_xml}</m:lim>'
                f'</m:limLow>'
            )
        return (
            f'<m:sSub>'
            f'  <m:sSubPr/>'
            f'  <m:e>{base_xml}</m:e>'
            f'  <m:sub>{sub_xml}</m:sub>'
            f'</m:sSub>'
        )

    # 9. Matrix: <mtable>, <mtr>, <mtd> -> <m:m>, <m:mr>, <m:e>
    if tag == "mtable":
        rows_xml = []
        for row in elem:
            if _strip_ns(row.tag) == "mtr":
                cells_xml = []
                for cell in row:
                    cell_content = "".join(_convert_element(c) for c in cell)
                    cells_xml.append(f'<m:e>{cell_content}</m:e>')
                rows_xml.append(f'<m:mr>{"".join(cells_xml)}</m:mr>')

        return (
            f'<m:m>'
            f'  <m:mPr/>'
            f'  {"".join(rows_xml)}'
            f'</m:m>'
        )

    # Fallback: process children or extract text
    children_xml = [_convert_element(child) for child in elem]
    if children_xml:
        return "".join(children_xml)

    text_val = "".join(elem.itertext()).strip()
    if text_val:
        return f'<m:r><m:t>{saxutils.escape(text_val)}</m:t></m:r>'

    return ""
