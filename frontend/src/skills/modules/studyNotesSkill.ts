import { DocumentBlock } from '../../types/document';
import { DocumentSkill, SkillContext, SkillValidationResult } from '../types';

export class StudyNotesSkill implements DocumentSkill {
  readonly id = 'study_notes';
  readonly name = 'Study Notes';
  readonly description = 'Formats key takeaway callouts, definition boxes, review summaries, and highlighted study concepts.';
  readonly version = '1.0.0';
  readonly category = 'pedagogy' as const;
  readonly priority = 65;
  enabled: boolean = true;

  readonly rules = [
    {
      id: 'key_takeaways',
      name: 'Key Takeaways & Summaries',
      description: 'Isolates and styles "Key Concept:", "Takeaway:", or "Summary:" callout boxes.',
    },
    {
      id: 'definition_terms',
      name: 'Definition Term Highlighting',
      description: 'Formats "Definition: [term] - [meaning]" pairs into structured definition blocks.',
    },
    {
      id: 'review_checklists',
      name: 'Study Checklists & Mnemonics',
      description: 'Preserves checklist bullet conventions and mnemonic memorization devices.',
    },
  ];

  validate(text: string, _context: SkillContext): SkillValidationResult {
    return { valid: true, errors: [], warnings: [] };
  }

  processText(text: string, context: SkillContext): { text: string; changes: string[] } {
    const changes: string[] = [];
    const takeawayMatches = text.match(/\b(?:Key\s+(?:Takeaway|Concept|Idea)|Note:|Summary:|Definition:)\b/gi) || [];
    if (takeawayMatches.length > 0) {
      context.detectedFeatures.add('study_notes');
      changes.push(`Identified ${takeawayMatches.length} study note callout anchor(s).`);
    }
    return { text, changes };
  }

  processBlocks(blocks: DocumentBlock[], context: SkillContext): { blocks: DocumentBlock[]; changes: string[] } {
    if (!context.detectedFeatures.has('study_notes')) {
      return { blocks, changes: [] };
    }

    const changes: string[] = [];
    const processed = blocks.map((b) => {
      if (b.block_type === 'paragraph') {
        if (/^(?:Key\s+(?:Takeaway|Concept)|Note:|Important:)\s*(.+)/i.test(b.text)) {
          changes.push('Enhanced paragraph to study note callout box.');
          return {
            ...b,
            block_type: 'blockquote' as const,
            metadata: {
              ...(b.metadata || {}),
              is_study_callout: true,
            },
          };
        }
      }
      return b;
    });

    return { blocks: processed, changes };
  }
}
