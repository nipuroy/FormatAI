"""Document processing and professional DOCX export routes."""

from fastapi import APIRouter, Depends, HTTPException, Response, status
from backend.models.document import (
    AcademicDocument,
    DocumentProcessResponse,
    DocxExportRequest,
    PdfExportRequest,
    FormattingRequestSkeleton,
)
from backend.services.document_service import DocumentService
from backend.services.docx_service import DocxService
from backend.services.pdf_service import PdfService
from backend.utils.formatting import sanitize_filename
from backend.utils.logger import get_logger

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
