"""Study Notes Skill."""

import re
from typing import Any, Dict, List
from backend.skills.base import BaseSkill, SkillContext, SkillRule, SkillValidationResult


class StudyNotesSkill(BaseSkill):
    id = "study_notes"
    name = "Study Notes"
    description = "Formats key takeaway callouts, definition boxes, review summaries, and highlighted study concepts."
    version = "1.0.0"
    category = "pedagogy"
    priority = 65
    enabled = True

    rules = [
        SkillRule("key_takeaways", "Key Takeaway Callouts", "Identifies Key Concept and Summary markers."),
        SkillRule("definition_terms", "Definition Term Highlighting", "Structures Definition: term patterns."),
    ]

    def validate(self, text: str, context: SkillContext) -> SkillValidationResult:
        return SkillValidationResult(valid=True)

    def process_text(self, text: str, context: SkillContext) -> Dict[str, Any]:
        changes: List[str] = []
        callouts = re.findall(r"\b(?:Key\s+(?:Takeaway|Concept|Idea)|Note:|Summary:|Definition:)\b", text, flags=re.IGNORECASE)
        if callouts:
            context.detected_features.add("study_notes")
            changes.append(f"Detected {len(callouts)} study note callout anchor(s).")
        return {"text": text, "changes": changes}
