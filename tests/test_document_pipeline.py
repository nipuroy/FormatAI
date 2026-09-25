"""Comprehensive test suite for the academic document processing pipeline.

Tests each major academic content type:
- Title, headings, subheadings, and heading hierarchy normalization
- Paragraphs and academic typography normalization
- Ordered and unordered lists
- Tables with headers, row cells, and alignments
- Blockquotes and citations
- Code blocks (preserving indentation and syntax verbatim)
- Mathematical expressions and LaTeX (inline and display)
- Scientific notation and chemical formulas
- Citations (APA / IEEE) and References section extraction
- Content cleanup vs. formatting cleanup separation
- Full API endpoint POST /api/document/process
"""

try:
    import pytest
except ImportError:
    pytest = None
from fastapi.testclient import TestClient
from backend.main import app
from backend.models.document import BlockType, CitationStyle, DocumentFormat, FormattingRequestSkeleton
from backend.services.content_cleanup_service import ContentCleanupService
from backend.services.document_service import DocumentService
from backend.services.formatting_service import FormattingService

client = TestClient(app)


# =========================================================================
# 1. Title, Headings, and Hierarchy Normalization Tests
# =========================================================================

def test_title_and_heading_hierarchy():
    """Verify document title detection and normalization of erratic heading jumps."""
    service = DocumentService()
    raw = """
# Neural Network Quantum States

#### System Overview
This is an overview jumping from H1 to H4.

### Wavefunction Approximation
Details on the wavefunction ansatz.
"""
    req = FormattingRequestSkeleton(raw_text=raw)
    doc = service.process_document(req)

    assert doc.title == "Neural Network Quantum States"
    # First block should be the Title
    assert doc.blocks[0].block_type == BlockType.TITLE
    assert doc.blocks[0].text == "Neural Network Quantum States"

    # Next heading should have its level normalized: H4 normalized to H2
    h2_block = doc.blocks[1]
    assert h2_block.block_type == BlockType.HEADING
    assert h2_block.level == 2
    assert h2_block.text == "System Overview"

    # Following heading: H3 normalized to H3 (since current level was 2, max jump +1)
    h3_block = doc.blocks[3]
    assert h3_block.block_type == BlockType.HEADING
    assert h3_block.level == 3
    assert h3_block.text == "Wavefunction Approximation"


# =========================================================================
# 2. Paragraphs and Typography Normalization Tests
# =========================================================================

def test_paragraphs_and_typography():
    """Verify paragraph detection and typography rules (smart quotes, dashes, ellipses)."""
    service = DocumentService()
    raw = """
# Experimental Results

The reaction occurred between 10--20 degrees Celsius. "High-throughput sequencing" was applied---yielding high fidelity...
"""
    req = FormattingRequestSkeleton(raw_text=raw)
    doc = service.process_document(req)

    para_block = [b for b in doc.blocks if b.block_type == BlockType.PARAGRAPH][0]
    # En-dash for number range: 10--20 -> 10–20
    assert "10–20" in para_block.text
    # Smart quotes: "High-throughput sequencing" -> “High-throughput sequencing”
    assert "“High-throughput sequencing”" in para_block.text
    # Em-dash: applied---yielding -> applied—yielding
    assert "applied—yielding" in para_block.text
    # Ellipsis: ... -> …
    assert "fidelity…" in para_block.text


# =========================================================================
# 3. Lists: Ordered and Unordered Lists
# =========================================================================

def test_ordered_and_unordered_lists():
    """Verify detection and normalization of ordered and unordered list blocks."""
    service = DocumentService()
    raw = """
# Methodology

Key objectives:
- Calibrate the optical sensors
- Measure photon coherence time
- Replicate standard Bell inequalities

Execution steps:
1. Initialize the superconducting qubit
2. Apply Hadamard transformation
3. Measure state probability
"""
    req = FormattingRequestSkeleton(raw_text=raw)
    doc = service.process_document(req)

    unordered = [b for b in doc.blocks if b.block_type == BlockType.UNORDERED_LIST][0]
    assert len(unordered.items) == 3
    assert unordered.items[0] == "Calibrate the optical sensors"

    ordered = [b for b in doc.blocks if b.block_type == BlockType.ORDERED_LIST][0]
    assert len(ordered.items) == 3
    assert ordered.items[0] == "Initialize the superconducting qubit"
    assert ordered.items[2] == "Measure state probability"


# =========================================================================
# 4. Tables Detection and Alignment
# =========================================================================

def test_table_parsing_and_alignment():
    """Verify markdown table parsing, header extraction, row values, and alignments."""
    service = DocumentService()
    raw = """
# Performance Evaluation

| Model | Accuracy (%) | Latency (ms) |
|:---|:---:|---:|
| Baseline | 82.4 | 145 |
| FormatAI | 98.7 | 42 |
"""
    req = FormattingRequestSkeleton(raw_text=raw)
    doc = service.process_document(req)

    tables = [b for b in doc.blocks if b.block_type == BlockType.TABLE]
    assert len(tables) == 1
    table = tables[0]

    assert table.headers == ["Model", "Accuracy (%)", "Latency (ms)"]
    assert table.alignments == ["left", "center", "right"]
    assert len(table.rows) == 2
    assert table.rows[0] == ["Baseline", "82.4", "145"]
    assert table.rows[1] == ["FormatAI", "98.7", "42"]
    assert doc.statistics.table_count == 1


# =========================================================================
# 5. Blockquotes
# =========================================================================

def test_blockquote_parsing():
    """Verify blockquote structure preservation."""
    service = DocumentService()
    raw = """
# Theoretical Grounding

> Science is what we understand well enough to explain to a computer. Art is everything else we do.
"""
    req = FormattingRequestSkeleton(raw_text=raw)
    doc = service.process_document(req)

    quotes = [b for b in doc.blocks if b.block_type == BlockType.BLOCKQUOTE]
    assert len(quotes) == 1
    assert "Science is what we understand" in quotes[0].text


# =========================================================================
# 6. Code Blocks
# =========================================================================

def test_code_block_preservation():
    """Verify code blocks retain language and exact indentation without typography tampering."""
    service = DocumentService()
    raw = '''
# Implementation

```python
def compute_energy(psi, hamiltonian):
    """Calculate expectation value <psi|H|psi>."""
    return psi.T @ hamiltonian @ psi
```
'''
    req = FormattingRequestSkeleton(raw_text=raw)
    doc = service.process_document(req)

    code_blocks = [b for b in doc.blocks if b.block_type == BlockType.CODE_BLOCK]
    assert len(code_blocks) == 1
    code_block = code_blocks[0]
    assert code_block.language == "python"
    assert "def compute_energy" in code_block.text
    # Quotes inside code block must NOT be converted to curly quotes
    assert '"""Calculate expectation value <psi|H|psi>."""' in code_block.text
    assert doc.statistics.code_block_count == 1


# =========================================================================
# 7. Mathematical Expressions and LaTeX
# =========================================================================

def test_mathematical_expressions_and_latex():
    """Verify inline math, display LaTeX math blocks, and delimiter standardization."""
    service = DocumentService()
    raw = """
# Relativistic Mechanics

The celebrated mass-energy equivalence states that $E = mc^2$, where $c$ is the speed of light.

The one-dimensional Gaussian integral is defined as:
$$
\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}
$$
"""
    req = FormattingRequestSkeleton(raw_text=raw)
    doc = service.process_document(req)

    math_blocks = [b for b in doc.blocks if b.block_type == BlockType.MATH_BLOCK]
    assert len(math_blocks) == 1
    assert "\\sqrt{\\pi}" in math_blocks[0].text
    assert math_blocks[0].math_type == "display"
    assert doc.statistics.math_block_count == 1


# =========================================================================
# 8. Scientific Notation and Chemical Formulas
# =========================================================================

def test_scientific_notation_and_chemical_formulas():
    """Verify recognition and preservation of scientific notation and chemical formulas."""
    service = DocumentService()
    raw = """
# Physical Chemistry

The reaction of glucose C6H12O6 with oxygen O2 produces carbon dioxide CO2 and water H2O.
Avogadro's constant is approximately 6.022 \\times 10^{23} mol^{-1} and the speed of light is 3.0e8 m/s.
"""
    req = FormattingRequestSkeleton(raw_text=raw)
    doc = service.process_document(req)

    para = [b for b in doc.blocks if b.block_type == BlockType.PARAGRAPH][0]
    # Check detected chemical formulas
    assert "C6H12O6" in para.chemical_formulas
    assert "CO2" in para.chemical_formulas
    assert "H2O" in para.chemical_formulas

    # Check detected scientific notation
    assert any("10^{23}" in s for s in para.scientific_notations)
    assert any("3.0e8" in s for s in para.scientific_notations)


# =========================================================================
# 9. Citations and References Extraction
# =========================================================================

def test_citations_and_references_separation():
    """Verify in-text citation extraction and reference list separation."""
    service = DocumentService()
    raw = """
# Neural Computation

Recent advances in deep learning (LeCun et al., 2015) and transformer models [1] have reshaped NLP.
Similar findings were reported by (Vaswani et al., 2017) and confirmed in benchmark tests [2, 3].

## References
1. Vaswani, A., et al. (2017). Attention is all you need. NeurIPS.
2. LeCun, Y., Bengio, Y., & Hinton, G. (2015). Deep learning. Nature, 521(7553), 436-444.
"""
    req = FormattingRequestSkeleton(raw_text=raw)
    doc = service.process_document(req)

    # In-text citations should be collected
    assert any("LeCun et al., 2015" in c for c in doc.citations)
    assert any("[1]" in c for c in doc.citations)
    assert any("Vaswani et al., 2017" in c for c in doc.citations)

    # References section entries should be cleanly extracted into doc.references
    assert len(doc.references) >= 2
    assert any("Attention is all you need" in r for r in doc.references)
    assert any("Deep learning" in r for r in doc.references)
    assert doc.statistics.citation_count >= 2
    assert doc.statistics.reference_count >= 2


# =========================================================================
# 10. Separation of Content Cleanup vs. Formatting Cleanup
# =========================================================================

def test_content_cleanup_vs_formatting_cleanup():
    """Verify that content cleanup strips AI noise while formatting handles hierarchy and typography."""
    content_cleaner = ContentCleanupService()
    formatter = FormattingService()
    service = DocumentService(content_cleanup_service=content_cleaner, formatting_service=formatter)

    raw_noisy_ai_input = """
Sure! Here is the formatted paper:

# Quantum Information Theory

* **1. Introduction**

Quantum mechanics provides non-classical correlation.

## Methods

## Methods

Measurements were taken.

Hope this helps! Let me know if you need any adjustments.
"""
    req = FormattingRequestSkeleton(raw_text=raw_noisy_ai_input)
    doc = service.process_document(req)

    # 1. AI prefix & suffix stripped
    for b in doc.blocks:
        assert "Sure! Here is" not in b.text
        assert "Hope this helps" not in b.text

    # 2. Pseudo-bullet `* **1. Introduction**` converted to heading block
    intro_block = [b for b in doc.blocks if "Introduction" in b.text][0]
    assert intro_block.block_type == BlockType.HEADING

    # 3. Duplicate consecutive heading `## Methods` eliminated
    methods_headings = [b for b in doc.blocks if b.block_type == BlockType.HEADING and b.text == "Methods"]
    assert len(methods_headings) == 1

    # 4. Academic meaning preserved
    assert any("Quantum mechanics provides non-classical correlation" in b.text for b in doc.blocks)


# =========================================================================
# 11. Full API Route Test
# =========================================================================

def test_api_document_process_endpoint():
    """Verify POST /api/document/process returns a fully structured DocumentProcessResponse."""
    payload = {
        "raw_text": "# Machine Learning in Oncology\n\nAutomated diagnostic algorithms achieve high accuracy [1].\n\n## References\n1. Esteva, A., et al. (2017). Dermatologist-level classification. Nature.",
        "citation_style": "ieee",
        "export_format": "docx",
        "title": "Machine Learning in Oncology",
    }
    response = client.post("/api/document/process", json=payload)
    assert response.status_code == 200

    data = response.json()
    assert data["success"] is True
    doc = data["document"]
    assert doc["title"] == "Machine Learning in Oncology"
    assert doc["citation_style"] == "ieee"
    assert doc["export_format"] == "docx"
    assert len(doc["blocks"]) >= 2
    assert len(doc["references"]) >= 1
    assert doc["statistics"]["word_count"] > 0
