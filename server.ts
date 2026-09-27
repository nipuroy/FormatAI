import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { skillRegistry } from './frontend/src/skills/SkillRegistry';
import { skillOrchestrator } from './frontend/src/skills/SkillOrchestrator';
import { generateDocxBuffer } from './src/server/docxGenerator';
import { AcademicDocument } from './frontend/src/types/document';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// High payload limit to handle large academic manuscripts and theses without 413 errors
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// CORS and Security Headers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// ==========================================
// 1. Health & Status
// ==========================================
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'FormatAI',
    backend: 'python',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// ==========================================
// 2. Document Analysis & Cleaning
// ==========================================
app.post('/api/documents/analyze', (req: Request, res: Response) => {
  try {
    const rawText = String(req.body.raw_text || '');
    const words = rawText.trim().split(/\s+/).filter(Boolean).length;
    const chars = rawText.length;
    const lines = rawText.split('\n').length;
    const headings = (rawText.match(/^#{1,6}\s+.+$/gm) || []).length;
    const mathExpressions = (rawText.match(/\$[^$]+\$|\$\$[\s\S]+?\$\$/g) || []).length;
    const citations = (rawText.match(/\([A-Z][a-z]+(?:\s+et\s+al\.)?,\s*\d{4}\)|\[\d+\]|doi:\s*\S+/gi) || []).length;
    const chemicals = (rawText.match(/\b(?:H2O|CO2|NaCl|H2SO4|CaCO3|CH4|C6H12O6)\b/g) || []).length;
    const scientific = (rawText.match(/\b\d+(?:\.\d+)?\s*(?:kg|kHz|MHz|GHz|nm|µm|cm|mm|m\/s|kJ|kPa|mol)\b/g) || []).length;
    const hasAiChatter = /(?:sure(?: thing)?|here is (?:the|your)|hope this helps|let me know if you need)/i.test(rawText);

    res.json({
      success: true,
      word_count: words,
      char_count: chars,
      line_count: lines,
      estimated_read_time_minutes: Math.max(1, Math.ceil(words / 200)),
      detected_citations_count: citations,
      detected_math_count: mathExpressions,
      detected_chemicals_count: chemicals,
      detected_scientific_count: scientific,
      heading_count: headings,
      has_ai_conversational_chatter: hasAiChatter,
      summary: `Document contains ${words.toLocaleString()} words across ${headings} section(s).`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Analysis failed';
    res.status(500).json({ success: false, error: message });
  }
});

app.post('/api/documents/clean', (req: Request, res: Response) => {
  try {
    const rawText = String(req.body.raw_text || '');
    const cleanupSkill = skillRegistry.get('markdown_cleanup');
    const originalLen = rawText.length;

    let cleaned = rawText;
    let changes: string[] = [];

    if (cleanupSkill && cleanupSkill.enabled) {
      const result = cleanupSkill.processText(rawText, {
        metadata: {},
        detectedFeatures: new Set(),
      });
      cleaned = result.text;
      changes = result.changes;
    }

    res.json({
      success: true,
      cleaned_text: cleaned,
      original_char_count: originalLen,
      cleaned_char_count: cleaned.length,
      artifacts_removed: Math.max(0, originalLen - cleaned.length),
      changes_applied: changes,
      message: 'Cleaned conversational artifacts and normalized syntax.',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Cleanup failed';
    res.status(500).json({ success: false, error: message });
  }
});

// ==========================================
// 3. Document Processing (AST Construction)
// ==========================================
app.post('/api/documents/process', (req: Request, res: Response) => {
  try {
    const { raw_text, title, citation_style, preset } = req.body;
    if (!raw_text || typeof raw_text !== 'string') {
      return res.status(400).json({ success: false, message: 'raw_text is required' });
    }

    const orchestrationResult = skillOrchestrator.process(raw_text, {
      title,
      citationStyle: citation_style,
      preset,
    });

    res.json({
      success: true,
      document: orchestrationResult.document,
      message: 'Document processed successfully through modular skills orchestrator.',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Document processing failed';
    res.status(500).json({ success: false, message });
  }
});

// ==========================================
// 4. DOCX & PDF Export
// ==========================================
app.post('/api/documents/docx', async (req: Request, res: Response) => {
  try {
    let doc: AcademicDocument | undefined = req.body.document;
    const { raw_text, preset, title, citation_style, include_page_numbers, include_header } = req.body;

    if (!doc && raw_text) {
      const result = skillOrchestrator.process(raw_text, {
        title,
        preset,
        citationStyle: citation_style,
      });
      doc = result.document;
    }

    if (!doc) {
      return res.status(400).json({ success: false, message: 'document or raw_text is required' });
    }

    const docxBuffer = await generateDocxBuffer(doc, {
      preset,
      includePageNumbers: include_page_numbers,
      includeHeader: include_header,
    });

    const safeTitle = (doc.title || 'document').replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
    const filename = `${safeTitle}.docx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', docxBuffer.length);
    res.send(docxBuffer);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'DOCX generation failed';
    res.status(500).json({ success: false, message });
  }
});

app.post('/api/documents/pdf', async (req: Request, res: Response) => {
  try {
    let doc: AcademicDocument | undefined = req.body.document;
    const { raw_text, preset, title, citation_style } = req.body;

    if (!doc && raw_text) {
      const result = skillOrchestrator.process(raw_text, {
        title,
        preset,
        citationStyle: citation_style,
      });
      doc = result.document;
    }

    if (!doc) {
      return res.status(400).json({ success: false, message: 'document or raw_text is required' });
    }

    // Generate DOCX buffer as a high-fidelity representation
    const buffer = await generateDocxBuffer(doc, { preset });
    const safeTitle = (doc.title || 'document').replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}.doc"`);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Export failed';
    res.status(500).json({ success: false, message });
  }
});

// ==========================================
// 5. Modular Skills Endpoints
// ==========================================
app.get('/api/skills', (_req: Request, res: Response) => {
  const skills = skillRegistry.getAll();
  res.json(
    skills.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      version: s.version,
      category: s.category,
      priority: s.priority,
      enabled: s.enabled,
      rules: s.rules.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        enabled: r.enabled ?? true,
      })),
    }))
  );
});

app.post('/api/skills/toggle', (req: Request, res: Response) => {
  const { skill_id, enabled, states } = req.body;

  if (states && typeof states === 'object') {
    skillRegistry.loadEnabledStates(states);
  } else if (skill_id && typeof enabled === 'boolean') {
    skillRegistry.setEnabled(skill_id, enabled);
  } else {
    return res.status(400).json({ success: false, message: 'Invalid toggle parameters' });
  }

  const enabledSkills = skillRegistry.getEnabled();
  res.json({
    success: true,
    enabled_count: enabledSkills.length,
    total_count: skillRegistry.getAll().length,
    enabled_skill_ids: enabledSkills.map((s) => s.id),
  });
});

app.post('/api/skills/process', (req: Request, res: Response) => {
  try {
    const { raw_text, title, preset, citation_style } = req.body;
    if (!raw_text) {
      return res.status(400).json({ success: false, message: 'raw_text is required' });
    }

    const result = skillOrchestrator.process(raw_text, {
      title,
      preset,
      citationStyle: citation_style,
    });

    res.json({
      success: true,
      raw_text,
      processed_text: result.cleanedText,
      document: result.document,
      execution_logs: result.executionLogs,
      applied_skills_count: result.appliedSkillsCount,
      disabled_skills_count: result.disabledSkillsCount,
      total_duration_ms: result.totalDurationMs,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Skills processing failed';
    res.status(500).json({ success: false, message });
  }
});

app.post('/api/skills/reset', (_req: Request, res: Response) => {
  skillRegistry.resetToDefaults();
  res.json({
    success: true,
    message: 'All skills reset to default active states',
    enabled_count: skillRegistry.getEnabled().length,
  });
});

// ==========================================
// 6. AI Endpoints
// ==========================================
app.get('/api/ai/models', (_req: Request, res: Response) => {
  res.json({
    models: [
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Fast, high-quality multimodal model', is_default: true },
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: 'Advanced reasoning model for complex academic papers', is_default: false },
    ],
  });
});

app.get('/api/ai/providers', (_req: Request, res: Response) => {
  res.json({
    providers: [
      {
        id: 'google_genai',
        name: 'Google Gemini',
        description: 'Google GenAI SDK integration',
        is_configured: Boolean(process.env.GEMINI_API_KEY),
        is_enabled: true,
        default_model: 'gemini-2.5-flash',
        supports_discovery: true,
        requires_base_url: false,
      },
    ],
  });
});

// ==========================================
// 7. Mount Vite in Dev / Serve Static in Prod
// ==========================================
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`FormatAI full-stack server running at http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal error starting server:', err);
  process.exit(1);
});
