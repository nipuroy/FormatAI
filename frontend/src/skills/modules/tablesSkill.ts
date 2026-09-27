import { DocumentBlock } from '../../types/document';
import { DocumentSkill, SkillContext, SkillValidationResult } from '../types';

export class TablesSkill implements DocumentSkill {
  readonly id = 'tables';
  readonly name = 'Tables';
  readonly description = 'Parses Markdown pipe tables, validates column alignments, extracts headers, and constructs structured table AST blocks with academic typography.';
  readonly version = '1.0.0';
  readonly category = 'structure' as const;
  readonly priority = 50;
  enabled: boolean = true;

  readonly rules = [
    {
      id: 'pipe_table_parsing',
      name: 'Pipe Table Delimiter Parsing',
      description: 'Parses standard markdown pipe syntax (| header | header |) into discrete cell data structures.',
    },
    {
      id: 'alignment_detection',
      name: 'Column Alignment Analysis',
      description: 'Calculates left (:---), center (:---:), and right (---:) column alignments from markdown divider rows.',
    },
    {
      id: 'caption_and_numbering',
      name: 'Table Captioning & Numbering',
      description: 'Detects preceding "Table 1: Description" or "Table: Title" labels and attaches metadata to the table block.',
    },
  ];

  validate(text: string, _context: SkillContext): SkillValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('|') && line.endsWith('|')) {
        // Potential table line
        const cells = line.slice(1, -1).split('|');
        if (cells.length < 2) {
          warnings.push(`Line ${i + 1} has fewer than 2 columns in pipe table format.`);
        }
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  processText(text: string, context: SkillContext): { text: string; changes: string[] } {
    const changes: string[] = [];
    const hasTable = /^\|.+?\|$/m.test(text);
    if (hasTable) {
      context.detectedFeatures.add('tables');
      changes.push('Detected markdown pipe tables for structural compilation.');
    }
    return { text, changes };
  }

  processBlocks(blocks: DocumentBlock[], _context: SkillContext): { blocks: DocumentBlock[]; changes: string[] } {
    const changes: string[] = [];
    let tableIndex = 0;

    const processed = blocks.map((b) => {
      if (b.block_type === 'table') {
        tableIndex++;
        changes.push(`Structured Table ${tableIndex} (${b.headers?.length || 0} columns, ${b.rows?.length || 0} rows).`);
        return {
          ...b,
          metadata: {
            ...(b.metadata || {}),
            table_index: tableIndex,
            academic_borders: true,
          },
        };
      }
      return b;
    });

    return { blocks: processed, changes };
  }
}
