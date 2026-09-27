import { AcademicDocument, CitationStyle, DocumentBlock, DocxPreset } from '../types/document';
import { skillRegistry, SkillRegistry } from './SkillRegistry';
import { DocumentSkill, OrchestrationResult, SkillContext, SkillExecutionLog } from './types';

export class SkillOrchestrator {
  private registry: SkillRegistry;

  constructor(registry: SkillRegistry = skillRegistry) {
    this.registry = registry;
  }

  /**
   * Execute the full modular Skill Orchestration Pipeline:
   *
   * Input Raw Text
   *   → Skill Orchestrator
   *   → Enabled Skills (in priority order)
   *   → Document Model (AcademicDocument AST)
   *   → Export-Ready Representation
   *
   * STRICT GUARANTEE: Disabled skills are completely bypassed and do NOT execute.
   */
  public process(
    rawText: string,
    options: {
      title?: string;
      preset?: DocxPreset;
      citationStyle?: CitationStyle;
      userSettings?: Record<string, unknown>;
    } = {}
  ): OrchestrationResult {
    const startTime = performance.now();
    const executionLogs: SkillExecutionLog[] = [];

    const context: SkillContext = {
      title: options.title,
      preset: options.preset || 'academic',
      citationStyle: options.citationStyle || 'apa',
      userSettings: options.userSettings || {},
      metadata: {},
      detectedFeatures: new Set<string>(),
    };

    const allSkills = this.registry.getAll();
    const enabledSkills = this.registry.getEnabled();
    const disabledSkillsCount = allSkills.length - enabledSkills.length;

    let currentText = rawText;

    // Phase 1: Text-Level Transformations through Enabled Skills
    for (const skill of enabledSkills) {
      const skillStart = performance.now();

      // Step 1: Validation
      const valResult = skill.validate(currentText, context);
      if (!valResult.valid) {
        executionLogs.push({
          skillId: skill.id,
          skillName: skill.name,
          version: skill.version,
          applied: false,
          changesCount: 0,
          changes: valResult.errors.map((e) => `[Validation Error] ${e}`),
          durationMs: Math.round(performance.now() - skillStart),
        });
        continue;
      }

      // Step 2: Text Processing
      const { text: transformedText, changes } = skill.processText(currentText, context);
      const durationMs = Math.round(performance.now() - skillStart);

      currentText = transformedText;
      executionLogs.push({
        skillId: skill.id,
        skillName: skill.name,
        version: skill.version,
        applied: changes.length > 0,
        changesCount: changes.length,
        changes,
        durationMs,
      });
    }

    // Phase 2: Structural AST Construction (Document Model)
    let initialBlocks = this.constructInitialBlocks(currentText, context);

    // Phase 3: Block-Level Transformations through Enabled Skills
    for (const skill of enabledSkills) {
      if (typeof skill.processBlocks === 'function') {
        const blockStart = performance.now();
        const { blocks: transformedBlocks, changes } = skill.processBlocks(initialBlocks, context);
        initialBlocks = transformedBlocks;

        if (changes.length > 0) {
          const existingLog = executionLogs.find((l) => l.skillId === skill.id);
          if (existingLog) {
            existingLog.changes.push(...changes);
            existingLog.changesCount += changes.length;
            existingLog.durationMs += Math.round(performance.now() - blockStart);
          }
        }
      }
    }

    // Phase 4: Construct Final AcademicDocument AST Model
    const words = currentText.trim().split(/\s+/).filter(Boolean).length;
    const chars = currentText.length;
    const headings = initialBlocks.filter((b) => b.block_type === 'heading');
    const references = initialBlocks
      .filter((b) => b.block_type === 'reference_entry')
      .map((b) => b.text);

    const docTitle =
      context.title ||
      initialBlocks.find((b) => b.block_type === 'title')?.text ||
      headings[0]?.text ||
      'Academic Document';

    const document: AcademicDocument = {
      id: `doc_${Date.now()}`,
      title: docTitle,
      abstract: initialBlocks.find((b) => b.metadata?.is_abstract)?.text,
      citation_style: (context.citationStyle as CitationStyle) || 'apa',
      blocks: initialBlocks,
      references,
      statistics: {
        word_count: words,
        character_count: chars,
        paragraph_count: initialBlocks.filter((b) => b.block_type === 'paragraph').length,
        heading_count: headings.length,
        estimated_pages: Math.max(1, Math.ceil(words / 450)),
        estimated_read_time_minutes: Math.max(1, Math.ceil(words / 200)),
      },
      metadata: {
        doc_id: `meta_${Date.now()}`,
        title: docTitle,
        citation_style: (context.citationStyle as CitationStyle) || 'apa',
        detected_citations: Array.from(context.detectedFeatures),
        created_at: new Date().toISOString(),
      },
    };

    const totalDurationMs = Math.round(performance.now() - startTime);

    return {
      success: true,
      document,
      rawText,
      cleanedText: currentText,
      executionLogs,
      appliedSkillsCount: executionLogs.filter((l) => l.applied).length,
      disabledSkillsCount,
      totalDurationMs,
    };
  }

  /**
   * Internal parser converting structured text to DocumentBlock AST nodes.
   */
  private constructInitialBlocks(text: string, context: SkillContext): DocumentBlock[] {
    const lines = text.split('\n');
    const blocks: DocumentBlock[] = [];
    let currentTable: { headers: string[]; rows: string[][]; alignments: string[] } | null = null;
    let currentList: { type: 'unordered_list' | 'ordered_list'; items: string[] } | null = null;
    let currentMath: string[] | null = null;
    let inReferences = false;

    const flushTable = () => {
      if (currentTable) {
        blocks.push({
          id: `table_${blocks.length + 1}`,
          block_type: 'table',
          text: '',
          headers: currentTable.headers,
          rows: currentTable.rows,
          alignments: currentTable.alignments,
        });
        currentTable = null;
      }
    };

    const flushList = () => {
      if (currentList) {
        blocks.push({
          id: `list_${blocks.length + 1}`,
          block_type: currentList.type,
          text: currentList.items.join('\n'),
          items: [...currentList.items],
        });
        currentList = null;
      }
    };

    for (const line of lines) {
      const trimmed = line.trim();

      // Display math $$ ... $$
      if (trimmed.startsWith('$$')) {
        flushTable();
        flushList();
        if (currentMath) {
          currentMath.push(trimmed.replace(/^\$\$/g, '').replace(/\$\$$/g, '').trim());
          blocks.push({
            id: `math_${blocks.length + 1}`,
            block_type: 'math_block',
            text: currentMath.filter(Boolean).join('\n'),
          });
          currentMath = null;
          continue;
        } else if (trimmed.endsWith('$$') && trimmed.length > 2) {
          blocks.push({
            id: `math_${blocks.length + 1}`,
            block_type: 'math_block',
            text: trimmed.slice(2, -2).trim(),
          });
          continue;
        } else {
          currentMath = [trimmed.replace(/^\$\$/g, '').trim()];
          continue;
        }
      }

      if (currentMath) {
        if (trimmed.endsWith('$$')) {
          currentMath.push(trimmed.replace(/\$\$$/g, '').trim());
          blocks.push({
            id: `math_${blocks.length + 1}`,
            block_type: 'math_block',
            text: currentMath.filter(Boolean).join('\n'),
          });
          currentMath = null;
        } else {
          currentMath.push(trimmed);
        }
        continue;
      }

      if (!trimmed) {
        flushTable();
        flushList();
        continue;
      }

      // Markdown Table
      if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
        flushList();
        const cells = trimmed.slice(1, -1).split('|').map((c) => c.trim());
        const isDivider = cells.every((c) => /^:?-+:?$/.test(c));

        if (isDivider) {
          if (currentTable) {
            currentTable.alignments = cells.map((c) => {
              if (c.startsWith(':') && c.endsWith(':')) return 'center';
              if (c.endsWith(':')) return 'right';
              return 'left';
            });
          }
        } else if (!currentTable) {
          currentTable = { headers: cells, rows: [], alignments: cells.map(() => 'left') };
        } else {
          currentTable.rows.push(cells);
        }
        continue;
      } else {
        flushTable();
      }

      // Headings
      const hMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
      if (hMatch) {
        flushList();
        const level = hMatch[1].length;
        const hText = hMatch[2].trim();

        if (level === 1 && !context.title) {
          context.title = hText;
          blocks.push({
            id: `title_1`,
            block_type: 'title',
            text: hText,
            level: 1,
          });
          continue;
        }

        if (/^(?:references|bibliography|works cited)$/i.test(hText)) {
          inReferences = true;
        } else {
          inReferences = false;
        }

        blocks.push({
          id: `heading_${blocks.length + 1}`,
          block_type: 'heading',
          text: hText,
          level,
        });
        continue;
      }

      // Lists
      const bulletMatch = trimmed.match(/^[-*+]\s+(.*)$/);
      if (bulletMatch) {
        if (!currentList || currentList.type !== 'unordered_list') {
          flushList();
          currentList = { type: 'unordered_list', items: [] };
        }
        currentList.items.push(bulletMatch[1].trim());
        continue;
      }

      const numMatch = trimmed.match(/^\d+\.\s+(.*)$/);
      if (numMatch) {
        if (!currentList || currentList.type !== 'ordered_list') {
          flushList();
          currentList = { type: 'ordered_list', items: [] };
        }
        currentList.items.push(numMatch[1].trim());
        continue;
      }

      flushList();

      if (inReferences) {
        blocks.push({
          id: `ref_${blocks.length + 1}`,
          block_type: 'reference_entry',
          text: trimmed,
        });
        continue;
      }

      blocks.push({
        id: `para_${blocks.length + 1}`,
        block_type: 'paragraph',
        text: trimmed,
      });
    }

    flushTable();
    flushList();

    return blocks;
  }
}

// Global default orchestrator instance
export const skillOrchestrator = new SkillOrchestrator(skillRegistry);
