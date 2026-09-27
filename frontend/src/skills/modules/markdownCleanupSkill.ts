import { DocumentBlock } from '../../types/document';
import { DocumentSkill, SkillContext, SkillValidationResult } from '../types';

export class MarkdownCleanupSkill implements DocumentSkill {
  readonly id = 'markdown_cleanup';
  readonly name = 'Markdown Cleanup';
  readonly description = 'Strips conversational AI assistant intros/signoffs ("Sure thing!", "Hope this helps!"), removes broken divider artifacts, and normalizes spacing.';
  readonly version = '1.3.0';
  readonly category = 'cleanup' as const;
  readonly priority = 10; // Runs FIRST!
  enabled: boolean = true;

  readonly rules = [
    {
      id: 'conversational_intro_removal',
      name: 'Conversational Intro Denoising',
      description: 'Removes greetings like "Sure thing! Here is...", "Certainly, below is...", "Of course!", etc.',
    },
    {
      id: 'conversational_outro_removal',
      name: 'Conversational Sign-off Denoising',
      description: 'Removes closing noise like "Hope this helps!", "Let me know if you need anything else!".',
    },
    {
      id: 'spurious_dividers',
      name: 'Spurious Horizontal Divider Compression',
      description: 'Compresses runs of multiple horizontal rules (---, ***, ___) to avoid awkward blank gaps.',
    },
    {
      id: 'trailing_whitespace',
      name: 'Trailing Whitespace Stripping',
      description: 'Removes invisible trailing spaces and compresses multiple blank lines into standard dual-newlines.',
    },
  ];

  validate(text: string, _context: SkillContext): SkillValidationResult {
    return { valid: true, errors: [], warnings: [] };
  }

  processText(text: string, context: SkillContext): { text: string; changes: string[] } {
    const changes: string[] = [];
    let updated = text.trim();
    const origLen = updated.length;

    // Rule 1: Remove introductory conversational greetings/prefixes
    const AI_PREFIXES = [
      /^(?:Sure(?: thing)?[,!]|Certainly[,!]|Of course[,!]|Here is (?:your|the)|Here's (?:your|the)|Below is (?:the|your)|As requested[,:]?).*?(?:\n+|$)/i,
      /^(?:I have (?:formatted|organized|structured|prepared)|Please find (?:below|attached)).*?(?:\n+|$)/i,
    ];

    for (const pat of AI_PREFIXES) {
      if (pat.test(updated)) {
        updated = updated.replace(pat, '').trim();
        changes.push('Stripped introductory conversational greeting / assistant preamble.');
      }
    }

    // Rule 2: Remove concluding conversational sign-offs
    const AI_SUFFIXES = [
      /(?:\n+|^)(?:(?:I )?Hope this helps[\w\s,!.]*)$/i,
      /(?:\n+|^)(?:Let me know if you (?:need|have any)[\w\s,!.]*)$/i,
      /(?:\n+|^)(?:Feel free to (?:ask|reach out)[\w\s,!.]*)$/i,
    ];

    for (const pat of AI_SUFFIXES) {
      if (pat.test(updated)) {
        updated = updated.replace(pat, '').trim();
        changes.push('Stripped closing conversational sign-off.');
      }
    }

    // Rule 3: Compress triple or more newlines into double newlines
    if (/\n{3,}/.test(updated)) {
      updated = updated.replace(/\n{3,}/g, '\n\n');
      changes.push('Compressed irregular blank line gaps.');
    }

    // Rule 4: Strip redundant multiple dividers (--- \n ---)
    if (/(?:^|\n)-{3,}(?:\n\s*-{3,})+/g.test(updated)) {
      updated = updated.replace(/(?:^|\n)-{3,}(?:\n\s*-{3,})+/g, '\n---');
      changes.push('Collapsed consecutive horizontal divider lines.');
    }

    if (updated.length < origLen) {
      context.detectedFeatures.add('denoised');
    }

    return { text: updated, changes };
  }

  processBlocks(blocks: DocumentBlock[], _context: SkillContext): { blocks: DocumentBlock[]; changes: string[] } {
    // Remove empty paragraphs
    const filtered = blocks.filter((b) => {
      if (b.block_type === 'paragraph' && !b.text.trim()) return false;
      return true;
    });

    const changes = filtered.length !== blocks.length
      ? [`Removed ${blocks.length - filtered.length} empty phantom blocks.`]
      : [];

    return { blocks: filtered, changes };
  }
}
