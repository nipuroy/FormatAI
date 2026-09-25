"""Document processing and professional DOCX export routes."""

from fastapi import APIRouter, Depends, HTTPException, Response, status
from backend.models.document import (
    AcademicDocument,
    DocumentProcessResponse,
    DocxExportRequest,
    PdfExportRequest,
    FormattingRequestSkeleton,
    ContentAnalysisRequest,
    ContentAnalysisResponse,
    ContentCleanRequest,
    ContentCleanResponse,
)
from backend.services.document_service import DocumentService
from backend.services.docx_service import DocxService
from backend.services.pdf_service import PdfService
from backend.services.content_cleanup_service import (
    ContentCleanupService,
    AI_CHAT_PREFIXES,
    AI_CHAT_SUFFIXES,
)
from backend.utils.formatting import sanitize_filename, estimate_word_count
from backend.utils.text_processing import (
    detect_citations,
    detect_math_expressions,
    detect_chemical_formulas,
    detect_scientific_notation,
)
from backend.utils.logger import get_logger
import re

router = APIRouter(tags=["Document Processing & Export"])
logger = get_logger("document_route")

DOCX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
PDF_MIME_TYPE = "application/pdf"


def get_document_service() -> DocumentService:
    """Dependency injector providing DocumentService instance."""
    return DocumentService()


def get_docx_service() -> DocxService:
    """Dependency injector providing DocxService instance."""
    return DocxService()


def get_pdf_service() -> PdfService:
    """Dependency injector providing PdfService instance."""
    return PdfService()


def get_cleanup_service() -> ContentCleanupService:
    """Dependency injector providing ContentCleanupService instance."""
    return ContentCleanupService()


@router.post(
    "/analyze",
    response_model=ContentAnalysisResponse,
    summary="Analyze unformatted text structure, citations, formulas, and conversational noise",
)
def analyze_document(request: ContentAnalysisRequest) -> ContentAnalysisResponse:
    """Examines raw text and returns comprehensive academic metrics and structural insights."""
    text = request.raw_text or ""
    words = estimate_word_count(text)
    chars = len(text)
    lines = len(text.splitlines())
    read_time = round(words / 220.0, 1)

    citations = detect_citations(text)
    math_exprs = detect_math_expressions(text)
    chemicals = detect_chemical_formulas(text)
    scientific = detect_scientific_notation(text)

    # Count Markdown headings (#, ##, ###, etc.)
    heading_count = len(re.findall(r"(?m)^#{1,6}\s+.+$", text))

    has_prefix = any(re.search(pat, text, flags=re.IGNORECASE) for pat in AI_CHAT_PREFIXES)
    has_suffix = any(re.search(pat, text, flags=re.IGNORECASE) for pat in AI_CHAT_SUFFIXES)
    has_chatter = has_prefix or has_suffix

    summary_parts = [
        f"{words} words across {lines} lines (~{read_time} min read)",
        f"{heading_count} structural headings",
    ]
    if math_exprs:
        summary_parts.append(f"{len(math_exprs)} mathematical expressions")
    if citations:
        summary_parts.append(f"{len(citations)} citations")
    if chemicals:
        summary_parts.append(f"{len(chemicals)} chemical formulas")
    if has_chatter:
        summary_parts.append("conversational AI artifacts detected")

    return ContentAnalysisResponse(
        success=True,
        word_count=words,
        char_count=chars,
        line_count=lines,
        estimated_read_time_minutes=read_time,
        detected_citations_count=len(citations),
        detected_math_count=len(math_exprs),
        detected_chemicals_count=len(chemicals),
        detected_scientific_count=len(scientific),
        heading_count=heading_count,
        has_ai_conversational_chatter=has_chatter,
        summary="; ".join(summary_parts),
    )


@router.post(
    "/clean",
    response_model=ContentCleanResponse,
    summary="Clean conversational AI preambles, signoffs, and formatting artifacts",
)
def clean_document(
    request: ContentCleanRequest,
    cleanup_service: ContentCleanupService = Depends(get_cleanup_service),
) -> ContentCleanResponse:
    """Strips conversational noise while strictly preserving academic content."""
    original_text = request.raw_text or ""
    cleaned = cleanup_service.clean_raw_content(original_text)

    changes: List[str] = []
    if len(cleaned) < len(original_text):
        diff = len(original_text) - len(cleaned)
        changes.append(f"Removed {diff} characters of conversational intros/outros")
    else:
        changes.append("No conversational intros/outros detected; text is clean")

    return ContentCleanResponse(
        success=True,
        cleaned_text=cleaned,
        original_char_count=len(original_text),
        cleaned_char_count=len(cleaned),
        artifacts_removed=max(0, len(original_text) - len(cleaned)),
        changes_applied=changes,
        message="Content successfully sanitized of conversational artifacts.",
    )


@router.post(
    "/process",
    response_model=DocumentProcessResponse,
    summary="Process raw document through academic pipeline",
)
def process_document(
    request: FormattingRequestSkeleton,
    service: DocumentService = Depends(get_document_service),
) -> DocumentProcessResponse:
    """Executes the complete multi-stage academic document pipeline:

    Raw Input -> Content Analysis -> Content Cleanup -> Structure Detection
    -> Formatting Rules -> Document Model -> Export
    """
    try:
        academic_doc = service.process_document(request)
        return DocumentProcessResponse(
            success=True,
            document=academic_doc,
            message="Document successfully processed and structured.",
        )
    except ValueError as ve:
        logger.warning(f"Document validation error: {str(ve)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ve),
        )
    except Exception as exc:
        logger.error(f"Error processing document: {str(exc)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process document through academic pipeline.",
        )


@router.post(
    "/docx",
    summary="Export structured document to genuine Microsoft Word (.docx) file",
    responses={
        200: {
            "content": {DOCX_MIME_TYPE: {}},
            "description": "Valid Microsoft Word DOCX binary file attachment",
        },
        400: {"description": "Invalid document or payload structure"},
    },
)
def export_docx(
    request: DocxExportRequest,
    doc_service: DocumentService = Depends(get_document_service),
    docx_service: DocxService = Depends(get_docx_service),
) -> Response:
    """Converts either a structured AcademicDocument or raw text into a valid,

    editable Microsoft Word .docx file using professional typography and presets.
    """
    try:
        # Resolve target document model
        if request.document:
            academic_doc = request.document
        elif request.raw_text:
            academic_doc = doc_service.process_document(
                FormattingRequestSkeleton(
                    raw_text=request.raw_text,
                    title=request.title,
                    citation_style=request.citation_style or "apa",
                )
            )
        else:
            raise ValueError("Either structured 'document' or 'raw_text' must be provided in request payload.")

        # Generate genuine DOCX binary archive
        docx_bytes = docx_service.generate_docx(
            document=academic_doc,
            preset=request.preset,
            title_override=request.title,
            include_page_numbers=request.include_page_numbers,
            include_header=request.include_header,
        )

        raw_title = request.title or academic_doc.title or "academic_document"
        clean_name = sanitize_filename(raw_title)
        filename = f"{clean_name}.docx"

        logger.info(f"Returning DOCX file attachment: '{filename}' ({len(docx_bytes)} bytes)")

        return Response(
            content=docx_bytes,
            media_type=DOCX_MIME_TYPE,
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Content-Type": DOCX_MIME_TYPE,
                "Content-Length": str(len(docx_bytes)),
            },
        )
    except ValueError as ve:
        logger.warning(f"DOCX export validation error: {str(ve)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ve),
        )
    except Exception as exc:
        logger.error(f"Failed to generate DOCX file: {str(exc)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate DOCX document: {str(exc)}",
        )


@router.post(
    "/pdf",
    summary="Export structured document to genuine publication-grade PDF file",
    responses={
        200: {
            "content": {PDF_MIME_TYPE: {}},
            "description": "Valid PDF binary file attachment",
        },
        400: {"description": "Invalid document or payload structure"},
    },
)
def export_pdf(
    request: PdfExportRequest,
    doc_service: DocumentService = Depends(get_document_service),
    pdf_service: PdfService = Depends(get_pdf_service),
) -> Response:
    """Converts either a structured AcademicDocument or raw text into a publication-grade,

    standalone PDF file using professional typography, exact margins, and layout presets.
    """
    try:
        # Resolve target document model
        if request.document:
            academic_doc = request.document
        elif request.raw_text:
            academic_doc = doc_service.process_document(
                FormattingRequestSkeleton(
                    raw_text=request.raw_text,
                    title=request.title,
                    citation_style=request.citation_style or "apa",
                )
            )
        else:
            raise ValueError("Either structured 'document' or 'raw_text' must be provided in request payload.")

        # Generate genuine PDF binary
        pdf_bytes = pdf_service.generate_pdf(
            document=academic_doc,
            preset=request.preset,
            title_override=request.title,
            include_page_numbers=request.include_page_numbers,
            include_header=request.include_header,
        )

        raw_title = request.title or academic_doc.title or "academic_document"
        clean_name = sanitize_filename(raw_title)
        filename = f"{clean_name}.pdf"

        logger.info(f"Returning PDF file attachment: '{filename}' ({len(pdf_bytes)} bytes)")

        return Response(
            content=pdf_bytes,
            media_type=PDF_MIME_TYPE,
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Content-Type": PDF_MIME_TYPE,
                "Content-Length": str(len(pdf_bytes)),
            },
        )
    except ValueError as ve:
        logger.warning(f"PDF export validation error: {str(ve)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ve),
        )
    except Exception as exc:
        logger.error(f"Failed to generate PDF file: {str(exc)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate PDF document: {str(exc)}",
        )
