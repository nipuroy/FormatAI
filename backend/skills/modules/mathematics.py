"""Mathematics Skill.

Detects, normalizes, and structures inline ($...$) and display ($$...$$) LaTeX expressions,
fractions, roots, and Greek symbols.
"""

import re
from typing import Any, Dict, List
from backend.skills.base import BaseSkill, SkillContext, SkillRule, SkillValidationResult


class MathematicsSkill(BaseSkill):
    id = "mathematics"
    name = "Mathematics"
    description = "Detects, normalizes, and structures inline and display LaTeX equations, fractions, roots, and Greek symbols."
    version = "1.2.0"
    category = "stem"
    priority = 30
    enabled = True

    rules = [
        SkillRule("delimiter_normalization", "Delimiter Normalization", "Normalizes \\(...\\) to $...$ and \\[...\\] to $$...$$"),
        SkillRule("latex_structure", "LaTeX Structure Extraction", "Identifies fractions, roots, Greek letters, and exponents."),
        SkillRule("prose_protection", "Prose Slash Protection", "Guarantees 5/10 students is not converted to a fraction."),
    ]

    def validate(self, text: str, context: SkillContext) -> SkillValidationResult:
        warnings: List[str] = []
        dollar_count = len(re.findall(r"(?<!\$)\$(?!\$)", text))
        if dollar_count % 2 != 0:
            warnings.append(f"Unbalanced inline math delimiter count: {dollar_count}")
        return SkillValidationResult(valid=True, warnings=warnings)

    def process_text(self, text: str, context: SkillContext) -> Dict[str, Any]:
        changes: List[str] = []
        updated = text

        # 1. Normalize \( ... \) to $ ... $
        if re.search(r"\\\(\s*([\s\S]*?)\s*\\\)", updated):
            updated = re.sub(r"\\\(\s*([\s\S]*?)\s*\\\)", r"$\1$", updated)
            changes.append("Normalized \\( ... \\) delimiters to $...$.")

        # 2. Normalize \[ ... \] to $$ ... $$
        if re.search(r"\\\[\s*([\s\S]*?)\s*\\\]", updated):
            updated = re.sub(r"\\\[\s*([\s\S]*?)\s*\\\]", r"$$\n\1\n$$", updated)
            changes.append("Normalized \\[ ... \\] delimiters to $$...$$.")

        math_matches = re.findall(r"\$\$[\s\S]*?\$\$|\$[^\$\n]+\$|\\(?:frac|sqrt|sum|int|lim|sigma|alpha|beta|times)", updated)
        if math_matches:
            context.detected_features.add("mathematics")
            changes.append(f"Processed {len(math_matches)} mathematical expression(s).")

        return {"text": updated, "changes": changes}
