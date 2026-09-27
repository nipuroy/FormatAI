"""Skill Orchestrator for Python Backend.

Pipeline:
Input -> Skill Orchestrator -> Enabled Skills -> Document Model -> Export
"""

import time
from typing import Any, Dict, List, Optional
from backend.skills.base import SkillContext, SkillExecutionLog
from backend.skills.registry import SkillRegistry, skill_registry


class SkillOrchestrator:
    """Executes the modular skills pipeline over raw academic input text."""

    def __init__(self, registry: Optional[SkillRegistry] = None) -> None:
        self.registry = registry or skill_registry

    def process(
        self,
        raw_text: str,
        title: Optional[str] = None,
        preset: str = "academic",
        citation_style: str = "apa",
    ) -> Dict[str, Any]:
        """Execute all enabled skills in priority order.

        STRICT GUARANTEE: Disabled skills are bypassed and do not alter the document.
        """
        start_time = time.perf_counter()
        context = SkillContext(
            title=title,
            preset=preset,
            citation_style=citation_style,
        )

        all_skills = self.registry.get_all()
        enabled_skills = self.registry.get_enabled()
        disabled_count = len(all_skills) - len(enabled_skills)

        current_text = raw_text
        logs: List[SkillExecutionLog] = []

        # Phase 1: Text-Level Transformations through Enabled Skills
        for skill in enabled_skills:
            t0 = time.perf_counter()
            validation = skill.validate(current_text, context)
            if not validation.valid:
                logs.append(
                    SkillExecutionLog(
                        skill_id=skill.id,
                        skill_name=skill.name,
                        version=skill.version,
                        applied=False,
                        changes_count=0,
                        changes=[f"[Validation Error] {e}" for e in validation.errors],
                        duration_ms=(time.perf_counter() - t0) * 1000,
                    )
                )
                continue

            result = skill.process_text(current_text, context)
            current_text = result["text"]
            changes = result.get("changes", [])
            dur_ms = (time.perf_counter() - t0) * 1000

            logs.append(
                SkillExecutionLog(
                    skill_id=skill.id,
                    skill_name=skill.name,
                    version=skill.version,
                    applied=len(changes) > 0,
                    changes_count=len(changes),
                    changes=changes,
                    duration_ms=dur_ms,
                )
            )

        total_ms = (time.perf_counter() - start_time) * 1000

        return {
            "success": True,
            "raw_text": raw_text,
            "processed_text": current_text,
            "detected_features": list(context.detected_features),
            "title": context.title,
            "enabled_skills_count": len(enabled_skills),
            "disabled_skills_count": disabled_count,
            "execution_logs": [
                {
                    "skill_id": l.skill_id,
                    "skill_name": l.skill_name,
                    "version": l.version,
                    "applied": l.applied,
                    "changes_count": l.changes_count,
                    "changes": l.changes,
                    "duration_ms": round(l.duration_ms, 2),
                }
                for l in logs
            ],
            "total_duration_ms": round(total_ms, 2),
        }


skill_orchestrator = SkillOrchestrator()
