import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  Packer,
  BorderStyle,
} from 'docx';
import { AcademicDocument, DocumentBlock, DocxPreset } from '../../frontend/src/types/document';

export async function generateDocxBuffer(
  doc: AcademicDocument,
  options: {
    preset?: DocxPreset;
    includePageNumbers?: boolean;
    includeHeader?: boolean;
  } = {}
): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [];

  // Title
  if (doc.title) {
    children.push(
      new Paragraph({
        text: doc.title,
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
        spacing: { before: 240, after: 240 },
      })
    );
  }

  // Abstract if present
  if (doc.abstract) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'Abstract—', bold: true, italics: true }),
          new TextRun({ text: doc.abstract, italics: true }),
        ],
        spacing: { before: 120, after: 240 },
      })
    );
  }

  // Iterate over AST blocks
  for (const block of doc.blocks) {
    if (block.block_type === 'title') {
      continue; // already handled
    }

    if (block.block_type === 'heading') {
      const level = block.level === 1
        ? HeadingLevel.HEADING_1
        : block.level === 2
        ? HeadingLevel.HEADING_2
        : HeadingLevel.HEADING_3;

      children.push(
        new Paragraph({
          text: block.text,
          heading: level,
          spacing: { before: 280, after: 120 },
        })
      );
      continue;
    }

    if (block.block_type === 'paragraph') {
      // Split inline math tokens like $E=mc^2$
      const parts = block.text.split(/(\$[^$]+\$)/g);
      const runs = parts.map((part) => {
        if (part.startsWith('$') && part.endsWith('$') && part.length > 2) {
          return new TextRun({
            text: part.slice(1, -1),
            italics: true,
            font: 'Cambria Math',
          });
        }
        return new TextRun({ text: part });
      });

      children.push(
        new Paragraph({
          children: runs,
          spacing: { before: 80, after: 120, line: 276 },
        })
      );
      continue;
    }

    if (block.block_type === 'math_block') {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: block.text.replace(/^\$\$|\$\$$/g, '').trim(),
              italics: true,
              font: 'Cambria Math',
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { before: 180, after: 180 },
        })
      );
      continue;
    }

    if (block.block_type === 'blockquote') {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: block.text, italics: true })],
          indent: { left: 720 },
          spacing: { before: 120, after: 120 },
        })
      );
      continue;
    }

    if (block.block_type === 'code_block') {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: block.text,
              font: 'Consolas',
              size: 19,
            }),
          ],
          indent: { left: 360 },
          spacing: { before: 100, after: 100 },
        })
      );
      continue;
    }

    if (block.block_type === 'unordered_list' && block.items) {
      for (const item of block.items) {
        children.push(
          new Paragraph({
            text: item,
            bullet: { level: 0 },
            spacing: { before: 40, after: 40 },
          })
        );
      }
      continue;
    }

    if (block.block_type === 'ordered_list' && block.items) {
      block.items.forEach((item, index) => {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: `${index + 1}. `, bold: true }),
              new TextRun({ text: item }),
            ],
            spacing: { before: 40, after: 40 },
          })
        );
      });
      continue;
    }

    if (block.block_type === 'table' && block.headers && block.rows) {
      const headerRow = new TableRow({
        children: block.headers.map(
          (h) =>
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: h, bold: true })],
                  alignment: AlignmentType.CENTER,
                }),
              ],
              shading: { fill: 'F1F5F9' },
            })
        ),
      });

      const dataRows = block.rows.map(
        (row) =>
          new TableRow({
            children: row.map(
              (cell) =>
                new TableCell({
                  children: [
                    new Paragraph({
                      text: cell,
                      spacing: { before: 60, after: 60 },
                    }),
                  ],
                })
            ),
          })
      );

      children.push(
        new Table({
          rows: [headerRow, ...dataRows],
          width: { size: 100, type: WidthType.PERCENTAGE },
        })
      );
      continue;
    }

    if (block.block_type === 'reference_entry') {
      children.push(
        new Paragraph({
          text: block.text,
          indent: { hanging: 360, left: 360 },
          spacing: { before: 60, after: 60 },
        })
      );
      continue;
    }
  }

  const wordDocument = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440, // 1 inch
              bottom: 1440,
              left: 1440,
              right: 1440,
            },
          },
        },
        children,
      },
    ],
  });

  return await Packer.toBuffer(wordDocument);
}
