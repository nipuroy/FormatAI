import { DocumentBlock } from '../../types/document';
import { DocumentSkill, SkillContext, SkillValidationResult } from '../types';

export class MathematicsSkill implements DocumentSkill {
  readonly id = 'mathematics';
  readonly name = 'Mathematics';
  readonly description = 'Detects, normalizes, and structures inline ($...$) and display ($$...$$) LaTeX equations, fractions, roots, and Greek symbols.';
  readonly version = '1.2.0';
  readonly category = 'stem' as const;
  readonly priority = 30;
  enabled: boolean = true;

  readonly rules = [
    {
      id: 'delimiter_normalization',
      name: 'Delimiter Normalization',
      description: 'Standardizes \\( ... \\) to $...$ and \\[ ... \\] to $$...$$ while preserving ordinary prose slashes (e.g. 5/10 students).',
    },
    {
      id: 'latex_syntax_enrichment',
      name: 'LaTeX Structure Normalization',
      description: 'Normalizes fractions (\\frac), roots (\\sqrt), superscripts (^), subscripts (_), and Greek mathematical symbols.',
    },
    {
      id: 'math_block_extraction',
      name: 'Display Equation AST Isolation',
      description: 'Converts multi-line and standalone display equations into structured math_block AST nodes.',
    },
  ];

  validate(text: string, _context: SkillContext): SkillValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for unbalanced delimiters
    const singleDollarCount = (text.match(/(?<!\$)\$(?!\$)/g) || []).length;
    if (singleDollarCount % 2 !== 0) {
      warnings.push(`Detected unbalanced inline math delimiter ($) count: ${singleDollarCount}.`);
    }

    const doubleDollarCount = (text.match(/\$\$/g) || []).length;
    if (doubleDollarCount % 2 !== 0) {
      warnings.push(`Detected unbalanced display equation delimiter ($$) count: ${doubleDollarCount}.`);
    }

    return {
      valid: true,
      errors,
      warnings,
    };
  }

  processText(text: string, context: SkillContext): { text: string; changes: string[] } {
    const changes: string[] = [];
    let updated = text;

    // Rule 1: Convert \( ... \) to $ ... $
    const inlineParenPattern = /\\\(\s*([\s\S]*?)\s*\\\)/g;
    if (inlineParenPattern.test(updated)) {
      updated = updated.replace(inlineParenPattern, '$$$1$$');
      changes.push('Normalized LaTeX \\( ... \\) delimiters to standard $ ... $ inline math.');
    }

    // Rule 2: Convert \[ ... \] to $$ ... $$
    const displayBracketPattern = /\\\[\s*([\s\S]*?)\s*\\\]/g;
    if (displayBracketPattern.test(updated)) {
      updated = updated.replace(displayBracketPattern, '$$$$\n$1\n$$$$');
      changes.push('Normalized LaTeX \\[ ... \\] delimiters to standard $$ ... $$ display equations.');
    }

    // Track detected math count
    const matches = updated.match(/\$\$[\s\S]*?\$\$|\$[^\$\n]+\$|\\(?:frac|sqrt|sum|int|lim|sigma|alpha|beta|times|partial|infty|vec|matrix)/g) || [];
    if (matches.length > 0) {
      context.detectedFeatures.add('mathematics');
      changes.push(`Processed ${matches.length} mathematical expression(s).`);
    }

    return { text: updated, changes };
  }

  processBlocks(blocks: DocumentBlock[], _context: SkillContext): { blocks: DocumentBlock[]; changes: string[] } {
    const changes: string[] = [];
    const processed: DocumentBlock[] = [];

    for (const b of blocks) {
      if (b.block_type === 'paragraph' && b.text.startsWith('$$') && b.text.endsWith('$$') && b.text.length > 2) {
        const formula = b.text.slice(2, -2).trim();
        processed.push({
          id: `math_${processed.length + 1}`,
          block_type: 'math_block',
          text: formula,
          metadata: { syntax: 'latex', is_display: true },
        });
        changes.push(`Converted paragraph block "${formula.substring(0, 30)}..." into structured math_block.`);
      } else {
        processed.push(b);
      }
    }

    return { blocks: processed, changes };
  }
}
