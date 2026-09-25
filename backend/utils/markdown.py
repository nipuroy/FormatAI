"""Markdown and structured academic document parser.

Parses unstructured or semi-structured academic text into discrete
structural tokens and blocks (headings, tables, lists, math, code, etc.).
"""

import re
from typing import Any, Dict, List, Optional, Tuple


def is_table_divider(line: str) -> bool:
    """Check if line is a markdown table divider (e.g. |---|:---:|---:|)."""
    stripped = line.strip()
    if not (stripped.startswith("|") or "|" in stripped):
        return False
    # Remove pipes and spaces, check if only hyphens and colons remain
    inner = stripped.strip("|").strip()
    cells = [c.strip() for c in inner.split("|")]
    return all(re.match(r"^:?-+:?$", cell) for cell in cells if cell)


def parse_table_row(line: str) -> List[str]:
    """Parse a single markdown table row into trimmed cell values."""
    trimmed = line.strip()
    if trimmed.startswith("|"):
        trimmed = trimmed[1:]
    if trimmed.endswith("|"):
        trimmed = trimmed[:-1]
    return [cell.strip() for cell in trimmed.split("|")]


def parse_table_alignments(divider_line: str) -> List[str]:
    """Parse column alignments from table divider row."""
    cells = parse_table_row(divider_line)
    alignments = []
    for cell in cells:
        c = cell.strip()
        if c.startswith(":") and c.endswith(":"):
            alignments.append("center")
        elif c.endswith(":"):
            alignments.append("right")
        elif c.startswith(":"):
            alignments.append("left")
        else:
            alignments.append("left")
    return alignments


def parse_raw_into_blocks(text: str) -> List[Dict[str, Any]]:
    """Parse raw text into an initial sequence of structural block dictionaries."""
    lines = text.split("\n")
    blocks: List[Dict[str, Any]] = []

    i = 0
    total = len(lines)

    while i < total:
        line = lines[i]
        stripped = line.strip()

        # 1. Skip empty lines
        if not stripped:
            i += 1
            continue

        # 2. Fenced Code Block: ```lang ... ```
        if stripped.startswith("```"):
            lang = stripped.lstrip("`").strip()
            code_lines = []
            i += 1
            while i < total and not lines[i].strip().startswith("```"):
                code_lines.append(lines[i])
                i += 1
            if i < total and lines[i].strip().startswith("```"):
                i += 1
            blocks.append({
                "block_type": "code_block",
                "language": lang or "text",
                "text": "\n".join(code_lines),
            })
            continue

        # 3. LaTeX Math Display Block: $$ ... $$ or \begin{equation}
        if stripped.startswith("$$") or stripped.startswith("\\[") or stripped.startswith("\\begin{equation"):
            math_lines = [line]
            # Check if it terminates on the same line
            if (stripped.startswith("$$") and len(stripped) > 2 and stripped.endswith("$$") and stripped != "$$") or \
               (stripped.startswith("\\[") and stripped.endswith("\\]")):
                blocks.append({
                    "block_type": "math_block",
                    "text": stripped,
                    "math_type": "display",
                })
                i += 1
                continue

            i += 1
            is_end = False
            while i < total and not is_end:
                math_lines.append(lines[i])
                cur_stripped = lines[i].strip()
                if cur_stripped.endswith("$$") or cur_stripped.endswith("\\]") or cur_stripped.startswith("\\end{equation"):
                    is_end = True
                i += 1

            blocks.append({
                "block_type": "math_block",
                "text": "\n".join(math_lines).strip(),
                "math_type": "display",
            })
            continue

        # 4. Table Detection: line contains | and next line is table divider
        if "|" in stripped and i + 1 < total and is_table_divider(lines[i + 1]):
            headers = parse_table_row(line)
            alignments = parse_table_alignments(lines[i + 1])
            i += 2  # skip header and divider
            rows = []
            while i < total and lines[i].strip() and "|" in lines[i]:
                row_cells = parse_table_row(lines[i])
                # Ensure row length matches headers if possible
                while len(row_cells) < len(headers):
                    row_cells.append("")
                rows.append(row_cells[:len(headers)])
                i += 1
            blocks.append({
                "block_type": "table",
                "headers": headers,
                "rows": rows,
                "alignments": alignments,
                "text": "",
            })
            continue

        # 5. Blockquote: starts with >
        if stripped.startswith(">"):
            quote_lines = []
            while i < total and lines[i].strip().startswith(">"):
                quote_lines.append(re.sub(r"^>\s?", "", lines[i].strip()))
                i += 1
            blocks.append({
                "block_type": "blockquote",
                "text": " ".join(quote_lines).strip(),
            })
            continue

        # 6. Heading: #, ##, ###, ####, #####, ######
        heading_match = re.match(r"^(#{1,6})\s+(.*)$", stripped)
        if heading_match:
            level = len(heading_match.group(1))
            heading_text = heading_match.group(2).strip()
            blocks.append({
                "block_type": "heading",
                "level": level,
                "text": heading_text,
            })
            i += 1
            continue

        # 7. Setext-style Heading (underlined with === or ---)
        if i + 1 < total and (re.match(r"^={3,}$", lines[i + 1].strip()) or re.match(r"^-{3,}$", lines[i + 1].strip())):
            level = 1 if lines[i + 1].strip().startswith("=") else 2
            blocks.append({
                "block_type": "heading",
                "level": level,
                "text": stripped,
            })
            i += 2
            continue

        # 8. Ordered List: starts with "1. ", "2. ", etc.
        ordered_match = re.match(r"^(\d+)\.\s+(.*)$", stripped)
        if ordered_match:
            list_items = []
            while i < total:
                cur_stripped = lines[i].strip()
                item_match = re.match(r"^\d+\.\s+(.*)$", cur_stripped)
                if item_match:
                    list_items.append(item_match.group(1).strip())
                    i += 1
                elif cur_stripped and not cur_stripped.startswith("#") and not cur_stripped.startswith("-") and not cur_stripped.startswith("*") and not cur_stripped.startswith(">"):
                    # Continuation of previous item
                    if list_items:
                        list_items[-1] += " " + cur_stripped
                    i += 1
                else:
                    break
            blocks.append({
                "block_type": "ordered_list",
                "items": list_items,
                "text": "",
            })
            continue

        # 9. Unordered List: starts with "- ", "* ", "+ "
        unordered_match = re.match(r"^[\-\*\+]\s+(.*)$", stripped)
        if unordered_match:
            list_items = []
            while i < total:
                cur_stripped = lines[i].strip()
                item_match = re.match(r"^[\-\*\+]\s+(.*)$", cur_stripped)
                if item_match:
                    list_items.append(item_match.group(1).strip())
                    i += 1
                elif cur_stripped and not cur_stripped.startswith("#") and not re.match(r"^\d+\.\s+", cur_stripped) and not cur_stripped.startswith(">"):
                    # Continuation of previous item
                    if list_items:
                        list_items[-1] += " " + cur_stripped
                    i += 1
                else:
                    break
            blocks.append({
                "block_type": "unordered_list",
                "items": list_items,
                "text": "",
            })
            continue

        # 10. Thematic Break / Divider: ---, ***, ___
        if re.match(r"^(?:-{3,}|\*{3,}|_{3,})$", stripped):
            blocks.append({
                "block_type": "thematic_break",
                "text": "---",
            })
            i += 1
            continue

        # 11. Paragraph: gather lines until an empty line or special token begins
        para_lines = [stripped]
        i += 1
        while i < total:
            next_line = lines[i]
            next_stripped = next_line.strip()
            if not next_stripped:
                break
            # Stop if a heading, code block, table, math block, quote, or list starts
            if (
                next_stripped.startswith("#")
                or next_stripped.startswith("```")
                or next_stripped.startswith("$$")
                or next_stripped.startswith(">")
                or re.match(r"^\d+\.\s+", next_stripped)
                or re.match(r"^[\-\*\+]\s+", next_stripped)
                or (i + 1 < total and is_table_divider(lines[i + 1]))
                or re.match(r"^(?:-{3,}|\*{3,}|_{3,})$", next_stripped)
            ):
                break
            para_lines.append(next_stripped)
            i += 1

        blocks.append({
            "block_type": "paragraph",
            "text": " ".join(para_lines),
        })

    return blocks
