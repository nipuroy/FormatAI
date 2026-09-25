"""Reusable text and file processing utility functions."""

import re
from typing import Optional


def clean_text(text: str) -> str:
    """Normalize whitespace and strip unnecessary control characters."""
    if not text:
        return ""
    # Replace multiple empty lines with maximum 2
    cleaned = re.sub(r"\n{3,}", "\n\n", text)
    return cleaned.strip()


def estimate_word_count(text: str) -> int:
    """Estimate word count of a given text string."""
    if not text:
        return 0
    words = re.findall(r"\b\w+\b", text)
    return len(words)


def sanitize_filename(filename: Optional[str], default_name: str = "formatted_document") -> str:
    """Sanitize user-provided filename for safe filesystem export."""
    if not filename or not filename.strip():
        return default_name

    # Remove invalid characters
    sanitized = re.sub(r'[\\/*?:"<>|]', "", filename.strip())
    # Replace spaces with underscores
    sanitized = re.sub(r"\s+", "_", sanitized)
    return sanitized[:64] or default_name
