import { useState, useEffect, useCallback } from 'react';
import { skillRegistry } from '../skills/SkillRegistry';
import { skillOrchestrator } from '../skills/SkillOrchestrator';
import { DocumentSkill, OrchestrationResult } from '../skills/types';
import { CitationStyle, DocxPreset } from '../types/document';

export function useSkills() {
  const [skills, setSkills] = useState<DocumentSkill[]>(() => skillRegistry.getAll());

  useEffect(() => {
    // Subscribe to registry changes so React state stays in sync
    const unsubscribe = skillRegistry.subscribe(() => {
      setSkills([...skillRegistry.getAll()]);
    });
    return unsubscribe;
  }, []);

  const toggleSkill = useCallback((skillId: string, enabled: boolean) => {
    skillRegistry.setEnabled(skillId, enabled);
    // Persist to localStorage
    try {
      const current = skillRegistry.getEnabledStates();
      localStorage.setItem('formatai_skills_state_v1', JSON.stringify(current));
    } catch {
      // ignore
    }
  }, []);

  const resetSkills = useCallback(() => {
    skillRegistry.resetToDefaults();
    try {
      localStorage.removeItem('formatai_skills_state_v1');
    } catch {
      // ignore
    }
  }, []);

  // Restore skills from localStorage on first load
  useEffect(() => {
    try {
      const saved = localStorage.getItem('formatai_skills_state_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          skillRegistry.loadEnabledStates(parsed);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const orchestrateDocument = useCallback(
    (
      text: string,
      options: { title?: string; preset?: DocxPreset; citationStyle?: CitationStyle } = {}
    ): OrchestrationResult => {
      return skillOrchestrator.process(text, options);
    },
    []
  );

  const enabledCount = skills.filter((s) => s.enabled).length;

  return {
    skills,
    enabledCount,
    totalCount: skills.length,
    toggleSkill,
    resetSkills,
    orchestrateDocument,
  };
}
