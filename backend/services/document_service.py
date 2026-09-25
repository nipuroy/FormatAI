"""Document Processing Pipeline Service.

Executes the end-to-end academic document pipeline:
Raw Input
  → Content Analysis
  → Content Cleanup
  → Structure Detection
  → Formatting Rules
  → Document Model
  → Export (Internal Structured AST)
"""

import re
import uuid
from typing import Any, Dict, List, Optional
from backend.core.config import get_settings
from backend.models.document import (
    AcademicDocument,
    BlockType,
    CitationStyle,
    DocumentBlock,
    DocumentFormat,
    DocumentStatistics,
    FormattingRequestSkeleton,
)
from backend.services.content_cleanup_service import ContentCleanupService
from backend.services.formatting_service import FormattingService
from backend.utils.formatting import estimate_word_count, sanitize_filename
from backend.utils.logger import get_logger
from backend.utils.markdown import parse_raw_into_blocks
from backend.utils.text_processing import (
    detect_chemical_formulas,
    detect_citations,
    detect_math_expressions,
    detect_scientific_notation,
)

logger = get_logger("document_service")


class DocumentService:
    """Orchestrates the multi-stage academic document processing pipeline."""

    def __init__(
        self,
        content_cleanup_service: Optional[ContentCleanupService] = None,
        formatting_service: Optional[FormattingService] = None,
    ):
        self.settings = get_settings()
        self.content_cleanup = content_cleanup_service or ContentCleanupService()
        self.formatting = formatting_service or FormattingService()

    def process_document(self, request: FormattingRequestSkeleton) -> AcademicDocument:
        """Execute the complete multi-stage pipeline on raw academic text.

        Stages:
        1. raw_input
        2. content_analysis
        3. content_cleanup
        4. structure_detection
        5. formatting_rules
        6. document_model
        7. export
        """
        raw_text = request.raw_text
        doc_id = str(uuid.uuid4())
        logger.info(f"Starting document pipeline for doc_id='{doc_id}' (chars={len(raw_text)})")

        # -------------------------------------------------------------
        # Stage 1: Raw Input Validation
        # -------------------------------------------------------------
        if not raw_text or not raw_text.strip():
            raise ValueError("Document input cannot be empty.")

        # -------------------------------------------------------------
        # Stage 2: Content Analysis (Initial Pre-scan)
        # -------------------------------------------------------------
        initial_citations = detect_citations(raw_text)
        initial_math = detect_math_expressions(raw_text)
        initial_chemicals = detect_chemical_formulas(raw_text)
        initial_sci = detect_scientific_notation(raw_text)

        logger.debug(
            f"Pre-scan detected {len(initial_citations)} citations, {len(initial_math)} math exprs, "
            f"{len(initial_chemicals)} chemical formulas, {len(initial_sci)} scientific notations."
        )

        # -------------------------------------------------------------
        # Stage 3: Content Cleanup (Semantic cleanup, removing AI chatter)
        # -------------------------------------------------------------
        clean_text = self.content_cleanup.clean_raw_content(raw_text)

        # -------------------------------------------------------------
        # Stage 4: Structure Detection (Parsing into initial AST blocks)
        # -------------------------------------------------------------
        formatted_text = self.formatting.format_raw_text(clean_text)
        raw_blocks = parse_raw_into_blocks(formatted_text)

        # Apply block-level content cleanup (remove duplicate headings, pseudo-bullets, etc.)
        semantically_cleaned_blocks = self.content_cleanup.clean_blocks(raw_blocks)

        # -------------------------------------------------------------
        # Stage 5: Formatting Rules (Hierarchy, list numbering, typography)
        # -------------------------------------------------------------
        hierarchy_fixed_blocks = self.formatting.fix_heading_hierarchy(semantically_cleaned_blocks)
        normalized_list_blocks = self.formatting.normalize_lists(hierarchy_fixed_blocks)
        final_block_dicts = self.formatting.normalize_block_typography(normalized_list_blocks)

        # -------------------------------------------------------------
        # Stage 6: Document Model Construction
        # -------------------------------------------------------------
        document_blocks: List[DocumentBlock] = []
        document_title = request.title
        abstract_text: Optional[str] = None
        references_list: List[str] = []
        in_references_section = False
        all_citations: List[str] = []

        for b_dict in final_block_dicts:
            b_type_str = b_dict.get("block_type", "paragraph")
            b_text = b_dict.get("text", "")

            # Check if this block is a References / Bibliography heading
            if b_type_str == "heading" and re.match(r"^(?:References|Bibliography|Works Cited)\b", b_text, re.IGNORECASE):
                in_references_section = True

            # Extract Document Title from first H1 if not explicitly provided
            if not document_title and b_type_str == "heading" and b_dict.get("level") == 1:
                document_title = b_text
                # Convert the first H1 into a TITLE block
                b_type_str = "title"

            # Check for Abstract section
            if b_type_str == "heading" and re.match(r"^Abstract\b", b_text, re.IGNORECASE):
                # Next paragraph will be marked as abstract
                abstract_text = ""

            # Detect inline academic entities within this block
            block_citations = [c["raw"] for c in detect_citations(b_text)] if b_text else []
            block_chemicals = detect_chemical_formulas(b_text) if b_text else []
            block_sci = detect_scientific_notation(b_text) if b_text else []

            all_citations.extend(block_citations)

            # Accumulate references if inside references section
            if in_references_section and b_type_str != "heading":
                if b_type_str in ("ordered_list", "unordered_list"):
                    for item in b_dict.get("items", []):
                        references_list.append(item)
                elif b_type_str == "paragraph":
                    references_list.append(b_text)

            # Build typed DocumentBlock
            doc_block = DocumentBlock(
                id=str(uuid.uuid4())[:8],
                block_type=BlockType(b_type_str),
                text=b_text,
                level=b_dict.get("level"),
                items=b_dict.get("items"),
                headers=b_dict.get("headers"),
                rows=b_dict.get("rows"),
                alignments=b_dict.get("alignments"),
                language=b_dict.get("language"),
                math_type=b_dict.get("math_type"),
                caption=b_dict.get("caption"),
                citations=block_citations,
                scientific_notations=block_sci,
                chemical_formulas=block_chemicals,
                metadata=b_dict.get("metadata", {}),
            )
            document_blocks.append(doc_block)

        # Deduplicate citations while preserving order
        unique_citations = list(dict.fromkeys(all_citations))

        # Calculate document statistics
        stats = self._calculate_statistics(document_blocks, references_list, unique_citations)

        # -------------------------------------------------------------
        # Stage 7: Export (Packaging into internal structured representation)
        # -------------------------------------------------------------
        academic_doc = AcademicDocument(
            id=doc_id,
            title=document_title or "Untitled Academic Document",
            abstract=abstract_text,
            citation_style=request.citation_style,
            export_format=request.export_format,
            blocks=document_blocks,
            citations=unique_citations,
            references=references_list,
            statistics=stats,
            metadata={
                "clean_filename": sanitize_filename(document_title),
                "has_tables": stats.table_count > 0,
                "has_math": stats.math_block_count > 0,
                "has_references": len(references_list) > 0,
            },
        )

        logger.info(
            f"Successfully processed document: title='{academic_doc.title}', "
            f"blocks={len(academic_doc.blocks)}, words={stats.word_count}"
        )
        return academic_doc

    def _calculate_statistics(
        self,
        blocks: List[DocumentBlock],
        references: List[str],
        citations: List[str],
    ) -> DocumentStatistics:
        """Compute metrics and quantitative summary across all blocks."""
        total_words = 0
        total_chars = 0
        headings = 0
        paragraphs = 0
        tables = 0
        math_blocks = 0
        code_blocks = 0
        lists = 0

        for b in blocks:
            text = b.text
            if b.items:
                text += " " + " ".join(b.items)
            if b.rows:
                for r in b.rows:
                    text += " " + " ".join(r)

            total_words += estimate_word_count(text)
            total_chars += len(text)

            if b.block_type in (BlockType.HEADING, BlockType.TITLE):
                headings += 1
            elif b.block_type == BlockType.PARAGRAPH:
                paragraphs += 1
            elif b.block_type == BlockType.TABLE:
                tables += 1
            elif b.block_type == BlockType.MATH_BLOCK:
                math_blocks += 1
            elif b.block_type == BlockType.CODE_BLOCK:
                code_blocks += 1
            elif b.block_type in (BlockType.ORDERED_LIST, BlockType.UNORDERED_LIST):
                lists += 1

        return DocumentStatistics(
            word_count=total_words,
            character_count=total_chars,
            heading_count=headings,
            paragraph_count=paragraphs,
            table_count=tables,
            math_block_count=math_blocks,
            code_block_count=code_blocks,
            list_count=lists,
            citation_count=len(citations),
            reference_count=len(references),
        )
