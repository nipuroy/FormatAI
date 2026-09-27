import { DocumentBlock } from '../../types/document';
import { DocumentSkill, SkillContext, SkillValidationResult } from '../types';

export class CitationReferencesSkill implements DocumentSkill {
  readonly id = 'citation_references';
  readonly name = 'Citation/References';
  readonly description = 'Detects, validates, and standardizes in-text citations ([1], [2-4], Author (Year)) and formats bibliography entries according to academic styles (APA, IEEE, MLA).';
  readonly version = '1.1.0';
  readonly category = 'formatting' as const;
  readonly priority = 45;
  enabled: boolean = true;

  readonly rules = [
    {
      id: 'in_text_citation_detection',
      name: 'In-Text Citation Parsing',
      description: 'Detects numeric bracket citations ([1], [1, 2]) and parenthetical author-date citations (Smith, 2021).',
    },
    {
      id: 'reference_section_isolation',
      name: 'Reference List Isolation',
      description: 'Separates bibliography entries into distinct reference_entry AST blocks with hanging indent metadata.',
    },
    {
      id: 'doi_and_url_formatting',
      name: 'DOI / URL Canonicalization',
      description: 'Standardizes DOI prefixes (https://doi.org/...) and cleans dangling punctuation in bibliographic links.',
    },
  ];

  validate(text: string, _context: SkillContext): SkillValidationResult {
    const warnings: string[] = [];
    const hasInText = /\[\d+\]|\([A-Z][a-zA-Z]+(?: et al\.)?, \d{4}\)/.test(text);
    const hasRefHeading = /^(?:#{1,3}\s+)?(?:references|bibliography)\b/im.test(text);

    if (hasInText && !hasRefHeading) {
      warnings.push('Document contains in-text citations but no dedicated "References" or "Bibliography" section.');
    }

    return { valid: true, errors: [], warnings };
  }

  processText(text: string, context: SkillContext): { text: string; changes: string[] } {
    const changes: string[] = [];
    let updated = text;

    // Standardize DOI formats: doi: 10.xxx -> https://doi.org/10.xxx
    const doiMatch = /\bdoi:\s*(10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+)/gi;
    if (doiMatch.test(updated)) {
      updated = updated.replace(doiMatch, 'https://doi.org/$1');
      changes.push('Normalized raw DOI strings into canonical https://doi.org/ URLs.');
    }

    const citationMatches = updated.match(/\[\d+(?:[,\s-]+\d+)*\]|\([A-Z][a-zA-Z]+(?: et al\.)?, \d{4}\)/g) || [];
    if (citationMatches.length > 0) {
      context.detectedFeatures.add('citations');
      changes.push(`Indexed ${citationMatches.length} academic in-text citation marker(s).`);
    }

    return { text: updated, changes };
  }

  processBlocks(blocks: DocumentBlock[], context: SkillContext): { blocks: DocumentBlock[]; changes: string[] } {
    const changes: string[] = [];
    let inReferences = false;
    const processed: DocumentBlock[] = [];

    for (const b of blocks) {
      if (b.block_type === 'heading' && /^(?:references|bibliography|works cited)$/i.test(b.text.trim())) {
        inReferences = true;
        processed.push(b);
        continue;
      }

      if (inReferences) {
        // Any non-heading paragraph in reference section becomes reference_entry
        if (b.block_type === 'paragraph' && b.text.trim().length > 0) {
          processed.push({
            ...b,
            block_type: 'reference_entry',
            metadata: {
              ...(b.metadata || {}),
              citation_style: context.citationStyle || 'apa',
              hanging_indent: true,
            },
          });
          changes.push(`Formatted bibliography entry: "${b.text.substring(0, 30)}..."`);
          continue;
        }
      }

      processed.push(b);
    }

    return { blocks: processed, changes };
  }
}
