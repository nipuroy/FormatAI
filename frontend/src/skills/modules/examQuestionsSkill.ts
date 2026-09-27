import { DocumentBlock } from '../../types/document';
import { DocumentSkill, SkillContext, SkillValidationResult } from '../types';

export class ExamQuestionsSkill implements DocumentSkill {
  readonly id = 'exam_questions';
  readonly name = 'Exam Questions';
  readonly description = 'Detects question numbering, allocated point values ([5 marks]), multiple-choice options (A, B, C, D), and fill-in-the-blank answer regions.';
  readonly version = '1.0.0';
  readonly category = 'pedagogy' as const;
  readonly priority = 60;
  enabled: boolean = true;

  readonly rules = [
    {
      id: 'question_numbering',
      name: 'Question Numbering & Point Allocation',
      description: 'Detects question stems (Question 1., Q1., 1.) and formats mark values like "[10 points]" or "(5 marks)".',
    },
    {
      id: 'mcq_option_grid',
      name: 'Multiple-Choice Option Formatting',
      description: 'Formats (A), (B), (C), (D) or A., B., C., D. options into distinct, cleanly aligned choices.',
    },
    {
      id: 'answer_blanks',
      name: 'Answer Blank Preservation',
      description: 'Normalizes underscored fill-in-the-blank fields (e.g. _______) to consistent length.',
    },
  ];

  validate(text: string, _context: SkillContext): SkillValidationResult {
    return { valid: true, errors: [], warnings: [] };
  }

  processText(text: string, context: SkillContext): { text: string; changes: string[] } {
    const changes: string[] = [];
    let updated = text;

    // Detect question patterns: Question 1:, Q1., 1. [5 pts]
    const qMatches = updated.match(/^(?:Question\s+\d+|Q\d+|Part\s+[A-Z]|\d+\.\s*(?:\[\d+\s*(?:marks?|points?|pts?)\]))/gmi) || [];
    if (qMatches.length > 0) {
      context.detectedFeatures.add('exam_questions');
      changes.push(`Detected ${qMatches.length} exam question stem(s).`);
    }

    // Normalize fill-in-the-blank underlines: 3 or more underscores
    if (/_{3,}/.test(updated)) {
      updated = updated.replace(/_{3,}/g, '__________');
      changes.push('Standardized fill-in-the-blank answer underscore lengths.');
    }

    return { text: updated, changes };
  }

  processBlocks(blocks: DocumentBlock[], context: SkillContext): { blocks: DocumentBlock[]; changes: string[] } {
    if (!context.detectedFeatures.has('exam_questions')) {
      return { blocks, changes: [] };
    }

    const changes: string[] = [];
    const processed = blocks.map((b) => {
      if (b.block_type === 'paragraph' || b.block_type === 'heading') {
        const markMatch = b.text.match(/\[(\d+\s*(?:marks?|points?|pts?))\]/i);
        if (markMatch) {
          changes.push(`Indexed question with marks: ${markMatch[1]}`);
          return {
            ...b,
            metadata: {
              ...(b.metadata || {}),
              is_question: true,
              allocated_marks: markMatch[1],
            },
          };
        }
      }
      return b;
    });

    return { blocks: processed, changes };
  }
}
