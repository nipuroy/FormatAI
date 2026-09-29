import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  Header,
  Footer,
  PageNumber,
} from 'docx';
import { AcademicDocument, DocumentBlock, DocxPreset } from '../../frontend/src/types/document';

interface DocxGenerationOptions {
  preset?: DocxPreset;
  title?: string;
  includePageNumbers?: boolean;
  includeHeader?: boolean;
}

export async function generateDocxBuffer(
  document: AcademicDocument,
  options: DocxGenerationOptions = {}
): Promise<Buffer> {
  const preset = options.preset || 'academic';
  const includePageNumbers = options.includePageNumbers !== false;
  const includeHeader = options.includeHeader !== false;
  const docTitle = options.title || document.title || 'FormatAI Academic Manuscript';

  // Typography & spacing based on preset
  let fontFamily = 'Times New Roman';
  let bodySize = 24; // 12pt (half-points)
  let lineSpacing = 480; // Double spaced
  let marginSize = 1440; // 1 inch (twips)

  if (preset === 'research_paper') {
    fontFamily = 'Helvetica';
    bodySize = 22; // 11pt
    lineSpacing = 276; // 1.15x
  } else if (preset === 'exam') {
    fontFamily = 'Arial';
    bodySize = 22;
    lineSpacing = 260;
  } else if (preset === 'study_notes') {
    fontFamily = 'Calibri';
    bodySize = 22;
    lineSpacing = 280;
  } else if (preset === 'textbook') {
    fontFamily = 'Georgia';
    bodySize = 22;
    lineSpacing = 312; // 1.3x
  }

  const paragraphs: (Paragraph | Table)[] = [];

  // Title
  paragraphs.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 400, before: 200 },
      children: [
        new TextRun({
          text: docTitle,
          bold: true,
          size: bodySize + 12,
          font: fontFamily,
        }),
      ],
    })
  );

  // Render Blocks
  for (const block of document.blocks) {
    if (block.block_type === 'title') {
      // already added above
      continue;
    }

    if (block.block_type === 'heading') {
      const level = block.level || 1;
      let headingLevel: (typeof HeadingLevel)[keyof typeof HeadingLevel] = HeadingLevel.HEADING_1;
      let hSize = bodySize + 6;

      if (level === 2) {
        headingLevel = HeadingLevel.HEADING_2;
        hSize = bodySize + 4;
      } else if (level >= 3) {
        headingLevel = HeadingLevel.HEADING_3;
        hSize = bodySize + 2;
      }

      paragraphs.push(
        new Paragraph({
          heading: headingLevel,
          spacing: { before: 360, after: 160 },
          children: [
            new TextRun({
              text: block.text,
              bold: true,
              size: hSize,
              font: fontFamily,
            }),
          ],
        })
      );
    } else if (block.block_type === 'paragraph') {
      // Split text on LaTeX inline math $...$
      const parts = block.text.split(/(\$[^$]+\$)/g);
      const runs = parts.map((part) => {
        if (part.startsWith('$') && part.endsWith('$') && part.length > 2) {
          return new TextRun({
            text: part.slice(1, -1),
            italics: true,
            size: bodySize,
            font: 'Cambria Math',
          });
        }
        return new TextRun({
          text: part,
          size: bodySize,
          font: fontFamily,
        });
      });

      paragraphs.push(
        new Paragraph({
          spacing: { line: lineSpacing, after: 200 },
          children: runs,
        })
      );
    } else if (block.block_type === 'math_block') {
      const mathClean = block.text.replace(/^\$\$|\$\$$/g, '').trim();
      paragraphs.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 240, after: 240 },
          children: [
            new TextRun({
              text: mathClean,
              italics: true,
              size: bodySize + 2,
              font: 'Cambria Math',
            }),
          ],
        })
      );
    } else if (block.block_type === 'ordered_list' || block.block_type === 'unordered_list') {
      const items = block.items || [];
      items.forEach((item, idx) => {
        const prefix = block.block_type === 'ordered_list' ? `${idx + 1}. ` : '• ';
        paragraphs.push(
          new Paragraph({
            spacing: { line: lineSpacing, after: 100 },
            indent: { left: 720 },
            children: [
              new TextRun({
                text: prefix + item,
                size: bodySize,
                font: fontFamily,
              }),
            ],
          })
        );
      });
    } else if (block.block_type === 'table') {
      const headers = block.headers || [];
      const rows = block.rows || [];

      const tableRows: TableRow[] = [];

      if (headers.length > 0) {
        tableRows.push(
          new TableRow({
            tableHeader: true,
            children: headers.map(
              (h) =>
                new TableCell({
                  children: [
                    new Paragraph({
                      alignment: AlignmentType.LEFT,
                      children: [
                        new TextRun({
                          text: h,
                          bold: true,
                          size: bodySize - 2,
                          font: fontFamily,
                        }),
                      ],
                    }),
                  ],
                  shading: { fill: 'F1F5F9' },
                })
            ),
          })
        );
      }

      rows.forEach((row) => {
        tableRows.push(
          new TableRow({
            children: row.map(
              (cell) =>
                new TableCell({
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: cell,
                          size: bodySize - 2,
                          font: fontFamily,
                        }),
                      ],
                    }),
                  ],
                })
            ),
          })
        );
      });

      if (tableRows.length > 0) {
        paragraphs.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: tableRows,
          })
        );
      }
    }
  }

  // References section
  if (document.references && document.references.length > 0) {
    paragraphs.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 480, after: 200 },
        children: [
          new TextRun({
            text: 'References',
            bold: true,
            size: bodySize + 4,
            font: fontFamily,
          }),
        ],
      })
    );

    document.references.forEach((ref, idx) => {
      paragraphs.push(
        new Paragraph({
          spacing: { line: lineSpacing, after: 140 },
          indent: { left: 720, hanging: 720 },
          children: [
            new TextRun({
              text: `[${idx + 1}] ${ref}`,
              size: bodySize - 2,
              font: fontFamily,
            }),
          ],
        })
      );
    });
  }

  // Setup Document Headers & Footers
  const docHeaders: Record<string, Header> = {};
  const docFooters: Record<string, Footer> = {};

  if (includeHeader) {
    docHeaders.default = new Header({
      children: [
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [
            new TextRun({
              text: `${docTitle} · Preset: ${preset.toUpperCase()}`,
              size: 18,
              font: fontFamily,
              color: '64748B',
            }),
          ],
        }),
      ],
    });
  }

  if (includePageNumbers) {
    docFooters.default = new Footer({
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              children: [PageNumber.CURRENT],
              size: 18,
              font: fontFamily,
              color: '64748B',
            }),
          ],
        }),
      ],
    });
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: marginSize,
              bottom: marginSize,
              left: marginSize,
              right: marginSize,
            },
          },
        },
        headers: docHeaders,
        footers: docFooters,
        children: paragraphs,
      },
    ],
  });

  return await Packer.toBuffer(doc);
}
