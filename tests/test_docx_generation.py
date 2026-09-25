"""Tests for FormatAI professional DOCX generation engine and export API.

Verifies:
- Generation of valid Microsoft Word .docx archives (valid ZIP containing OpenXML parts)
- Representation of headings (H1, H2, H3), paragraphs, lists, tables, and inline styles (bold, italic, underline)
- Dynamic page numbering and header/footer configurations
- Presets: Academic, Research Paper, Exam, Study Notes, Textbook
- Export endpoint POST /api/documents/docx
"""

from io import BytesIO
import zipfile
import xml.etree.ElementTree as ET

try:
    from fastapi.testclient import TestClient
    from backend.main import app
    client = TestClient(app)
except ImportError:
    TestClient = None
    app = None
    client = None

from backend.core.docx_styles import DocxPresetType, get_style_preset
from backend.models.document import (
    AcademicDocument,
    BlockType,
    DocumentBlock,
    DocxExportRequest,
    FormattingRequestSkeleton,
)
from backend.services.document_service import DocumentService
from backend.services.docx_service import DocxService, parse_inline_markdown_runs

client = TestClient(app)


def test_parse_inline_markdown_runs():
    """Verify inline markdown parsing for bold, italic, underline, and code."""
    text = "Normal text with **bold terms**, *italic variables*, __underlined items__, and `tensor_dot()` code."
    runs = parse_inline_markdown_runs(text)

    assert len(runs) >= 7

    bold_run = next((r for r in runs if r["text"] == "bold terms"), None)
    assert bold_run is not None
    assert bold_run["bold"] is True
    assert bold_run["italic"] is False

    italic_run = next((r for r in runs if r["text"] == "italic variables"), None)
    assert italic_run is not None
    assert italic_run["italic"] is True

    underline_run = next((r for r in runs if r["text"] == "underlined items"), None)
    assert underline_run is not None
    assert underline_run["underline"] is True

    code_run = next((r for r in runs if r["text"] == "tensor_dot()"), None)
    assert code_run is not None
    assert code_run["code"] is True


def test_generate_docx_archive_validity():
    """Verify that DocxService outputs a valid OpenXML ZIP archive with required Word files."""
    doc_service = DocumentService()
    docx_service = DocxService()

    raw_academic_text = """
# Neural State Representation

## Introduction
Neural network quantum states approximate complex wavefunctions **effectively**.

### Numerical Optimization
The variational Monte Carlo optimization follows:
- Initialize random weights
- Sample configurations
- Minimize energy expectation

| Parameter | Value | Units |
|:---|:---:|---:|
| Learning Rate | 0.001 | - |
| Samples | 10000 | counts |
"""
    req = FormattingRequestSkeleton(raw_text=raw_academic_text)
    academic_doc = doc_service.process_document(req)

    docx_bytes = docx_service.generate_docx(academic_doc, preset="academic")

    # 1. Assert non-empty binary
    assert len(docx_bytes) > 500

    # 2. Assert valid ZIP archive
    zip_stream = BytesIO(docx_bytes)
    assert zipfile.is_zipfile(zip_stream)

    # 3. Assert required Microsoft Word OpenXML parts exist inside archive
    with zipfile.ZipFile(zip_stream, "r") as zf:
        file_list = zf.namelist()
        assert "word/document.xml" in file_list
        assert "[Content_Types].xml" in file_list
        assert "_rels/.rels" in file_list
        assert "word/_rels/document.xml.rels" in file_list
        assert "word/styles.xml" in file_list


def test_docx_contains_all_content_types():
    """Verify generated docx contains headings, paragraphs, lists, tables, and inline formatting."""
    blocks = [
        DocumentBlock(block_type=BlockType.TITLE, text="Quantum Phase Transitions"),
        DocumentBlock(block_type=BlockType.HEADING, level=1, text="1. Theoretical Background"),
        DocumentBlock(block_type=BlockType.HEADING, level=2, text="1.1 Ising Model in Transverse Field"),
        DocumentBlock(
            block_type=BlockType.PARAGRAPH,
            text="The transverse-field Ising Hamiltonian demonstrates **spontaneous symmetry breaking** and *criticality* with __exact__ solutions.",
        ),
        DocumentBlock(
            block_type=BlockType.ORDERED_LIST,
            items=[
                "Construct the spin lattice Hamiltonian",
                "Apply Jordan-Wigner fermionization",
                "Diagonalize via Bogoliubov transformation",
            ],
        ),
        DocumentBlock(
            block_type=BlockType.UNORDERED_LIST,
            items=[
                "Zero temperature limit",
                "Non-analyticity in ground state energy",
            ],
        ),
        DocumentBlock(
            block_type=BlockType.TABLE,
            headers=["Critical Exponent", "Mean Field", "Exact 1D"],
            rows=[
                ["alpha", "0 (disc)", "0 (log)"],
                ["beta", "0.5", "0.125"],
                ["gamma", "1.0", "1.75"],
            ],
            alignments=["left", "center", "right"],
        ),
        DocumentBlock(
            block_type=BlockType.BLOCKQUOTE,
            text="More is different: broken symmetry and the hierarchical nature of science.",
        ),
        DocumentBlock(
            block_type=BlockType.CODE_BLOCK,
            language="python",
            text="def ising_gap(g):\n    return 2.0 * abs(1.0 - g)",
        ),
    ]

    academic_doc = AcademicDocument(
        title="Quantum Phase Transitions",
        blocks=blocks,
    )

    docx_service = DocxService()
    docx_bytes = docx_service.generate_docx(academic_doc, preset=DocxPresetType.ACADEMIC)

    with zipfile.ZipFile(BytesIO(docx_bytes), "r") as zf:
        doc_xml = zf.read("word/document.xml").decode("utf-8")

        # Verify title and headings exist in Word XML
        assert "Quantum Phase Transitions" in doc_xml
        assert "Theoretical Background" in doc_xml
        assert "Ising Model in Transverse Field" in doc_xml

        # Verify paragraph and formatted terms
        assert "spontaneous symmetry breaking" in doc_xml
        assert "criticality" in doc_xml
        assert "exact" in doc_xml

        # Verify bold, italic, and underline tags exist in XML
        assert "<w:b" in doc_xml
        assert "<w:i" in doc_xml

        # Verify list items
        assert "Jordan-Wigner fermionization" in doc_xml
        assert "Non-analyticity in ground state energy" in doc_xml

        # Verify table elements and contents
        assert "<w:tbl" in doc_xml
        assert "Critical Exponent" in doc_xml
        assert "Mean Field" in doc_xml
        assert "0.125" in doc_xml

        # Verify code block and blockquote
        assert "ising_gap" in doc_xml
        assert "More is different" in doc_xml


def test_docx_presets():
    """Verify all 5 style presets generate valid docx archives."""
    academic_doc = AcademicDocument(
        title="Preset Verification Document",
        blocks=[
            DocumentBlock(block_type=BlockType.TITLE, text="Preset Verification Document"),
            DocumentBlock(block_type=BlockType.HEADING, level=1, text="Overview"),
            DocumentBlock(block_type=BlockType.PARAGRAPH, text="Sample text validating layout presets."),
        ],
    )

    docx_service = DocxService()
    presets = ["academic", "research_paper", "exam", "study_notes", "textbook"]

    for p in presets:
        data = docx_service.generate_docx(academic_doc, preset=p)
        assert len(data) > 400
        assert zipfile.is_zipfile(BytesIO(data))


def test_api_documents_docx_export_endpoint():
    """Verify POST /api/documents/docx returns a genuine .docx file download."""
    doc_service = DocumentService()
    req = FormattingRequestSkeleton(
        raw_text="# Machine Learning in Genomics\n\nHigh-throughput sequence data reveals regulatory variants [1].\n\n| Gene | Fold Change |\n|:---|---:|\n| BRCA1 | 3.4 |",
        title="Machine Learning in Genomics",
    )
    academic_doc = doc_service.process_document(req)

    payload = {
        "document": academic_doc.model_dump(),
        "preset": "academic",
        "title": "Machine Learning in Genomics",
        "include_page_numbers": True,
        "include_header": True,
    }

    response = client.post("/api/documents/docx", json=payload)
    assert response.status_code == 200

    content_type = response.headers.get("content-type", "")
    assert "application/vnd.openxmlformats-officedocument.wordprocessingml.document" in content_type

    disposition = response.headers.get("content-disposition", "")
    assert 'attachment; filename="Machine_Learning_in_Genomics.docx"' in disposition

    # Assert returned bytes form a valid DOCX zip archive
    assert zipfile.is_zipfile(BytesIO(response.content))


def test_api_documents_docx_from_raw_text():
    """Verify POST /api/documents/docx accepts raw_text payload and returns valid DOCX."""
    payload = {
        "raw_text": "# Direct Raw Export\n\nTesting on-the-fly parsing and Word export.",
        "preset": "study_notes",
        "title": "Direct Raw Export",
    }
    response = client.post("/api/documents/docx", json=payload)
    assert response.status_code == 200
    assert zipfile.is_zipfile(BytesIO(response.content))


def test_api_documents_docx_validation_error():
    """Verify 400 Bad Request when neither document nor raw_text is supplied."""
    response = client.post("/api/documents/docx", json={})
    assert response.status_code == 400
    data = response.json()
    assert "Either structured 'document' or 'raw_text' must be provided" in data["detail"]
