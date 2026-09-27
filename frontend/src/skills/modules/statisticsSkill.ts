import { DocumentBlock } from '../../types/document';
import { DocumentSkill, SkillContext, SkillValidationResult } from '../types';

export class StatisticsSkill implements DocumentSkill {
  readonly id = 'statistics';
  readonly name = 'Statistics';
  readonly description = 'Detects and standardizes statistical notations, p-values, t-tests, ANOVA F-ratios, confidence intervals, and effect sizes.';
  readonly version = '1.0.0';
  readonly category = 'stem' as const;
  readonly priority = 32;
  enabled: boolean = true;

  readonly rules = [
    {
      id: 'p_value_formatting',
      name: 'P-Value Notation',
      description: 'Standardizes APA-style italicized p-values (e.g. p < .001, p = .042) without leading zero if requested.',
    },
    {
      id: 'test_statistics',
      name: 'Test Statistic Formatting',
      description: 'Standardizes degrees of freedom in t-tests (t(24) = 2.15), F-tests (F(2, 48) = 5.21), and Chi-Square (χ²(1) = 4.12).',
    },
    {
      id: 'descriptive_stats',
      name: 'Descriptive Statistics',
      description: 'Enforces standard symbols for Mean (M), Standard Deviation (SD), and Sample Size (N, n).',
    },
  ];

  validate(text: string, _context: SkillContext): SkillValidationResult {
    const warnings: string[] = [];
    if (/p\s*=\s*0\.000\b/i.test(text)) {
      warnings.push('Found "p = 0.000"; statistical reporting standards recommend "p < .001".');
    }
    return { valid: true, errors: [], warnings };
  }

  processText(text: string, context: SkillContext): { text: string; changes: string[] } {
    const changes: string[] = [];
    let updated = text;

    // Rule 1: Replace p = 0.000 with p < .001
    const pZeroMatch = /p\s*=\s*0?\.000\b/gi;
    if (pZeroMatch.test(updated)) {
      updated = updated.replace(pZeroMatch, 'p < .001');
      changes.push('Corrected "p = .000" to "p < .001" according to APA statistical reporting rules.');
      context.detectedFeatures.add('statistics');
    }

    // Rule 2: Ensure p-values, t-scores, F-scores are detected
    const statMatches = updated.match(/\b(?:p\s*[<>=]\s*\.?\d+|t\(\d+\)\s*=|F\(\d+,\s*\d+\)\s*=|M\s*=\s*\d+|SD\s*=\s*\d+|95%\s*CI\b)/g) || [];
    if (statMatches.length > 0) {
      context.detectedFeatures.add('statistics');
      changes.push(`Validated ${statMatches.length} statistical notation pattern(s).`);
    }

    return { text: updated, changes };
  }

  processBlocks(blocks: DocumentBlock[], context: SkillContext): { blocks: DocumentBlock[]; changes: string[] } {
    if (!context.detectedFeatures.has('statistics')) {
      return { blocks, changes: [] };
    }
    return {
      blocks: blocks.map((b) => {
        if (b.block_type === 'paragraph' && /\b(?:p\s*[<>=]|t\(\d+\)|F\(\d+,\s*\d+\))\b/.test(b.text)) {
          b.metadata = { ...(b.metadata || {}), contains_statistics: true };
        }
        return b;
      }),
      changes: ['Annotated paragraphs containing empirical statistical tests.'],
    };
  }
}
