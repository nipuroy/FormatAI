"""Base classes and types for FormatAI Modular Skills Architecture.

A Skill is an independent document-processing capability.
Architecture:
Input -> Skill Orchestrator -> Enabled Skills -> Document Model -> Export
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Set


@dataclass
class SkillRule:
    """Descriptor for a discrete processing rule inside a skill."""
    id: str
    name: str
    description: str
    enabled: bool = True


@dataclass
class SkillValidationResult:
    """Outcome of validating text before processing."""
    valid: bool
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)


@dataclass
class SkillContext:
    """Execution context passed through the orchestration pipeline."""
    title: Optional[str] = None
    preset: str = "academic"
    citation_style: str = "apa"
    metadata: Dict[str, Any] = field(default_factory=dict)
    detected_features: Set[str] = field(default_factory=set)


@dataclass
class SkillExecutionLog:
    """Record of a skill execution."""
    skill_id: str
    skill_name: str
    version: str
    applied: bool
    changes_count: int
    changes: List[str] = field(default_factory=list)
    duration_ms: float = 0.0


class BaseSkill(ABC):
    """Abstract base class for all modular document skills."""

    id: str
    name: str
    description: str
    version: str
    category: str
    priority: int = 50
    enabled: bool = True
    rules: List[SkillRule] = []

    @abstractmethod
    def validate(self, text: str, context: SkillContext) -> SkillValidationResult:
        """Validate input content against this skill's domain rules."""
        pass

    @abstractmethod
    def process_text(self, text: str, context: SkillContext) -> Dict[str, Any]:
        """Apply text-level processing rules. Return {'text': str, 'changes': List[str]}."""
        pass

    def process_blocks(self, blocks: List[Dict[str, Any]], context: SkillContext) -> Dict[str, Any]:
        """Optional block-level AST transformation."""
        return {"blocks": blocks, "changes": []}
