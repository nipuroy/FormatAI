"""Document processing pipeline routes."""

from fastapi import APIRouter, Depends, HTTPException, status
from backend.models.document import (
    DocumentProcessResponse,
    FormattingRequestSkeleton,
)
from backend.services.document_service import DocumentService
from backend.utils.logger import get_logger

router = APIRouter(prefix="/document", tags=["Document Processing"])
logger = get_logger("document_route")


def get_document_service() -> DocumentService:
    """Dependency injector providing DocumentService instance."""
    return DocumentService()


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
