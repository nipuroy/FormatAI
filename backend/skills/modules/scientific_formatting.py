"""Scientific Document Formatting Skill."""

import re
from typing import Any, Dict, List
from backend.skills.base import BaseSkill, SkillContext, SkillRule, SkillValidationResult


class ScientificFormattingSkill(BaseSkill):
    id = "scientific_formatting"
    name = "Scientific Document Formatting"
    description = "Standardizes scientific exponential notation (1.42 × 10^-22), SI units (kg·m/s, m/s²), and degree symbols."
    version = "1.0.0"
    category = "stem"
    priority = 36
    enabled = True

    rules = [
        SkillRule("scientific_notation", "Exponential Notation", "Standardizes informal 1.42 x 10^-22 to 1.42 × 10^{-22}."),
        SkillRule("si_units", "SI Units Standardization", "Normalizes composite SI units (kg·m/s, m/s^2, kJ/mol)."),
        SkillRule("temperature_units", "Degree Symbol Normalization", "Converts deg C to °C."),
    ]

    def validate(self, text: str, context: SkillContext) -> SkillValidationResult:
        return SkillValidationResult(valid=True)

    def process_text(self, text: str, context: SkillContext) -> Dict[str, Any]:
        changes: List[str] = []
        updated = text

        sci_pat = r"(\d+(?:\.\d+)?)\s*[xX*]\s*10\^?([+-]?\d+)"
        if re.search(sci_pat, updated):
            updated = re.sub(sci_pat, r"\1 × 10^{\2}", updated)
            changes.append("Normalized exponential scientific notation to '× 10^{n}'.")
            context.detected_features.add("scientific_notation")

        deg_pat = r"(\d+(?:\.\d+)?)\s*(?:deg\s*C|degrees\s*Celsius)\b"
        if re.search(deg_pat, updated, flags=re.IGNORECASE):
            updated = re.sub(deg_pat, r"\1 °C", updated, flags=re.IGNORECASE)
            changes.append("Normalized temperature degree symbols to °C.")
            context.detected_features.add("scientific_units")

        return {"text": updated, "changes": changes}
