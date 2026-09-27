"""Statistics Skill."""

import re
from typing import Any, Dict, List
from backend.skills.base import BaseSkill, SkillContext, SkillRule, SkillValidationResult


class StatisticsSkill(BaseSkill):
    id = "statistics"
    name = "Statistics"
    description = "Detects and standardizes statistical notations, p-values, t-tests, ANOVA, and effect sizes."
    version = "1.0.0"
    category = "stem"
    priority = 32
    enabled = True

    rules = [
        SkillRule("p_value_reporting", "P-Value Reporting", "Corrects p = .000 to p < .001."),
        SkillRule("stat_tests", "Test Statistics Format", "Identifies t, F, and Chi-square statistics."),
    ]

    def validate(self, text: str, context: SkillContext) -> SkillValidationResult:
        warnings = []
        if re.search(r"p\s*=\s*0?\.000\b", text, flags=re.IGNORECASE):
            warnings.append("Found p = .000; recommended format is p < .001.")
        return SkillValidationResult(valid=True, warnings=warnings)

    def process_text(self, text: str, context: SkillContext) -> Dict[str, Any]:
        changes: List[str] = []
        updated = text

        if re.search(r"p\s*=\s*0?\.000\b", updated, flags=re.IGNORECASE):
            updated = re.sub(r"p\s*=\s*0?\.000\b", "p < .001", updated, flags=re.IGNORECASE)
            changes.append("Corrected p = .000 to p < .001 per APA guidelines.")
            context.detected_features.add("statistics")

        stats = re.findall(r"\b(?:p\s*[<>=]\s*\.?\d+|t\(\d+\)\s*=|F\(\d+,\s*\d+\)\s*=|M\s*=\s*\d+|SD\s*=\s*\d+)", updated)
        if stats:
            context.detected_features.add("statistics")
            changes.append(f"Identified {len(stats)} statistical expression(s).")

        return {"text": updated, "changes": changes}
