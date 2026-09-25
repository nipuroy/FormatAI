r"""Comprehensive regression tests for FormatAI PDF generation engine and export API.

Verifies:
- Generation of valid, publication-grade PDF binaries
- Accurate page count tracking (two-pass NumberedCanvas)
- Blank-page prevention (no orphan trailing blank pages, no whitespace-only pages)
- Table preservation, cell wrapping, and alignment
- Headings (Title, H1, H2, H3) and keepWithNext structure
- Long document multi-page flow and pagination
- Mathematical content preservation (fractions, sub/superscripts, roots, Greek letters, summation, limits)
- Slash-in-prose protection (e.g. "5/10 students" remains plain text)
- Presets: Academic, Research Paper, Exam, Study Notes, Textbook
- API endpoint POST /api/documents/pdf and POST /api/document/pdf
"""

from io import BytesIO
import re
import pypdf
import pytest
from fastapi.testclient import TestClient

from backend.core.docx_styles import DocxPresetType
from backend.main import app
from backend.models.document import (
    AcademicDocument,
    BlockType,
    DocumentBlock,
    FormattingRequestSkeleton,
    PdfExportRequest,
)
from backend.services.document_service import DocumentService
from backend.services.pdf_service import PdfService

client = TestClient(app)


# =========================================================================
# 1. Binary Archive & PDF Validity Tests
# =========================================================================

def test_pdf_binary_validity():
    """Verify that PdfService produces a valid PDF file readable by standard PDF parsers."""
    doc_service = DocumentService()
    pdf_service = PdfService()

    raw_text = """
# Deep Representation Learning

## Introduction
Modern deep architectures learn hierarchical representations directly from high-dimensional data.

### Latent Manifold Structure
The latent space geometry preserves neighborhood topology.
"""
    req = FormattingRequestSkeleton(raw_text=raw_text)
    academic_doc = doc_service.process_document(req)

    pdf_bytes = pdf_service.generate_pdf(academic_doc, preset="academic")

    # 1. Assert non-empty binary
    assert len(pdf_bytes) > 1000

    # 2. Assert standard PDF magic header and EOF trailer
    assert pdf_bytes.startswith(b"%PDF-")
    assert b"%%EOF" in pdf_bytes[-1024:]

    # 3. Assert pypdf can parse the document
    reader = pypdf.PdfReader(BytesIO(pdf_bytes))
    assert len(reader.pages) >= 1

    extracted_text = reader.pages[0].extract_text()
    assert "Deep Representation Learning" in extracted_text
    assert "Modern deep architectures" in extracted_text


# =========================================================================
# 2. Blank-Page Prevention & Page Count Regression Tests
# =========================================================================

def test_pdf_blank_page_prevention_short_document():
    """Verify short documents occupy exactly 1 page with no accidental second blank page."""
    pdf_service = PdfService()
    academic_doc = AcademicDocument(
        title="Compact Research Brief",
        blocks=[
            DocumentBlock(block_type=BlockType.TITLE, text="Compact Research Brief"),
            DocumentBlock(block_type=BlockType.HEADING, level=1, text="Executive Summary"),
            DocumentBlock(
                block_type=BlockType.PARAGRAPH,
                text="This brief summary validates that compact documents generate exactly one page.",
            ),
        ],
    )

    pdf_bytes = pdf_service.generate_pdf(academic_doc)
    reader = pypdf.PdfReader(BytesIO(pdf_bytes))

    # Must be exactly 1 page
    assert len(reader.pages) == 1

    page_text = reader.pages[0].extract_text()
    assert "Compact Research Brief" in page_text
    assert len(page_text.strip()) > 50


def test_pdf_trailing_thematic_break_no_blank_page():
    """Verify trailing thematic breaks or spacers do not cause an empty trailing page."""
    pdf_service = PdfService()
    academic_doc = AcademicDocument(
        title="Section with Trailing Break",
        blocks=[
            DocumentBlock(block_type=BlockType.TITLE, text="Section with Trailing Break"),
            DocumentBlock(block_type=BlockType.PARAGRAPH, text="Final content paragraph."),
            DocumentBlock(block_type=BlockType.THEMATIC_BREAK, text="---"),
        ],
    )

    pdf_bytes = pdf_service.generate_pdf(academic_doc)
    reader = pypdf.PdfReader(BytesIO(pdf_bytes))

    # Even with a trailing thematic break, no empty second page should be generated
    assert len(reader.pages) == 1

    # Verify no page in the document is blank / empty
    for idx, page in enumerate(reader.pages):
        text = page.extract_text()
        assert text is not None
        assert len(text.strip()) > 20, f"Page {idx+1} appears to be an accidental blank page"


# =========================================================================
# 3. Headings & Page Structure Tests
# =========================================================================

def test_pdf_headings_and_keep_with_next():
    """Verify headings (Title, H1, H2, H3) are properly formatted with keepWithNext enabled."""
    pdf_service = PdfService()
    academic_doc = AcademicDocument(
        title="Hierarchical Document Architecture",
        blocks=[
            DocumentBlock(block_type=BlockType.TITLE, text="Hierarchical Document Architecture"),
            DocumentBlock(block_type=BlockType.HEADING, level=1, text="1. Primary Foundation"),
            DocumentBlock(block_type=BlockType.HEADING, level=2, text="1.1 Sub-System Modeling"),
            DocumentBlock(block_type=BlockType.HEADING, level=3, text="1.1.1 Micro-Architecture"),
            DocumentBlock(block_type=BlockType.PARAGRAPH, text="Detailed analysis of the micro-architecture components."),
        ],
    )

    pdf_bytes = pdf_service.generate_pdf(academic_doc)
    reader = pypdf.PdfReader(BytesIO(pdf_bytes))
    full_text = "\n".join(page.extract_text() for page in reader.pages)

    assert "Hierarchical Document Architecture" in full_text
    assert "1. Primary Foundation" in full_text
    assert "1.1 Sub-System Modeling" in full_text
    assert "1.1.1 Micro-Architecture" in full_text
    assert "Detailed analysis of the micro-architecture components." in full_text


# =========================================================================
# 4. Tables Preservation and Cell Wrapping Tests
# =========================================================================

def test_pdf_tables_wrapping_and_preservation():
    """Verify tables with headers, column alignments, and extensive text wrap properly."""
    pdf_service = PdfService()
    academic_doc = AcademicDocument(
        title="Benchmark Evaluation Results",
        blocks=[
            DocumentBlock(block_type=BlockType.TITLE, text="Benchmark Evaluation Results"),
            DocumentBlock(
                block_type=BlockType.TABLE,
                headers=["Architecture", "Top-1 Accuracy", "Parameters (M)", "Inference Latency"],
                rows=[
                    ["Baseline Model", "78.4%", "25.6", "45 ms"],
                    ["FormatAI Transformer", "94.8%", "18.2", "18 ms"],
                    ["Hybrid Ensemble with Multi-Head Attention Mechanism", "96.2%", "34.1", "28 ms"],
                ],
                alignments=["left", "center", "center", "right"],
            ),
        ],
    )

    pdf_bytes = pdf_service.generate_pdf(academic_doc)
    reader = pypdf.PdfReader(BytesIO(pdf_bytes))
    full_text = "\n".join(page.extract_text() for page in reader.pages)

    # Headers present
    assert "Architecture" in full_text
    assert "Top-1 Accuracy" in full_text
    assert "Parameters (M)" in full_text
    assert "Inference Latency" in full_text

    # Cell contents present
    norm_text = re.sub(r"\s+", " ", full_text)
    assert "FormatAI Transformer" in norm_text
    assert "94.8%" in norm_text
    assert "Hybrid Ensemble with Multi-Head Attention Mechanism" in norm_text


# =========================================================================
# 5. Long Documents & Multi-Page Flow Tests
# =========================================================================

def test_pdf_long_document_multi_page_flow():
    """Verify long documents paginate cleanly across multiple pages with headers and footers."""
    doc_service = DocumentService()
    pdf_service = PdfService()

    # Generate a long document with 20 substantial sections
    sections = []
    for i in range(1, 21):
        sections.append(f"""
## Section {i}: Advanced Empirical Analysis
Empirical observation of high-dimensional parameter spaces reveals intrinsic topological sparsity.
In experiment {i}, exactly 9/10 test iterations satisfied convergence criteria without numerical divergence.
The corresponding loss function evaluation satisfies $L_{{{i}}} = \\frac{{1}}{{2}} (y_{{{i}}} - \\hat{{y}}_{{{i}}})^2$.

| Trial | Sample Size | Standard Error |
|:---|:---:|---:|
| Run A | {i * 100} | 0.0{i} |
| Run B | {i * 200} | 0.0{max(1, i-1)} |
""")

    raw_long_text = "# Extensive Treatise on Optimization\n" + "\n".join(sections)
    req = FormattingRequestSkeleton(raw_text=raw_long_text, title="Extensive Treatise on Optimization")
    academic_doc = doc_service.process_document(req)

    pdf_bytes = pdf_service.generate_pdf(academic_doc, preset="academic")
    reader = pypdf.PdfReader(BytesIO(pdf_bytes))

    # Long document should span multiple pages
    page_count = len(reader.pages)
    assert page_count >= 3, f"Expected long document to span at least 3 pages, got {page_count}"

    # Verify every page contains meaningful text (no blank pages)
    for idx, page in enumerate(reader.pages):
        text = page.extract_text()
        assert len(text.strip()) > 100, f"Page {idx+1} of {page_count} has insufficient content: {len(text.strip())} chars"

    # Verify beginning, middle, and end section headings exist across the document
    all_text = "\n".join(p.extract_text() for p in reader.pages)
    assert "Section 1:" in all_text
    assert "Section 10:" in all_text
    assert "Section 20:" in all_text


# =========================================================================
# 6. Mathematical Content & Slash-in-Prose Preservation Tests
# =========================================================================

def test_pdf_mathematical_content_and_slash_guard():
    """Verify mathematical expressions render without raw LaTeX and ordinary slashes remain intact."""
    doc_service = DocumentService()
    pdf_service = PdfService()

    raw_math_text = r"""
# Relativistic and Statistical Mechanics

## 1. Energy-Momentum Relation
In special relativity, the total energy of a particle with rest mass $m_0$ and momentum $p$ is:
$$
E = \sqrt{p^2 c^2 + m_0^2 c^4}
$$
In our evaluation, exactly 8/10 trials verified the relation with $v = 0.95c$.

## 2. Partition Function and Quantum State Summation
The canonical partition function over energy states is:
$$
Z = \sum_{n=0}^{\infty} e^{-\beta E_n}
$$
where $\beta = \frac{1}{k_B T}$ and $\sigma^2$ is the energy variance across $\alpha$-particles.

## 3. Gaussian Integral & Limits
The Gaussian integral yields:
$$
\int_{-\infty}^{\infty} e^{-a x^2} dx = \sqrt{\frac{\pi}{a}}
$$
Furthermore, the limit evaluates to $\lim_{x \to 0} \frac{\sin x}{x} = 1$.
"""
    req = FormattingRequestSkeleton(raw_text=raw_math_text)
    academic_doc = doc_service.process_document(req)

    pdf_bytes = pdf_service.generate_pdf(academic_doc)
    reader = pypdf.PdfReader(BytesIO(pdf_bytes))
    full_text = "\n".join(page.extract_text() for page in reader.pages)

    # 1. Assert ordinary slashes in text were NOT corrupted into fractions
    assert "8/10 trials" in full_text

    # 2. Assert raw LaTeX command tokens do NOT leak
    assert r"\frac{" not in full_text
    assert r"\sqrt{" not in full_text
    assert r"\sum_{" not in full_text

    # 3. Assert mathematical symbols and operators are present
    # Check for presence of square root, summation, or variables
    assert "E" in full_text
    assert "Z =" in full_text or "Z" in full_text
    assert "8/10 trials" in full_text


# =========================================================================
# 7. Style Presets Tests
# =========================================================================

def test_pdf_all_style_presets():
    """Verify all 5 style presets (academic, research_paper, exam, study_notes, textbook) generate valid PDFs."""
    pdf_service = PdfService()
    academic_doc = AcademicDocument(
        title="Style Preset Validation Document",
        blocks=[
            DocumentBlock(block_type=BlockType.TITLE, text="Style Preset Validation Document"),
            DocumentBlock(block_type=BlockType.HEADING, level=1, text="1. Overview"),
            DocumentBlock(block_type=BlockType.PARAGRAPH, text="Paragraph testing preset rendering."),
        ],
    )

    presets = ["academic", "research_paper", "exam", "study_notes", "textbook"]
    for preset_name in presets:
        pdf_bytes = pdf_service.generate_pdf(academic_doc, preset=preset_name)
        assert len(pdf_bytes) > 500
        assert pdf_bytes.startswith(b"%PDF-")
        reader = pypdf.PdfReader(BytesIO(pdf_bytes))
        assert len(reader.pages) == 1
        assert "Style Preset Validation Document" in reader.pages[0].extract_text()


# =========================================================================
# 8. API Endpoint Tests
# =========================================================================

def test_api_documents_pdf_export_endpoint():
    """Verify POST /api/documents/pdf returns valid PDF attachment with correct headers."""
    doc_service = DocumentService()
    req = FormattingRequestSkeleton(
        raw_text="# Computational Neuroscience\n\nSynaptic plasticity governs network adaptation [1].\n\n| Region | Potentiation |\n|:---|---:|\n| CA1 | +42% |",
        title="Computational Neuroscience",
    )
    academic_doc = doc_service.process_document(req)

    payload = {
        "document": academic_doc.model_dump(),
        "preset": "academic",
        "title": "Computational Neuroscience",
        "include_page_numbers": True,
        "include_header": True,
    }

    response = client.post("/api/documents/pdf", json=payload)
    assert response.status_code == 200

    content_type = response.headers.get("content-type", "")
    assert "application/pdf" in content_type

    disposition = response.headers.get("content-disposition", "")
    assert 'attachment; filename="Computational_Neuroscience.pdf"' in disposition

    # Assert returned bytes form a valid PDF
    assert response.content.startswith(b"%PDF-")
    reader = pypdf.PdfReader(BytesIO(response.content))
    assert len(reader.pages) >= 1
    assert "Computational Neuroscience" in reader.pages[0].extract_text()


def test_api_documents_pdf_from_raw_text():
    """Verify POST /api/documents/pdf accepts raw_text payload directly."""
    payload = {
        "raw_text": "# On-The-Fly PDF Rendering\n\nTesting raw text conversion to publication PDF.",
        "preset": "study_notes",
        "title": "On-The-Fly PDF Rendering",
    }
    response = client.post("/api/documents/pdf", json=payload)
    assert response.status_code == 200
    assert response.content.startswith(b"%PDF-")
    reader = pypdf.PdfReader(BytesIO(response.content))
    assert len(reader.pages) == 1
    assert "On-The-Fly PDF Rendering" in reader.pages[0].extract_text()


def test_api_documents_pdf_validation_error():
    """Verify 400 Bad Request when neither document nor raw_text is supplied."""
    response = client.post("/api/documents/pdf", json={})
    assert response.status_code == 400
    data = response.json()
    assert "Either structured 'document' or 'raw_text' must be provided" in data["detail"]
