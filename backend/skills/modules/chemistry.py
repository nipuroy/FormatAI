"""Chemistry Skill."""

import re
from typing import Any, Dict, List
from backend.skills.base import BaseSkill, SkillContext, SkillRule, SkillValidationResult

COMMON_FORMULAS = {
    "H2O": "H₂O",
    "CO2": "CO₂",
    "O2": "O₂",
    "N2": "N₂",
    "CH4": "CH₄",
    "NH3": "NH₃",
    "H2SO4": "H₂SO₄",
    "C6H12O6": "C₆H₁₂O₆",
    "NaCl": "NaCl",
}


class ChemistrySkill(BaseSkill):
    id = "chemistry"
    name = "Chemistry"
    description = "Normalizes chemical molecular formulas (H2O -> H₂O, CO2 -> CO₂) and reaction arrows."
    version = "1.0.0"
    category = "stem"
    priority = 34
    enabled = True

    rules = [
        SkillRule("formula_subscript", "Chemical Subscripts", "Subscripts numbers in common chemical formulas."),
        SkillRule("reaction_arrows", "Reaction Arrows", "Converts ASCII -> to chemical reaction arrow →."),
    ]

    def validate(self, text: str, context: SkillContext) -> SkillValidationResult:
        return SkillValidationResult(valid=True)

    def process_text(self, text: str, context: SkillContext) -> Dict[str, Any]:
        changes: List[str] = []
        updated = text

        for plain, sub in COMMON_FORMULAS.items():
            pattern = rf"\b{plain}\b"
            if re.search(pattern, updated):
                updated = re.sub(pattern, sub, updated)
                changes.append(f"Subscripted formula {plain} to {sub}.")
                context.detected_features.add("chemistry")

        if re.search(r"\s+->\s+", updated):
            updated = re.sub(r"\s+->\s+", " → ", updated)
            changes.append("Normalized reaction arrow -> to →.")
            context.detected_features.add("chemistry")

        return {"text": updated, "changes": changes}
