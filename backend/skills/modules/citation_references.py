"""Citation and References Skill."""

import re
from typing import Any, Dict, List
from backend.skills.base import BaseSkill, SkillContext, SkillRule, SkillValidationResult


class CitationReferencesSkill(BaseSkill):
    id = "citation_references"
    name = "Citation/References"
    description = "Detects, validates, and standardizes in-text citations ([1], (Author, 2020)) and bibliography entries."
    version = "1.1.0"
    category = "formatting"
    priority = 45
    enabled = True

    rules = [
        SkillRule("in_text_citations", "In-text Citation Parsing", "Detects bracket and author-year citations."),
        SkillRule("doi_normalization", "DOI Canonicalization", "Converts raw DOI to https://doi.org/ links."),
    ]

    def validate(self, text: str, context: SkillContext) -> SkillValidationResult:
        warnings = []
        if re.search(r"\[\d+\]", text) and not re.search(r"^(?:#{1,3}\s+)?(?:references|bibliography)", text, flags=re.IGNORECASE | re.MULTILINE):
            warnings.append("Document has in-text citations but lacks a References section.")
        return SkillValidationResult(valid=True, warnings=warnings)

    def process_text(self, text: str, context: SkillContext) -> Dict[str, Any]:
        changes: List[str] = []
        updated = text

        doi_pat = r"\bdoi:\s*(10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+)"
        if re.search(doi_pat, updated, flags=re.IGNORECASE):
            updated = re.sub(doi_pat, r"https://doi.org/\1", updated, flags=re.IGNORECASE)
            changes.append("Normalized DOI references to canonical https://doi.org/ links.")

        cites = re.findall(r"\[\d+(?:[,\s-]+\d+)*\]|\([A-Z][a-zA-Z]+(?: et al\.)?, \d{4}\)", updated)
        if cites:
            context.detected_features.add("citations")
            changes.append(f"Indexed {len(cites)} in-text citation(s).")

        return {"text": updated, "changes": changes}
