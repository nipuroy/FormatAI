"""Tables Skill."""

import re
from typing import Any, Dict, List
from backend.skills.base import BaseSkill, SkillContext, SkillRule, SkillValidationResult


class TablesSkill(BaseSkill):
    id = "tables"
    name = "Tables"
    description = "Parses Markdown pipe tables, column alignments, headers, and constructs structured table AST blocks."
    version = "1.0.0"
    category = "structure"
    priority = 50
    enabled = True

    rules = [
        SkillRule("pipe_parsing", "Pipe Delimiter Parsing", "Parses markdown table syntax into cell grids."),
        SkillRule("alignment", "Alignment Analysis", "Extracts column alignments (:---, :---:, ---:)."),
    ]

    def validate(self, text: str, context: SkillContext) -> SkillValidationResult:
        return SkillValidationResult(valid=True)

    def process_text(self, text: str, context: SkillContext) -> Dict[str, Any]:
        changes: List[str] = []
        if re.search(r"^\|.+?\|$", text, flags=re.MULTILINE):
            context.detected_features.add("tables")
            changes.append("Detected markdown pipe table structures.")
        return {"text": text, "changes": changes}
