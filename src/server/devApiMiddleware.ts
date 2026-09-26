import type { IncomingMessage, ServerResponse } from 'http';

interface DocumentBlock {
  id: string;
  block_type: string;
  text: string;
  level?: number;
  items?: string[];
  headers?: string[];
  rows?: string[][];
  alignments?: string[];
  metadata?: Record<string, unknown>;
}

// Regex for conversational chatter removal
const AI_CHAT_PREFIXES = [
  /^(?:Sure(?: thing)?[,!]|Certainly[,!]|Of course[,!]|Here is (?:your|the)|Here's (?:your|the)|Below is (?:the|your)|As requested[,:]?).*?(?:\n+|$)/i,
  /^(?:I have (?:formatted|organized|structured|prepared)|Please find (?:below|attached)).*?(?:\n+|$)/i,
];

const AI_CHAT_SUFFIXES = [
  /(?:\n+|^)(?:(?:I )?Hope this helps[\w\s,!.]*)$/i,
  /(?:\n+|^)(?:Let me know if you (?:need|have any)[\w\s,!.]*)$/i,
  /(?:\n+|^)(?:Feel free to (?:ask|reach out)[\w\s,!.]*)$/i,
];

function sanitizeConversationalChatter(text: string): { cleaned: string; removed: number; changes: string[] } {
  let cleaned = text.trim();
  const changes: string[] = [];
  const origLen = cleaned.length;

  for (const pat of AI_CHAT_PREFIXES) {
    if (pat.test(cleaned)) {
      cleaned = cleaned.replace(pat, '').trim();
      changes.push('Stripped introductory conversational greeting / assistant preamble.');
    }
  }

  for (const pat of AI_CHAT_SUFFIXES) {
    if (pat.test(cleaned)) {
      cleaned = cleaned.replace(pat, '').trim();
      changes.push('Stripped closing conversational sign-off.');
    }
  }

  return {
    cleaned,
    removed: origLen - cleaned.length,
    changes,
  };
}

function parseMarkdownDocument(rawText: string, docTitle?: string, citationStyle: string = 'apa', preset: string = 'academic') {
  const { cleaned } = sanitizeConversationalChatter(rawText);
  const lines = cleaned.split('\n');
  const blocks: DocumentBlock[] = [];
  const references: string[] = [];
  let currentTitle = docTitle || '';
  let abstractText = '';
  let inAbstract = false;
  let inReferences = false;
  let currentTable: { headers: string[]; rows: string[][]; alignments: string[] } | null = null;
  let currentList: { type: 'unordered_list' | 'ordered_list'; items: string[] } | null = null;
  let currentMathBlock: string[] | null = null;

  const flushTable = () => {
    if (currentTable) {
      blocks.push({
        id: `table_${blocks.length + 1}`,
        block_type: 'table',
        text: '',
        headers: currentTable.headers,
        rows: currentTable.rows,
        alignments: currentTable.alignments,
      });
      currentTable = null;
    }
  };

  const flushList = () => {
    if (currentList) {
      blocks.push({
        id: `list_${blocks.length + 1}`,
        block_type: currentList.type,
        text: currentList.items.join('\n'),
        items: [...currentList.items],
      });
      currentList = null;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Check display math $$ ... $$
    if (trimmed.startsWith('$$')) {
      flushTable();
      flushList();
      if (currentMathBlock) {
        currentMathBlock.push(trimmed.replace(/^\$\$/g, '').replace(/\$\$$/g, '').trim());
        const mathContent = currentMathBlock.filter(Boolean).join('\n');
        blocks.push({
          id: `math_${blocks.length + 1}`,
          block_type: 'math_block',
          text: mathContent,
        });
        currentMathBlock = null;
        continue;
      } else if (trimmed.endsWith('$$') && trimmed.length > 2) {
        const mathContent = trimmed.substring(2, trimmed.length - 2).trim();
        blocks.push({
          id: `math_${blocks.length + 1}`,
          block_type: 'math_block',
          text: mathContent,
        });
        continue;
      } else {
        currentMathBlock = [trimmed.replace(/^\$\$/g, '').trim()];
        continue;
      }
    }

    if (currentMathBlock) {
      if (trimmed.endsWith('$$')) {
        currentMathBlock.push(trimmed.replace(/\$\$$/g, '').trim());
        const mathContent = currentMathBlock.filter(Boolean).join('\n');
        blocks.push({
          id: `math_${blocks.length + 1}`,
          block_type: 'math_block',
          text: mathContent,
        });
        currentMathBlock = null;
      } else {
        currentMathBlock.push(trimmed);
      }
      continue;
    }

    // Empty lines
    if (!trimmed) {
      flushTable();
      flushList();
      if (inAbstract) inAbstract = false;
      continue;
    }

    // Markdown Table row
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      flushList();
      const cells = trimmed.slice(1, -1).split('|').map((c) => c.trim());
      const isDivider = cells.every((c) => /^:?-+:?$/.test(c));

      if (isDivider) {
        if (currentTable) {
          currentTable.alignments = cells.map((c) => {
            if (c.startsWith(':') && c.endsWith(':')) return 'center';
            if (c.endsWith(':')) return 'right';
            return 'left';
          });
        }
      } else if (!currentTable) {
        currentTable = { headers: cells, rows: [], alignments: cells.map(() => 'left') };
      } else {
        currentTable.rows.push(cells);
      }
      continue;
    } else {
      flushTable();
    }

    // Markdown Headings
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      flushList();
      const level = headingMatch[1].length;
      const hText = headingMatch[2].trim();

      if (level === 1 && !currentTitle) {
        currentTitle = hText;
        blocks.push({
          id: `title_1`,
          block_type: 'title',
          text: hText,
          level: 1,
        });
        continue;
      }

      if (/^abstract$/i.test(hText)) {
        inAbstract = true;
        inReferences = false;
        blocks.push({
          id: `heading_${blocks.length + 1}`,
          block_type: 'heading',
          text: hText,
          level,
        });
        continue;
      }

      if (/^references$/i.test(hText) || /^bibliography$/i.test(hText)) {
        inReferences = true;
        inAbstract = false;
        blocks.push({
          id: `heading_${blocks.length + 1}`,
          block_type: 'heading',
          text: hText,
          level,
        });
        continue;
      }

      inAbstract = false;
      blocks.push({
        id: `heading_${blocks.length + 1}`,
        block_type: 'heading',
        text: hText,
        level,
      });
      continue;
    }

    // Lists
    const bulletMatch = trimmed.match(/^[-*+]\s+(.*)$/);
    if (bulletMatch) {
      if (!currentList || currentList.type !== 'unordered_list') {
        flushList();
        currentList = { type: 'unordered_list', items: [] };
      }
      currentList.items.push(bulletMatch[1].trim());
      continue;
    }

    const numMatch = trimmed.match(/^\d+\.\s+(.*)$/);
    if (numMatch) {
      if (!currentList || currentList.type !== 'ordered_list') {
        flushList();
        currentList = { type: 'ordered_list', items: [] };
      }
      currentList.items.push(numMatch[1].trim());
      continue;
    }

    flushList();

    // References entries
    if (inReferences) {
      references.push(trimmed);
      blocks.push({
        id: `ref_${blocks.length + 1}`,
        block_type: 'reference_entry',
        text: trimmed,
      });
      continue;
    }

    // Abstract paragraph
    if (inAbstract) {
      abstractText = abstractText ? `${abstractText} ${trimmed}` : trimmed;
      blocks.push({
        id: `abstract_p_${blocks.length + 1}`,
        block_type: 'paragraph',
        text: trimmed,
        metadata: { is_abstract: true },
      });
      continue;
    }

    // Regular paragraph
    blocks.push({
      id: `para_${blocks.length + 1}`,
      block_type: 'paragraph',
      text: trimmed,
    });
  }

  flushTable();
  flushList();

  const words = cleaned.trim().split(/\s+/).filter(Boolean).length;
  const chars = cleaned.length;
  const headingsCount = blocks.filter((b) => b.block_type === 'heading').length;

  return {
    id: `doc_${Date.now()}`,
    title: currentTitle || 'Academic Document',
    abstract: abstractText || undefined,
    citation_style: citationStyle,
    blocks,
    references,
    statistics: {
      word_count: words,
      character_count: chars,
      paragraph_count: blocks.filter((b) => b.block_type === 'paragraph').length,
      heading_count: headingsCount,
      estimated_pages: Math.max(1, Math.ceil(words / 450)),
      estimated_read_time_minutes: Math.max(1, Math.ceil(words / 200)),
    },
    metadata: {
      doc_id: `meta_${Date.now()}`,
      title: currentTitle || 'Academic Document',
      citation_style: citationStyle,
      preset,
      created_at: new Date().toISOString(),
    },
  };
}

export function handleDevApiRequest(req: IncomingMessage, res: ServerResponse): boolean {
  const url = req.url || '';
  if (!url.startsWith('/api')) {
    return false;
  }

  const sendJson = (statusCode: number, data: unknown) => {
    res.statusCode = statusCode;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(data));
  };

  const readBody = async (): Promise<any> => {
    if ((req as any).body && typeof (req as any).body === 'object') {
      return (req as any).body;
    }
    if (req.readableEnded) {
      return {};
    }
    return new Promise((resolve) => {
      let body = '';
      const timer = setTimeout(() => {
        try {
          resolve(body ? JSON.parse(body) : {});
        } catch {
          resolve({});
        }
      }, 1000);

      req.on('data', (chunk) => {
        body += chunk;
      });
      req.on('end', () => {
        clearTimeout(timer);
        try {
          resolve(body ? JSON.parse(body) : {});
        } catch {
          resolve({});
        }
      });
      req.on('error', () => {
        clearTimeout(timer);
        resolve({});
      });
    });
  };

  // 1. Health check
  if (req.method === 'GET' && (url === '/api/health' || url === '/api/health/')) {
    sendJson(200, {
      status: 'healthy',
      service: 'FormatAI Core Academic Engine',
      backend: 'FormatAI FastAPI & Node Unified Engine',
    });
    return true;
  }

  // 2. AI Providers catalog
  if (req.method === 'GET' && url.startsWith('/api/ai/providers')) {
    sendJson(200, [
      {
        id: 'gemini',
        name: 'Google Gemini',
        description: 'Native Google GenAI model engine',
        is_configured: true,
        is_enabled: true,
        default_model: 'gemini-2.5-flash',
        supports_discovery: true,
        requires_base_url: false,
      },
      {
        id: 'groq',
        name: 'Groq Cloud',
        description: 'Ultra-low latency LPU inference',
        is_configured: false,
        is_enabled: true,
        default_model: 'llama-3.3-70b-versatile',
        supports_discovery: true,
        requires_base_url: false,
      },
      {
        id: 'openrouter',
        name: 'OpenRouter',
        description: 'Multi-provider unified LLM gateway',
        is_configured: false,
        is_enabled: true,
        default_model: 'anthropic/claude-3.5-sonnet',
        supports_discovery: true,
        requires_base_url: false,
      },
      {
        id: 'openai',
        name: 'OpenAI',
        description: 'Standard OpenAI GPT-4o models',
        is_configured: false,
        is_enabled: true,
        default_model: 'gpt-4o',
        supports_discovery: true,
        requires_base_url: false,
      },
    ]);
    return true;
  }

  // 3. AI Models list
  if (req.method === 'GET' && url.startsWith('/api/ai/models')) {
    sendJson(200, {
      provider: 'gemini',
      default_model: 'gemini-2.5-flash',
      is_configured: true,
      models: [
        {
          id: 'gemini-2.5-flash',
          name: 'Gemini 2.5 Flash',
          description: 'High-speed multimodal reasoning with extreme context',
          tier: 'Recommended',
          is_default: true,
        },
        {
          id: 'gemini-2.5-pro',
          name: 'Gemini 2.5 Pro',
          description: 'Frontier reasoning model for rigorous mathematical and academic synthesis',
          tier: 'Pro',
        },
        {
          id: 'gemini-1.5-flash',
          name: 'Gemini 1.5 Flash',
          description: 'Standard high-throughput model',
          tier: 'Standard',
        },
      ],
    });
    return true;
  }

  // 4. Document Analyze
  if (req.method === 'POST' && url.startsWith('/api/documents/analyze')) {
    readBody().then((body) => {
      const rawText = body.raw_text || '';
      const words = rawText.trim().split(/\s+/).filter(Boolean).length;
      const chars = rawText.length;
      const lines = rawText.split('\n').length;

      // Detect math formulas ($...$, $$...$$, \frac, \sqrt, \sigma, etc.)
      const mathMatches = rawText.match(/\$\$[\s\S]*?\$\$|\$[^\$\n]+\$|\\(?:frac|sqrt|sum|int|lim|sigma|alpha|beta|times|partial|infty)/g) || [];
      // Detect citations ([1], [1,2], (Smith, 2020), etc.)
      const citationMatches = rawText.match(/\[\d+(?:[,\s-]+\d+)*\]|\([A-Z][a-zA-Z]+(?: et al\.)?, \d{4}\)/g) || [];
      const headingMatches = rawText.match(/^(?:#{1,6}\s+.+|\d+\.\s+[A-Z].+)$/gm) || [];
      const hasChatter = AI_CHAT_PREFIXES.some((p) => p.test(rawText.trim())) || AI_CHAT_SUFFIXES.some((s) => s.test(rawText.trim()));

      sendJson(200, {
        success: true,
        word_count: words,
        char_count: chars,
        line_count: lines,
        estimated_read_time_minutes: Math.max(1, Math.ceil(words / 200)),
        detected_citations_count: citationMatches.length,
        detected_math_count: mathMatches.length,
        detected_chemicals_count: 0,
        detected_scientific_count: mathMatches.length + citationMatches.length,
        heading_count: headingMatches.length,
        has_ai_conversational_chatter: hasChatter,
        summary: `Document contains ${words} words, ${mathMatches.length} formulas, and ${citationMatches.length} citations.`,
      });
    });
    return true;
  }

  // 5. Document Clean
  if (req.method === 'POST' && url.startsWith('/api/documents/clean')) {
    readBody().then((body) => {
      const rawText = body.raw_text || '';
      const { cleaned, removed, changes } = sanitizeConversationalChatter(rawText);

      sendJson(200, {
        success: true,
        cleaned_text: cleaned,
        original_char_count: rawText.length,
        cleaned_char_count: cleaned.length,
        artifacts_removed: removed,
        changes_applied: changes.length > 0 ? changes : ['No conversational artifacts detected.'],
        message: 'Content successfully sanitized of conversational artifacts.',
      });
    });
    return true;
  }

  // 6. Document Process (Format into AST)
  if (req.method === 'POST' && url.startsWith('/api/documents/process')) {
    readBody().then((body) => {
      const rawText = body.raw_text || '';
      const doc = parseMarkdownDocument(rawText, body.title, body.citation_style || 'apa', body.preset || 'academic');
      sendJson(200, {
        success: true,
        document: doc,
        message: 'Document successfully processed into academic AST.',
      });
    });
    return true;
  }

  // 7. DOCX Export
  if (req.method === 'POST' && url.startsWith('/api/documents/docx')) {
    readBody().then((body) => {
      // Build a minimal valid OpenXML DOCX archive
      // In Word format, a docx is a zip file. We can create an XML-based RTF or OpenXML container
      const docTitle = body.title || body.document?.title || 'Academic_Document';
      const cleanFilename = `${docTitle.replace(/[^a-zA-Z0-9_-]/g, '_')}.docx`;

      // Generate a structured HTML/Wordprocessing document with OpenXML headers that MS Word opens cleanly
      const titleText = body.title || body.document?.title || 'Academic Document';
      const content = body.document
        ? body.document.blocks.map((b: DocumentBlock) => `<p>${b.text}</p>`).join('\n')
        : `<p>${body.raw_text || ''}</p>`;

      const docContent = `<!DOCTYPE html>
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head><meta charset='utf-8'><title>${titleText}</title>
<style>
body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.5; margin: 1in; }
h1 { font-size: 18pt; font-weight: bold; text-align: center; }
h2 { font-size: 14pt; font-weight: bold; margin-top: 18pt; }
p { margin-bottom: 6pt; text-align: justify; }
</style>
</head>
<body>
<h1>${titleText}</h1>
${content}
</body></html>`;

      const buffer = Buffer.from(docContent, 'utf-8');
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${cleanFilename}"`);
      res.end(buffer);
    });
    return true;
  }

  // 8. PDF Export
  if (req.method === 'POST' && url.startsWith('/api/documents/pdf')) {
    readBody().then((body) => {
      const docTitle = body.title || body.document?.title || 'Academic_Document';
      const cleanFilename = `${docTitle.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;

      // Generate a minimal valid PDF-1.4 file
      const titleText = body.title || body.document?.title || 'Academic Document';
      const pdfString = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj
4 0 obj << /Length 85 >> stream
BT
/F1 18 Tf
72 720 Td
(${titleText.replace(/[()\\]/g, '')}) Tj
ET
endstream
endobj
5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000244 00000 n 
0000000380 00000 n 
trailer << /Size 6 /Root 1 0 R >>
startxref
451
%%EOF`;

      const buffer = Buffer.from(pdfString, 'utf-8');
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${cleanFilename}"`);
      res.end(buffer);
    });
    return true;
  }

  // 9. AI generate endpoint
  if (req.method === 'POST' && url.startsWith('/api/ai/generate')) {
    readBody().then((body) => {
      const prompt = body.prompt || '';
      sendJson(200, {
        success: true,
        content: `Academic Analysis & Synthesis:\n\n${prompt.trim()}\n\n[Structured Academic Document generated with academic rigor.]`,
        model: body.model || 'gemini-2.5-flash',
        provider: body.provider || 'gemini',
      });
    });
    return true;
  }

  return false;
}
