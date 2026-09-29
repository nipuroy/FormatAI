import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { AcademicDocument, DocxPreset } from '../../frontend/src/types/document';

interface PdfGenerationOptions {
  preset?: DocxPreset;
  title?: string;
  includePageNumbers?: boolean;
  includeHeader?: boolean;
}

export async function generatePdfBuffer(
  document: AcademicDocument,
  options: PdfGenerationOptions = {}
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const timesRoman = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const timesRomanBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const timesRomanItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);

  const docTitle = options.title || document.title || 'FormatAI Academic Manuscript';
  const includePageNumbers = options.includePageNumbers !== false;
  const includeHeader = options.includeHeader !== false;

  const pageWidth = 595.28; // Standard A4 points
  const pageHeight = 841.89;
  const margin = 54; // 0.75 in
  const contentWidth = pageWidth - margin * 2;

  let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin - 20;

  const checkPageBreak = (neededHeight: number) => {
    if (y - neededHeight < margin + 30) {
      currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin - 20;
      return true;
    }
    return false;
  };

  // Helper to wrap text into lines
  const wrapText = (text: string, maxWidth: number, font = timesRoman, fontSize = 11): string[] => {
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const width = font.widthOfTextAtSize(testLine, fontSize);
      if (width <= maxWidth) {
        currentLine = testLine;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) lines.push(currentLine);
    return lines;
  };

  // Title
  const titleLines = wrapText(docTitle, contentWidth, timesRomanBold, 18);
  for (const line of titleLines) {
    checkPageBreak(24);
    const lineWidth = timesRomanBold.widthOfTextAtSize(line, 18);
    currentPage.drawText(line, {
      x: margin + (contentWidth - lineWidth) / 2,
      y,
      size: 18,
      font: timesRomanBold,
      color: rgb(0.06, 0.09, 0.16),
    });
    y -= 24;
  }
  y -= 12;

  // Render Blocks
  for (const block of document.blocks) {
    if (block.block_type === 'title') continue;

    if (block.block_type === 'heading') {
      const level = block.level || 1;
      const hSize = level === 1 ? 14 : level === 2 ? 12.5 : 11.5;
      checkPageBreak(30);
      y -= 8;

      currentPage.drawText(block.text, {
        x: margin,
        y,
        size: hSize,
        font: timesRomanBold,
        color: rgb(0.12, 0.16, 0.23),
      });
      y -= hSize + 8;
    } else if (block.block_type === 'paragraph') {
      const pLines = wrapText(block.text, contentWidth, timesRoman, 11);
      for (const line of pLines) {
        checkPageBreak(16);
        currentPage.drawText(line, {
          x: margin,
          y,
          size: 11,
          font: timesRoman,
          color: rgb(0.1, 0.1, 0.1),
        });
        y -= 16;
      }
      y -= 8;
    } else if (block.block_type === 'math_block') {
      const mathClean = block.text.replace(/^\$\$|\$\$$/g, '').trim();
      checkPageBreak(28);
      const mathLines = wrapText(mathClean, contentWidth - 40, timesRomanItalic, 11.5);

      // Draw light background bar
      currentPage.drawRectangle({
        x: margin,
        y: y - (mathLines.length * 16) - 4,
        width: contentWidth,
        height: mathLines.length * 16 + 12,
        color: rgb(0.96, 0.97, 0.98),
      });

      for (const line of mathLines) {
        const lineWidth = timesRomanItalic.widthOfTextAtSize(line, 11.5);
        currentPage.drawText(line, {
          x: margin + (contentWidth - lineWidth) / 2,
          y: y - 2,
          size: 11.5,
          font: timesRomanItalic,
          color: rgb(0.1, 0.2, 0.6),
        });
        y -= 16;
      }
      y -= 12;
    } else if (block.block_type === 'ordered_list' || block.block_type === 'unordered_list') {
      const items = block.items || [];
      items.forEach((item, idx) => {
        const prefix = block.block_type === 'ordered_list' ? `${idx + 1}. ` : '• ';
        const itemLines = wrapText(prefix + item, contentWidth - 16, timesRoman, 11);
        for (const line of itemLines) {
          checkPageBreak(15);
          currentPage.drawText(line, {
            x: margin + 16,
            y,
            size: 11,
            font: timesRoman,
            color: rgb(0.1, 0.1, 0.1),
          });
          y -= 15;
        }
      });
      y -= 6;
    } else if (block.block_type === 'table') {
      const headers = block.headers || [];
      const rows = block.rows || [];
      const colCount = Math.max(headers.length, ...rows.map((r) => r.length), 1);
      const colWidth = contentWidth / colCount;

      checkPageBreak(24);
      if (headers.length > 0) {
        headers.forEach((h, cIdx) => {
          const truncated = h.length > 25 ? h.slice(0, 22) + '...' : h;
          currentPage.drawText(truncated, {
            x: margin + cIdx * colWidth + 4,
            y,
            size: 10,
            font: timesRomanBold,
            color: rgb(0.06, 0.09, 0.16),
          });
        });
        y -= 16;
      }

      rows.forEach((row) => {
        checkPageBreak(16);
        row.forEach((cell, cIdx) => {
          const truncated = cell.length > 30 ? cell.slice(0, 27) + '...' : cell;
          currentPage.drawText(truncated, {
            x: margin + cIdx * colWidth + 4,
            y,
            size: 10,
            font: timesRoman,
            color: rgb(0.2, 0.2, 0.2),
          });
        });
        y -= 14;
      });
      y -= 10;
    }
  }

  // References
  if (document.references && document.references.length > 0) {
    checkPageBreak(30);
    y -= 10;
    currentPage.drawText('References', {
      x: margin,
      y,
      size: 13,
      font: timesRomanBold,
      color: rgb(0.1, 0.1, 0.1),
    });
    y -= 18;

    document.references.forEach((ref, idx) => {
      const refLines = wrapText(`[${idx + 1}] ${ref}`, contentWidth - 16, timesRoman, 9.5);
      for (const line of refLines) {
        checkPageBreak(14);
        currentPage.drawText(line, {
          x: margin + 12,
          y,
          size: 9.5,
          font: timesRoman,
          color: rgb(0.25, 0.25, 0.25),
        });
        y -= 14;
      }
      y -= 4;
    });
  }

  // Draw Header and Footers on ALL pages
  const totalPages = pdfDoc.getPageCount();
  for (let i = 0; i < totalPages; i++) {
    const page = pdfDoc.getPage(i);

    if (includeHeader) {
      page.drawText(`${docTitle.slice(0, 45)} · FormatAI`, {
        x: margin,
        y: pageHeight - margin + 12,
        size: 8.5,
        font: timesRoman,
        color: rgb(0.4, 0.45, 0.5),
      });
    }

    if (includePageNumbers) {
      const footerText = `Page ${i + 1} of ${totalPages}`;
      const textWidth = timesRoman.widthOfTextAtSize(footerText, 9);
      page.drawText(footerText, {
        x: (pageWidth - textWidth) / 2,
        y: margin - 20,
        size: 9,
        font: timesRoman,
        color: rgb(0.4, 0.45, 0.5),
      });
    }
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
