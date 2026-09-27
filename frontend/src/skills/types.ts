/**
 * Modular Document Skills Architecture Type Definitions.
 *
 * A Skill is an independent document-processing capability that can be dynamically
 * enabled, disabled, configured, validated, and chained in the Skill Orchestrator pipeline.
 */

import { AcademicDocument, DocumentBlock } from '../types/document';

export type SkillCategory =
  | 'formatting'
  | 'stem'
  | 'structure'
  | 'cleanup'
  | 'pedagogy';

export interface SkillRule {
  id: string;
  name: string;
  description: string;
  enabled?: boolean;
}

export interface SkillValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface SkillContext {
  title?: string;
  preset?: string;
  citationStyle?: string;
  userSettings?: Record<string, unknown>;
  metadata: Record<string, unknown>;
  detectedFeatures: Set<string>;
}

export interface SkillExecutionLog {
  skillId: string;
  skillName: string;
  version: string;
  applied: boolean;
  changesCount: number;
  changes: string[];
  durationMs: number;
}

export interface OrchestrationResult {
  success: boolean;
  document: AcademicDocument;
  rawText: string;
  cleanedText: string;
  executionLogs: SkillExecutionLog[];
  appliedSkillsCount: number;
  disabledSkillsCount: number;
  totalDurationMs: number;
}

export interface DocumentSkill {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly version: string;
  readonly category: SkillCategory;
  readonly priority: number; // lower numbers execute earlier (e.g. 10 = cleanup, 50 = text transform, 80 = blocks)
  enabled: boolean;
  readonly rules: SkillRule[];

  /**
   * Validate the input content against this skill's requirements.
   */
  validate(text: string, context: SkillContext): SkillValidationResult;

  /**
   * Text-level transformation rule application.
   * If the skill is disabled, the Orchestrator will NOT invoke this method.
   */
  processText(text: string, context: SkillContext): { text: string; changes: string[] };

  /**
   * Block-level AST transformation rule application.
   * Executed after text is broken into AST blocks.
   */
  processBlocks?(blocks: DocumentBlock[], context: SkillContext): { blocks: DocumentBlock[]; changes: string[] };
}
