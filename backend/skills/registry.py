"""Modular Skill Registry for Python Backend."""

from typing import Dict, List, Optional
from backend.skills.base import BaseSkill
from backend.skills.modules.academic_formatting import AcademicFormattingSkill
from backend.skills.modules.mathematics import MathematicsSkill
from backend.skills.modules.statistics import StatisticsSkill
from backend.skills.modules.chemistry import ChemistrySkill
from backend.skills.modules.citation_references import CitationReferencesSkill
from backend.skills.modules.tables import TablesSkill
from backend.skills.modules.exam_questions import ExamQuestionsSkill
from backend.skills.modules.study_notes import StudyNotesSkill
from backend.skills.modules.markdown_cleanup import MarkdownCleanupSkill
from backend.skills.modules.scientific_formatting import ScientificFormattingSkill


class SkillRegistry:
    """Central registry for managing, enabling, and discovering document skills."""

    def __init__(self) -> None:
        self._skills: Dict[str, BaseSkill] = {}
        self._register_defaults()

    def _register_defaults(self) -> None:
        defaults: List[BaseSkill] = [
            MarkdownCleanupSkill(),       # Priority 10
            MathematicsSkill(),           # Priority 30
            StatisticsSkill(),            # Priority 32
            ChemistrySkill(),             # Priority 34
            ScientificFormattingSkill(),  # Priority 36
            AcademicFormattingSkill(),    # Priority 40
            CitationReferencesSkill(),    # Priority 45
            TablesSkill(),                # Priority 50
            ExamQuestionsSkill(),         # Priority 60
            StudyNotesSkill(),            # Priority 65
        ]
        for skill in defaults:
            self._skills[skill.id] = skill

    def register(self, skill: BaseSkill) -> None:
        """Register a new modular skill at runtime."""
        self._skills[skill.id] = skill

    def get(self, skill_id: str) -> Optional[BaseSkill]:
        """Fetch a skill by identifier."""
        return self._skills.get(skill_id)

    def get_all(self) -> List[BaseSkill]:
        """Fetch all registered skills, ordered by execution priority."""
        return sorted(self._skills.values(), key=lambda s: s.priority)

    def get_enabled(self) -> List[BaseSkill]:
        """Fetch ONLY enabled skills, ordered by execution priority."""
        return [s for s in self.get_all() if s.enabled]

    def set_enabled(self, skill_id: str, enabled: bool) -> None:
        """Toggle skill enablement."""
        if skill_id in self._skills:
            self._skills[skill_id].enabled = enabled

    def load_states(self, states: Dict[str, bool]) -> None:
        """Bulk update enabled/disabled states."""
        for skill_id, enabled in states.items():
            if skill_id in self._skills:
                self._skills[skill_id].enabled = enabled

    def reset_to_defaults(self) -> None:
        """Reset all skills to active."""
        for skill in self._skills.values():
            skill.enabled = True


# Global default registry instance
skill_registry = SkillRegistry()
