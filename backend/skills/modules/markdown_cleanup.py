"""Markdown Cleanup Skill.

Priority: 10 (runs first)
Strips conversational AI intros/signoffs and cleans empty lines.
"""

import re
from typing import Any, Dict, List
from backend.skills.base import BaseSkill, SkillContext, SkillRule, SkillValidationResult

AI_PREFIXES = [
    r"^(?:Sure(?: thing)?[,!]|Certainly[,!]|Of course[,!]|Here is (?:your|the)|Here's (?:your|the)|Below is (?:the|your)|As requested[,:]?).*?(?:\n+|$)",
    r"^(?:I have (?:formatted|organized|structured|prepared)|Please find (?:below|attached)).*?(?:\n+|$)",
]

AI_SUFFIXES = [
    r"(?:\n+|^)(?:(?:I )?Hope this helps[\w\s,!.]*)$",
    r"(?:\n+|^)(?:Let me know if you (?:need|have any)[\w\s,!.]*)$",
    r"(?:\n+|^)(?:Feel free to (?:ask|reach out)[\w\s,!.]*)$",
]


class MarkdownCleanupSkill(BaseSkill):
    id = "markdown_cleanup"
    name = "Markdown Cleanup"
    description = "Strips conversational AI assistant chatter, heals fragmented paragraphs, and cleans divider lines."
    version = "1.3.0"
    category = "cleanup"
    priority = 10
    enabled = True

    rules = [
        SkillRule("intro_removal", "Conversational Intro Stripping", "Removes greetings like 'Sure thing! Here is...'"),
        SkillRule("outro_removal", "Conversational Sign-off Stripping", "Removes closing remarks like 'Hope this helps!'"),
        SkillRule("whitespace_compression", "Whitespace Normalization", "Compresses multiple blank lines and trims spaces."),
    ]

    def validate(self, text: str, context: SkillContext) -> SkillValidationResult:
        return SkillValidationResult(valid=True)

    def process_text(self, text: str, context: SkillContext) -> Dict[str, Any]:
        changes: List[str] = []
        cleaned = text.strip()

        for pat in AI_PREFIXES:
            if re.search(pat, cleaned, flags=re.IGNORECASE):
                cleaned = re.sub(pat, "", cleaned, flags=re.IGNORECASE).strip()
                changes.append("Stripped introductory conversational greeting.")

        for pat in AI_SUFFIXES:
            if re.search(pat, cleaned, flags=re.IGNORECASE):
                cleaned = re.sub(pat, "", cleaned, flags=re.IGNORECASE).strip()
                changes.append("Stripped closing conversational sign-off.")

        if re.search(r"\n{3,}", cleaned):
            cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
            changes.append("Normalized multi-line blank gaps.")

        if changes:
            context.detected_features.add("denoised")

        return {"text": cleaned, "changes": changes}
