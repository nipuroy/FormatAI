"""Unit tests for Python Modular Skills Architecture.

Tests cover:
- All 10 initial skills registration
- Skill attributes (name, description, version, enabled, rules)
- Input -> Skill Orchestrator -> Enabled Skills -> Document Model pipeline
- Strict enforcement: A disabled skill must NOT process or alter document
- Custom runtime skill registration without changing core code
- Validation handling
"""

import pytest
from backend.skills.base import BaseSkill, SkillContext, SkillRule, SkillValidationResult
from backend.skills.registry import SkillRegistry
from backend.skills.orchestrator import SkillOrchestrator
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


def test_registry_contains_all_10_initial_skills():
    registry = SkillRegistry()
    skills = registry.get_all()
    assert len(skills) == 10

    skill_ids = {s.id for s in skills}
    expected_ids = {
        "academic_formatting",
        "mathematics",
        "statistics",
        "chemistry",
        "citation_references",
        "tables",
        "exam_questions",
        "study_notes",
        "markdown_cleanup",
        "scientific_formatting",
    }
    assert expected_ids.issubset(skill_ids)


def test_each_skill_has_required_contract():
    registry = SkillRegistry()
    for skill in registry.get_all():
        assert skill.name and isinstance(skill.name, str)
        assert skill.description and isinstance(skill.description, str)
        assert skill.version and isinstance(skill.version, str)
        assert isinstance(skill.enabled, bool)
        assert len(skill.rules) >= 1
        for rule in skill.rules:
            assert rule.id
            assert rule.name
            assert rule.description


def test_markdown_cleanup_strips_ai_chatter():
    skill = MarkdownCleanupSkill()
    raw = "Sure thing! Here is the revised text:\n\n# Real Content\n\nHope this helps! Let me know if you need anything else."
    res = skill.process_text(raw, SkillContext())
    assert "Sure thing!" not in res["text"]
    assert "Hope this helps!" not in res["text"]
    assert "# Real Content" in res["text"]
    assert len(res["changes"]) > 0


def test_mathematics_skill_normalizes_latex():
    skill = MathematicsSkill()
    raw = "Let \\[ E = mc^2 \\] and \\( a^2 + b^2 = c^2 \\)"
    res = skill.process_text(raw, SkillContext())
    assert "$$E = mc^2$$" in res["text"].replace("\n", "")
    assert "$a^2 + b^2 = c^2$" in res["text"]


def test_statistics_skill_formats_stats():
    skill = StatisticsSkill()
    raw = "The result was p = .000 and F(1, 40) = 4.52."
    res = skill.process_text(raw, SkillContext())
    assert "p < .001" in res["text"]
    assert len(res["changes"]) > 0


def test_chemistry_skill_reaction_arrows():
    skill = ChemistrySkill()
    raw = "2H2 + O2 -> 2H2O"
    res = skill.process_text(raw, SkillContext())
    assert "→" in res["text"]


def test_citation_references_skill_standardizes_doi():
    skill = CitationReferencesSkill()
    raw = "See Smith (2020) doi: 10.1000/182"
    res = skill.process_text(raw, SkillContext())
    assert "https://doi.org/10.1000/182" in res["text"]


def test_disabled_skill_is_strictly_bypassed():
    registry = SkillRegistry()
    # Disable chemistry and mathematics
    registry.set_enabled("chemistry", False)
    registry.set_enabled("mathematics", False)

    orchestrator = SkillOrchestrator(registry=registry)
    input_text = "2H2 + O2 -> 2H2O with \\[ E = mc^2 \\]"
    result = orchestrator.process(input_text)

    # Reaction arrow should NOT be transformed because chemistry is disabled
    assert "->" in result["processed_text"]
    # LaTeX \\[ should NOT be transformed because mathematics is disabled
    assert "\\[ E = mc^2 \\]" in result["processed_text"]

    executed_skill_ids = [l["skill_id"] for l in result["execution_logs"]]
    assert "chemistry" not in executed_skill_ids
    assert "mathematics" not in executed_skill_ids


def test_dynamic_skill_extensibility():
    """Verify new skills can be added at runtime without rewriting the orchestrator."""
    registry = SkillRegistry()
    initial_count = len(registry.get_all())

    class CustomBioinformaticsSkill(BaseSkill):
        id = "bioinformatics"
        name = "Bioinformatics Sequence Formatting"
        description = "Formats DNA/RNA FASTA sequences."
        version = "1.0.0"
        category = "stem"
        priority = 35
        enabled = True
        rules = [SkillRule("dna_upper", "Uppercase DNA", "Uppercases nucleotides")]

        def validate(self, text: str, context: SkillContext) -> SkillValidationResult:
            return SkillValidationResult(valid=True)

        def process_text(self, text: str, context: SkillContext):
            return {"text": text.replace("atcg", "ATCG"), "changes": ["Uppercased nucleotide sequence"]}

    registry.register(CustomBioinformaticsSkill())
    assert len(registry.get_all()) == initial_count + 1

    orchestrator = SkillOrchestrator(registry=registry)
    res = orchestrator.process("Sequence: atcgatcg")
    assert "ATCGATCG" in res["processed_text"]
