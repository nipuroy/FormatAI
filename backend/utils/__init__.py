"""Reusable utility helpers for text parsing, logging, and validation."""

from .formatting import clean_text, sanitize_filename, estimate_word_count
from .logger import get_logger
from .markdown import parse_raw_into_blocks
from .text_processing import (
    detect_math_expressions,
    detect_scientific_notation,
    detect_chemical_formulas,
    detect_citations,
    normalize_spacing,
    normalize_typography,
    fix_mathematical_representation,
    remove_broken_formatting_artifacts,
)

__all__ = [
    "clean_text",
    "sanitize_filename",
    "estimate_word_count",
    "get_logger",
    "parse_raw_into_blocks",
    "detect_math_expressions",
    "detect_scientific_notation",
    "detect_chemical_formulas",
    "detect_citations",
    "normalize_spacing",
    "normalize_typography",
    "fix_mathematical_representation",
    "remove_broken_formatting_artifacts",
]
