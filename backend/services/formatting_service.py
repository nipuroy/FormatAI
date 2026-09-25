"""Formatting Service.

Handles formatting cleanup and standard academic rules:
- Normalizes heading hierarchies (prevents unnatural level skips like H1 -> H4)
- Normalizes spacing and paragraph density
- Normalizes ordered/unordered list sequencing
- Applies standard academic typography (smart quotes, en/em dashes)
- Standardizes mathematical expressions (LaTeX delimiters and environments)
- Removes broken formatting artifacts (unmatched asterisks, corrupted tags)
"""

from typing import Any, Dict, List
from backend.utils.logger import get_logger
from backend.utils.text_processing import (
    fix_mathematical_representation,
    normalize_spacing,
    normalize_typography,
    remove_broken_formatting_artifacts,
)

logger = get_logger("formatting_service")


class FormattingService:
    """Applies standardized academic formatting rules to blocks and text."""

    def format_raw_text(self, text: str) -> str:
        """Apply pre-parsing text-level formatting normalizations."""
        out = normalize_spacing(text)
        out = fix_mathematical_representation(out)
        out = normalize_typography(out)
        out = remove_broken_formatting_artifacts(out)
        return out

    def fix_heading_hierarchy(self, blocks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Normalize heading levels to guarantee a coherent, step-by-step hierarchy.

        For example, jumping from an H1 directly to an H4 will be normalized to H1 -> H2.
        """
        current_level = 0

        for block in blocks:
            if block.get("block_type") == "heading":
                raw_level = block.get("level", 1)

                if current_level == 0:
                    # First heading in the document: establish base (usually level 1)
                    current_level = min(raw_level, 2)
                    block["level"] = current_level
                else:
                    # Enforce that next heading level does not jump by more than +1
                    if raw_level > current_level + 1:
                        raw_level = current_level + 1
                    current_level = raw_level
                    block["level"] = current_level

        return blocks

    def normalize_lists(self, blocks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Ensure lists have clean formatting, trimmed item entries, and consistent numbering."""
        for block in blocks:
            b_type = block.get("block_type")
            if b_type in ("ordered_list", "unordered_list"):
                items = block.get("items", [])
                cleaned_items = []
                for item in items:
                    item_text = normalize_typography(item.strip())
                    if item_text:
                        cleaned_items.append(item_text)
                block["items"] = cleaned_items

        return blocks

    def normalize_block_typography(self, blocks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Run typography normalization across block texts, excluding raw code blocks."""
        for block in blocks:
            b_type = block.get("block_type")

            if b_type in ("paragraph", "blockquote"):
                block["text"] = normalize_typography(block.get("text", ""))

            elif b_type == "table":
                # Normalize cell typography
                if block.get("headers"):
                    block["headers"] = [normalize_typography(h) for h in block["headers"]]
                if block.get("rows"):
                    block["rows"] = [
                        [normalize_typography(cell) for cell in row]
                        for row in block["rows"]
                    ]

            elif b_type == "code_block":
                # Preserved verbatim - do NOT apply smart quotes or dashes to code
                pass

        return blocks
