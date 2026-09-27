"""Academic Formatting Skill."""

import re
from typing import Any, Dict, List
from backend.skills.base import BaseSkill, SkillContext, SkillRule, SkillValidationResult


class AcademicFormattingSkill(BaseSkill):
    id = "academic_formatting"
    name = "Academic Formatting"
    description = "Standardizes heading hierarchies, abstract blocks, paragraph typography, and academic structure."
    version = "1.0.0"
    category = "formatting"
    priority = 40
    enabled = True

    rules = [
        SkillRule("heading_spacing", "Heading Syntax Normalization", "Normalizes heading markdown spacing."),
        SkillRule("title_extraction", "Title Hierarchy", "Extracts academic title if not explicitly provided."),
        SkillRule("abstract_isolation", "Abstract Formatting", "Identifies abstract blocks."),
    ]

    def validate(self, text: str, context: SkillContext) -> SkillValidationResult:
        if not text or not text.strip():
            return SkillValidationResult(valid=False, errors=["Content cannot be empty."])
        return SkillValidationResult(valid=True)

    def process_text(self, text: str, context: SkillContext) -> Dict[str, Any]:
        changes: List[str] = []
        updated = text

        # Standardize heading hashes
        fixed_headings = re.sub(r"^(#{1,6})([^\s#])", r"\1 \2", updated, flags=re.MULTILINE)
        if fixed_headings != updated:
            updated = fixed_headings
            changes.append("Normalized spacing following heading hashes.")

        title_m = re.search(r"^#\s+(.+)$", updated, flags=re.MULTILINE)
        if title_m and not context.title:
            context.title = title_m.group(1).strip()
            changes.append(f"Extracted academic title: '{context.title}'.")

        return {"text": updated, "changes": changes}
