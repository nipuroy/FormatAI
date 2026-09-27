"""Modular Skills API Router.

Endpoints for discovering, configuring, toggling, validating, and executing
document skills through the clean Skill Orchestrator pipeline:
Input -> Skill Orchestrator -> Enabled Skills -> Document Model -> Export
"""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from backend.skills.base import SkillContext
from backend.skills.registry import skill_registry
from backend.skills.orchestrator import skill_orchestrator

router = APIRouter(prefix="/skills", tags=["Skills"])


class SkillRuleResponse(BaseModel):
    id: str
    name: str
    description: str
    enabled: bool = True


class SkillInfoResponse(BaseModel):
    id: str
    name: str
    description: str
    version: str
    category: str
    priority: int
    enabled: bool
    rules: List[SkillRuleResponse]


class ToggleSkillRequest(BaseModel):
    skill_id: Optional[str] = None
    enabled: Optional[bool] = None
    states: Optional[Dict[str, bool]] = None


class ProcessSkillsRequest(BaseModel):
    raw_text: str = Field(..., description="Raw academic markdown text to process")
    title: Optional[str] = None
    preset: str = "academic"
    citation_style: str = "apa"


class ValidateSkillsRequest(BaseModel):
    raw_text: str = Field(..., description="Raw academic text to validate")
    skill_ids: Optional[List[str]] = None


@router.get("", response_model=List[SkillInfoResponse], summary="List all registered skills")
def list_skills() -> List[SkillInfoResponse]:
    """Retrieve all available skills, their versions, rules, and enabled states."""
    skills = skill_registry.get_all()
    return [
        SkillInfoResponse(
            id=s.id,
            name=s.name,
            description=s.description,
            version=s.version,
            category=s.category,
            priority=s.priority,
            enabled=s.enabled,
            rules=[
                SkillRuleResponse(
                    id=r.id,
                    name=r.name,
                    description=r.description,
                    enabled=r.enabled,
                )
                for r in s.rules
            ],
        )
        for s in skills
    ]


@router.post("/toggle", summary="Toggle skill enablement state")
def toggle_skill(request: ToggleSkillRequest) -> Dict[str, Any]:
    """Enable or disable one or multiple skills.
    
    A disabled skill is guaranteed never to execute or modify documents.
    """
    if request.states:
        skill_registry.load_states(request.states)
    elif request.skill_id is not None and request.enabled is not None:
        skill = skill_registry.get(request.skill_id)
        if not skill:
            raise HTTPException(status_code=404, detail=f"Skill '{request.skill_id}' not found")
        skill_registry.set_enabled(request.skill_id, request.enabled)
    else:
        raise HTTPException(
            status_code=400,
            detail="Must provide either 'skill_id' with 'enabled', or a 'states' dictionary",
        )

    enabled_ids = [s.id for s in skill_registry.get_enabled()]
    all_skills = skill_registry.get_all()
    return {
        "success": True,
        "enabled_count": len(enabled_ids),
        "total_count": len(all_skills),
        "enabled_skill_ids": enabled_ids,
    }


@router.post("/process", summary="Execute document through enabled skills orchestrator")
def process_document(request: ProcessSkillsRequest) -> Dict[str, Any]:
    """Run text through all enabled skills in priority order.
    
    Architecture: Input -> Skill Orchestrator -> Enabled Skills -> Document Model -> Export.
    Disabled skills will not process the document.
    """
    result = skill_orchestrator.process(
        raw_text=request.raw_text,
        title=request.title,
        preset=request.preset,
        citation_style=request.citation_style,
    )
    return result


@router.post("/validate", summary="Validate input text against skills")
def validate_document(request: ValidateSkillsRequest) -> Dict[str, Any]:
    """Validate raw text against domain rules of enabled skills."""
    context = SkillContext()
    skills_to_validate = (
        [skill_registry.get(sid) for sid in request.skill_ids if skill_registry.get(sid)]
        if request.skill_ids
        else skill_registry.get_enabled()
    )

    validation_results = {}
    overall_valid = True

    for skill in skills_to_validate:
        if not skill:
            continue
        res = skill.validate(request.raw_text, context)
        if not res.valid:
            overall_valid = False
        validation_results[skill.id] = {
            "valid": res.valid,
            "errors": res.errors,
            "warnings": res.warnings,
        }

    return {
        "valid": overall_valid,
        "results": validation_results,
    }


@router.post("/reset", summary="Reset all skills to enabled defaults")
def reset_skills() -> Dict[str, Any]:
    """Reset all registered skills to enabled state."""
    skill_registry.reset_to_defaults()
    return {
        "success": True,
        "message": "All skills reset to default active states",
        "enabled_count": len(skill_registry.get_enabled()),
    }
