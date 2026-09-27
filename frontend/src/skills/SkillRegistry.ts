import { DocumentSkill } from './types';
import { AcademicFormattingSkill } from './modules/academicFormattingSkill';
import { MathematicsSkill } from './modules/mathematicsSkill';
import { StatisticsSkill } from './modules/statisticsSkill';
import { ChemistrySkill } from './modules/chemistrySkill';
import { CitationReferencesSkill } from './modules/citationReferencesSkill';
import { TablesSkill } from './modules/tablesSkill';
import { ExamQuestionsSkill } from './modules/examQuestionsSkill';
import { StudyNotesSkill } from './modules/studyNotesSkill';
import { MarkdownCleanupSkill } from './modules/markdownCleanupSkill';
import { ScientificFormattingSkill } from './modules/scientificFormattingSkill';

export class SkillRegistry {
  private skills: Map<string, DocumentSkill> = new Map();
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.registerDefaults();
  }

  private registerDefaults(): void {
    const defaults: DocumentSkill[] = [
      new MarkdownCleanupSkill(),       // Priority 10 (runs first)
      new MathematicsSkill(),           // Priority 30
      new StatisticsSkill(),            // Priority 32
      new ChemistrySkill(),             // Priority 34
      new ScientificFormattingSkill(),  // Priority 36
      new AcademicFormattingSkill(),    // Priority 40
      new CitationReferencesSkill(),    // Priority 45
      new TablesSkill(),                // Priority 50
      new ExamQuestionsSkill(),         // Priority 60
      new StudyNotesSkill(),            // Priority 65
    ];

    for (const skill of defaults) {
      this.skills.set(skill.id, skill);
    }
  }

  /**
   * Register a new modular skill at runtime without modifying application internals.
   */
  public register(skill: DocumentSkill): void {
    this.skills.set(skill.id, skill);
    this.notify();
  }

  /**
   * Unregister an existing skill.
   */
  public unregister(skillId: string): boolean {
    const removed = this.skills.delete(skillId);
    if (removed) {
      this.notify();
    }
    return removed;
  }

  /**
   * Retrieve a specific skill by identifier.
   */
  public get(skillId: string): DocumentSkill | undefined {
    return this.skills.get(skillId);
  }

  /**
   * Retrieve all registered skills, sorted by execution priority.
   */
  public getAll(): DocumentSkill[] {
    return Array.from(this.skills.values()).sort((a, b) => a.priority - b.priority);
  }

  /**
   * Retrieve ONLY enabled skills, sorted by execution priority.
   */
  public getEnabled(): DocumentSkill[] {
    return this.getAll().filter((s) => s.enabled);
  }

  /**
   * Toggle a skill's enabled state.
   */
  public setEnabled(skillId: string, enabled: boolean): void {
    const skill = this.skills.get(skillId);
    if (skill && skill.enabled !== enabled) {
      skill.enabled = enabled;
      this.notify();
    }
  }

  /**
   * Bulk import enabled states (e.g. from localStorage or user settings).
   */
  public loadEnabledStates(states: Record<string, boolean>): void {
    let changed = false;
    for (const [id, enabled] of Object.entries(states)) {
      const skill = this.skills.get(id);
      if (skill && skill.enabled !== enabled) {
        skill.enabled = enabled;
        changed = true;
      }
    }
    if (changed) {
      this.notify();
    }
  }

  /**
   * Export all current enabled states as a key-value mapping.
   */
  public getEnabledStates(): Record<string, boolean> {
    const map: Record<string, boolean> = {};
    for (const [id, skill] of this.skills.entries()) {
      map[id] = skill.enabled;
    }
    return map;
  }

  /**
   * Reset all skills to active defaults.
   */
  public resetToDefaults(): void {
    for (const skill of this.skills.values()) {
      skill.enabled = true;
    }
    this.notify();
  }

  /**
   * Subscribe to registry changes (for React hooks).
   */
  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch (err) {
        console.error('Error in SkillRegistry listener:', err);
      }
    }
  }
}

// Global singleton instance
export const skillRegistry = new SkillRegistry();
