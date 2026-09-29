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
    """Sanitize user-provided filename for safe filesystem export and HTTP header safety.
    
    Guarantees:
    - No path traversal characters (no '..', '/', '\\')
    - No control characters, null bytes, or CRLF (prevents HTTP header injection)
    - No unescaped quotes or semicolons (prevents Content-Disposition tampering)
    - Strictly limits character set to safe alphanumeric, underscores, and hyphens
    """
    if not filename or not filename.strip():
        return default_name

    # 1. Strip control characters, CRLF, and null bytes
    sanitized = re.sub(r"[\x00-\x1f\x7f\r\n]", "", filename.strip())
    # 2. Remove directory traversal sequences and slashes
    sanitized = sanitized.replace("..", "").replace("/", "").replace("\\", "")
    # 3. Remove quotes, semicolons, and dangerous header punctuation
    sanitized = re.sub(r'[\'"`:;*?<>|]', "", sanitized)
    # 4. Replace whitespace and commas with underscores
    sanitized = re.sub(r"[\s,]+", "_", sanitized)
    # 5. Allow only safe characters: letters, numbers, hyphens, and underscores
    sanitized = re.sub(r"[^a-zA-Z0-9_-]", "", sanitized)
    # 6. Trim leading/trailing dots and hyphens
    sanitized = sanitized.strip(".-_")
    
    return sanitized[:64] or default_name
