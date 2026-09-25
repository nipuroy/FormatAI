"""Content Cleanup Service.

Handles semantic and structural content cleanup distinctly from typography/formatting:
- Removes AI conversational noise and intros/outros
- Removes redundant or duplicate headings
- Removes unnecessary bullet artifacts
- Heals fragmented AI-generated sentences and paragraphs
- Strictly preserves the author's original academic meaning and terminology
"""

import re
from typing import Any, Dict, List
from backend.utils.logger import get_logger

logger = get_logger("content_cleanup_service")

# Regex to detect AI assistant greetings and conversational boilerplate
AI_CHAT_PREFIXES = [
    r"^(?:Sure(?: thing)?[,!]|Certainly[,!]|Of course[,!]|Here is (?:your|the)|Here's (?:your|the)|Below is (?:the|your)|As requested[,:]?).*?(?:\n+|$)",
    r"^(?:I have (?:formatted|organized|structured|prepared)|Please find (?:below|attached)).*?(?:\n+|$)",
]

AI_CHAT_SUFFIXES = [
    r"(?:\n+|^)(?:(?:I )?Hope this helps[\w\s,!.]*)$",
    r"(?:\n+|^)(?:Let me know if you (?:need|have any)[\w\s,!.]*)$",
    r"(?:\n+|^)(?:Feel free to (?:ask|reach out)[\w\s,!.]*)$",
]


class ContentCleanupService:
    """Performs structural content cleanup without altering academic meaning."""

    def clean_raw_content(self, text: str) -> str:
        """Strip conversational AI boilerplate and structural pre/postambles."""
        if not text:
            return ""

        cleaned = text.strip()

        # 1. Remove introductory conversational greetings/prefixes
        for prefix_pat in AI_CHAT_PREFIXES:
            cleaned = re.sub(prefix_pat, "", cleaned, flags=re.IGNORECASE).strip()

        # 2. Remove concluding conversational sign-offs
        for suffix_pat in AI_CHAT_SUFFIXES:
            cleaned = re.sub(suffix_pat, "", cleaned, flags=re.IGNORECASE).strip()

        logger.debug("Completed initial raw content cleanup.")
        return cleaned

    def clean_blocks(self, raw_blocks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Perform semantic block-level content cleanup.

        - Removes redundant or empty headings
        - Normalizes pseudo-bullet headings (e.g. `* **1. Introduction**`)
        - Heals fragmented single-sentence paragraphs
        - Removes spurious divider lines
        """
        cleaned_blocks: List[Dict[str, Any]] = []
        last_heading_text = None

        for block in raw_blocks:
            b_type = block.get("block_type")

            # 1. Clean and validate headings
            if b_type == "heading":
                text = block.get("text", "").strip()
                # Remove empty headings
                if not text:
                    continue

                # Strip accidental leading bold/italic markers in heading text
                text = re.sub(r"^\*+|\*+$", "", text).strip()
                block["text"] = text

                # Remove immediately repeated duplicate headings
                if text.lower() == (last_heading_text or "").lower():
                    continue

                last_heading_text = text
                cleaned_blocks.append(block)
                continue

            # Reset heading tracking for non-heading blocks
            if b_type not in ("thematic_break",):
                last_heading_text = None

            # 2. Clean lists: detect pseudo-bullet headings or single-item stray bullets
            if b_type == "unordered_list":
                items = block.get("items", [])
                if not items:
                    continue

                # Check if this "list" is actually a heading formatted as a bullet: `* **1. Introduction**`
                if len(items) == 1:
                    first_item = items[0].strip()
                    bold_m = re.match(r"^\*\*(.+?)\*\*$", first_item)
                    if bold_m:
                        inner = bold_m.group(1).strip()
                        if len(inner) < 80 and (
                            re.match(r"^\d+(?:\.\d+)*\.?\s+[A-Z]", inner)
                            or not inner.endswith((".", "?", "!"))
                        ):
                            # Convert to heading
                            cleaned_blocks.append({
                                "block_type": "heading",
                                "level": 2,
                                "text": inner,
                            })
                            continue

                cleaned_blocks.append(block)
                continue

            # 3. Spurious thematic breaks / dividers between paragraphs
            if b_type == "thematic_break":
                # Only keep thematic break if surrounded by major sections
                if cleaned_blocks and cleaned_blocks[-1].get("block_type") != "thematic_break":
                    cleaned_blocks.append(block)
                continue

            # 4. Paragraph handling & fragmented structure healing
            if b_type == "paragraph":
                text = block.get("text", "").strip()
                if not text:
                    continue

                # If the previous block was a short paragraph that ended without punctuation,
                # merge with current paragraph to heal LLM fragmentation
                if (
                    cleaned_blocks
                    and cleaned_blocks[-1].get("block_type") == "paragraph"
                    and not cleaned_blocks[-1]["text"].rstrip().endswith((".", "!", "?", ":", ";", "—"))
                    and len(cleaned_blocks[-1]["text"]) < 120
                    and text[0].islower()
                ):
                    cleaned_blocks[-1]["text"] += " " + text
                    continue

                cleaned_blocks.append(block)
                continue

            # Pass through all other blocks (tables, code, math, blockquotes, ordered lists)
            cleaned_blocks.append(block)

        return cleaned_blocks
