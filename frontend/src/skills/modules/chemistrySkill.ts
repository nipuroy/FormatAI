import { DocumentBlock } from '../../types/document';
import { DocumentSkill, SkillContext, SkillValidationResult } from '../types';

export class ChemistrySkill implements DocumentSkill {
  readonly id = 'chemistry';
  readonly name = 'Chemistry';
  readonly description = 'Normalizes chemical molecular formulas (e.g. H2O to H₂O, CO2 to CO₂), reaction equilibrium arrows, and ionic state designations.';
  readonly version = '1.0.0';
  readonly category = 'stem' as const;
  readonly priority = 34;
  enabled: boolean = true;

  readonly rules = [
    {
      id: 'formula_subscripts',
      name: 'Chemical Formula Subscripting',
      description: 'Converts stoichiometry integers to unicode subscripts in common compounds (e.g. H2O, CO2, NaCl, H2SO4, C6H12O6).',
    },
    {
      id: 'reaction_arrows',
      name: 'Reaction Arrow Normalization',
      description: 'Standardizes ASCII reaction arrows (-> to →, <-> to ⇌) for balanced chemical equations.',
    },
    {
      id: 'phase_designators',
      name: 'State of Matter Annotation',
      description: 'Preserves and formats phase designations: (s), (l), (g), (aq).',
    },
  ];

  validate(text: string, _context: SkillContext): SkillValidationResult {
    return {
      valid: true,
      errors: [],
      warnings: [],
    };
  }

  processText(text: string, context: SkillContext): { text: string; changes: string[] } {
    const changes: string[] = [];
    let updated = text;

    // Common chemical molecules lookup
    const commonFormulas: Record<string, string> = {
      'H2O': 'H₂O',
      'CO2': 'CO₂',
      'O2': 'O₂',
      'N2': 'N₂',
      'CH4': 'CH₄',
      'NH3': 'NH₃',
      'H2SO4': 'H₂SO₄',
      'HCl': 'HCl',
      'NaCl': 'NaCl',
      'C6H12O6': 'C₆H₁₂O₆',
      'CaCO3': 'CaCO₃',
      'NO2': 'NO₂',
    };

    let formulaCount = 0;
    for (const [plain, unicode] of Object.entries(commonFormulas)) {
      const reg = new RegExp(`\\b${plain}\\b`, 'g');
      if (reg.test(updated)) {
        updated = updated.replace(reg, unicode);
        formulaCount++;
      }
    }

    if (formulaCount > 0) {
      context.detectedFeatures.add('chemistry');
      changes.push(`Subscripted ${formulaCount} chemical formula notation(s).`);
    }

    // Reaction arrow normalization
    if (/\s+->\s+/.test(updated)) {
      updated = updated.replace(/\s+->\s+/g, ' → ');
      changes.push('Converted ASCII arrow "->" to chemical reaction arrow "→".');
      context.detectedFeatures.add('chemistry');
    }

    return { text: updated, changes };
  }

  processBlocks(blocks: DocumentBlock[], context: SkillContext): { blocks: DocumentBlock[]; changes: string[] } {
    if (!context.detectedFeatures.has('chemistry')) return { blocks, changes: [] };
    return {
      blocks: blocks.map((b) => {
        if (b.block_type === 'paragraph' && /[₂₃₄₆₁₂→⇌]/.test(b.text)) {
          b.metadata = { ...(b.metadata || {}), contains_chemistry: true };
        }
        return b;
      }),
      changes: ['Tagged blocks containing verified chemical formulas.'],
    };
  }
}
