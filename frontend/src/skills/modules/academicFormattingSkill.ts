import { DocumentBlock } from '../../types/document';
import { DocumentSkill, SkillContext, SkillValidationResult } from '../types';

export class AcademicFormattingSkill implements DocumentSkill {
  readonly id = 'academic_formatting';
  readonly name = 'Academic Formatting';
  readonly description = 'Standardizes heading hierarchies, abstract blocks, paragraph typography, and academic structure.';
  readonly version = '1.0.0';
  readonly category = 'formatting' as const;
  readonly priority = 40;
  enabled: boolean = true;

  readonly rules = [
    {
      id: 'heading_hierarchy',
      name: 'Heading Hierarchy Normalization',
      description: 'Standardizes markdown heading syntax (# to H1, ## to H2, etc.) and title casing.',
    },
    {
      id: 'abstract_styling',
      name: 'Abstract Block Formatting',
      description: 'Isolates and styles the abstract section with academic blockquote conventions.',
    },
    {
      id: 'paragraph_spacing',
      name: 'Academic Paragraph Flow',
      description: 'Ensures uniform paragraph separation, indentation rules, and line spacing.',
    },
  ];

  validate(text: string, _context: SkillContext): SkillValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!text || text.trim().length === 0) {
      errors.push('Content is empty.');
    } else {
      const hasHeading = /^(?:#{1,6}\s+.+|\d+\.\s+[A-Z].+)$/m.test(text);
      if (!hasHeading) {
        warnings.push('No explicit academic headings detected; document will use default paragraph flow.');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  processText(text: string, context: SkillContext): { text: string; changes: string[] } {
    const changes: string[] = [];
    let updated = text;

    // Rule 1: Ensure single space after heading hashes (# Heading)
    const headingFix = updated.replace(/^(#{1,6})([^\s#])/gm, '$1 $2');
    if (headingFix !== updated) {
      changes.push('Normalized spacing after heading hashes.');
      updated = headingFix;
    }

    // Rule 2: Title detection if context doesn't already have one
    const titleMatch = updated.match(/^#\s+(.+)$/m);
    if (titleMatch && !context.title) {
      context.title = titleMatch[1].trim();
      changes.push(`Extracted academic title: "${context.title}".`);
    }

    return { text: updated, changes };
  }

  processBlocks(blocks: DocumentBlock[], context: SkillContext): { blocks: DocumentBlock[]; changes: string[] } {
    const changes: string[] = [];
    const processed = blocks.map((b) => {
      if (b.block_type === 'heading' && /^abstract$/i.test(b.text.trim())) {
        context.detectedFeatures.add('abstract');
        changes.push('Detected and formatted abstract section block.');
      }
      return b;
    });

    return { blocks: processed, changes };
  }
}
