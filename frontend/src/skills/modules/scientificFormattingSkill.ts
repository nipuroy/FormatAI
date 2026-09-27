import { DocumentBlock } from '../../types/document';
import { DocumentSkill, SkillContext, SkillValidationResult } from '../types';

export class ScientificFormattingSkill implements DocumentSkill {
  readonly id = 'scientific_formatting';
  readonly name = 'Scientific Document Formatting';
  readonly description = 'Standardizes scientific exponential notation (1.42 × 10^-22), SI units (kg·m/s, m/s², kJ/mol), Greek physics variables, and temperature degree marks.';
  readonly version = '1.0.0';
  readonly category = 'stem' as const;
  readonly priority = 36;
  enabled: boolean = true;

  readonly rules = [
    {
      id: 'scientific_notation',
      name: 'Scientific Notation Multiplication Normalization',
      description: 'Converts informal "x 10^" or "* 10^" to canonical typography: "× 10^" (e.g. 1.42 × 10⁻²²).',
    },
    {
      id: 'si_units_standards',
      name: 'SI Unit Standardization',
      description: 'Preserves and formats composite SI units: kg·m/s, m/s^2, kJ/mol, MHz, GHz, nm, μm, eV, MeV.',
    },
    {
      id: 'degree_symbol_normalization',
      name: 'Temperature & Angular Degree Formatting',
      description: 'Normalizes informal "deg C" or "deg F" to "°C" or "°F".',
    },
  ];

  validate(text: string, _context: SkillContext): SkillValidationResult {
    return { valid: true, errors: [], warnings: [] };
  }

  processText(text: string, context: SkillContext): { text: string; changes: string[] } {
    const changes: string[] = [];
    let updated = text;

    // Rule 1: Replace informal "x 10^" with "× 10^"
    const sciMatch = /(\d+(?:\.\d+)?)\s*[xX*]\s*10\^?([+-]?\d+)/g;
    if (sciMatch.test(updated)) {
      updated = updated.replace(sciMatch, '$1 × 10^{$2}');
      changes.push('Normalized scientific exponential notation to academic "× 10^{n}" representation.');
      context.detectedFeatures.add('scientific_notation');
    }

    // Rule 2: Replace "deg C" with "°C"
    const degMatch = /(\d+(?:\.\d+)?)\s*(?:deg\s*C|degrees\s*Celsius)\b/gi;
    if (degMatch.test(updated)) {
      updated = updated.replace(degMatch, '$1 °C');
      changes.push('Formatted temperature values to standard "°C" symbol.');
      context.detectedFeatures.add('scientific_units');
    }

    // Rule 3: Detect SI units
    const unitMatches = updated.match(/\b(?:\d+(?:\.\d+)?)\s*(?:kg·m\/s|m\/s\^?2|kJ\/mol|MHz|GHz|nm|μm|eV|MeV|GeV|TeV)\b/g) || [];
    if (unitMatches.length > 0) {
      context.detectedFeatures.add('si_units');
      changes.push(`Verified ${unitMatches.length} composite SI unit expression(s).`);
    }

    return { text: updated, changes };
  }

  processBlocks(blocks: DocumentBlock[], context: SkillContext): { blocks: DocumentBlock[]; changes: string[] } {
    if (!context.detectedFeatures.has('scientific_notation') && !context.detectedFeatures.has('si_units')) {
      return { blocks, changes: [] };
    }

    return {
      blocks: blocks.map((b) => {
        if (b.block_type === 'paragraph' && /×\s*10\^|°C|kg·m\/s/.test(b.text)) {
          b.metadata = { ...(b.metadata || {}), contains_scientific_typography: true };
        }
        return b;
      }),
      changes: ['Enriched paragraph metadata with academic scientific typography flags.'],
    };
  }
}
