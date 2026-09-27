"""Exam Questions Skill."""

import re
from typing import Any, Dict, List
from backend.skills.base import BaseSkill, SkillContext, SkillRule, SkillValidationResult


class ExamQuestionsSkill(BaseSkill):
    id = "exam_questions"
    name = "Exam Questions"
    description = "Detects question stems, point allocations, multiple-choice options, and fill-in-the-blank blanks."
    version = "1.0.0"
    category = "pedagogy"
    priority = 60
    enabled = True

    rules = [
        SkillRule("question_stems", "Question Identification", "Identifies Question 1, Q1, and marks allocation."),
        SkillRule("blank_lines", "Answer Blanks", "Standardizes fill-in-the-blank underscore lengths."),
    ]

    def validate(self, text: str, context: SkillContext) -> SkillValidationResult:
        return SkillValidationResult(valid=True)

    def process_text(self, text: str, context: SkillContext) -> Dict[str, Any]:
        changes: List[str] = []
        updated = text

        q_matches = re.findall(r"^(?:Question\s+\d+|Q\d+|\d+\.\s*(?:\[\d+\s*(?:marks?|points?|pts?)\]))", updated, flags=re.IGNORECASE | re.MULTILINE)
        if q_matches:
            context.detected_features.add("exam_questions")
            changes.append(f"Identified {len(q_matches)} exam question element(s).")

        if re.search(r"_{3,}", updated):
            updated = re.sub(r"_{3,}", "__________", updated)
            changes.append("Standardized answer blank underlines.")

        return {"text": updated, "changes": changes}
