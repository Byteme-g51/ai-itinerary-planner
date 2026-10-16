// A deliberately small Markdown reader for package descriptions. The AI writes
// them as Markdown (headings, bullet lists, **bold**), and they are shown to
// admins and travellers as plain text unless parsed. It handles only what those
// descriptions use and never produces HTML, so there is nothing to inject.

export type InlineSpan = { text: string; bold?: boolean; italic?: boolean };

export type MarkdownBlock =
  | { type: "heading"; level: 1 | 2 | 3; spans: InlineSpan[] }
  | { type: "paragraph"; spans: InlineSpan[] }
  | { type: "list"; ordered: boolean; items: InlineSpan[][] };

const INLINE = /\*\*(.+?)\*\*|__(.+?)__|\*(?!\s)(.+?)\*|(?<![A-Za-z0-9])_(?!\s)(.+?)_(?![A-Za-z0-9])/g;

export function parseInline(text: string): InlineSpan[] {
  const spans: InlineSpan[] = [];
  let last = 0;
  for (const match of text.matchAll(INLINE)) {
    if (match.index > last) spans.push({ text: text.slice(last, match.index) });
    const bold = match[1] ?? match[2];
    spans.push(bold !== undefined ? { text: bold, bold: true } : { text: match[3] ?? match[4], italic: true });
    last = match.index + match[0].length;
  }
  if (last < text.length) spans.push({ text: text.slice(last) });
  return spans;
}

const HEADING = /^(#{1,6})\s+(.*\S)\s*$/;
const BULLET = /^\s*[-*+]\s+(.*\S)\s*$/;
const NUMBERED = /^\s*\d+[.)]\s+(.*\S)\s*$/;

export function parseMarkdownBlocks(source: string | null | undefined): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ type: "paragraph", spans: parseInline(paragraph.join(" ")) });
    paragraph = [];
  };

  for (const line of (source ?? "").replace(/\r\n?/g, "\n").split("\n")) {
    if (!line.trim()) { flushParagraph(); continue; }

    const heading = HEADING.exec(line);
    if (heading) {
      flushParagraph();
      blocks.push({ type: "heading", level: Math.min(heading[1].length, 3) as 1 | 2 | 3, spans: parseInline(heading[2]) });
      continue;
    }

    const bullet = BULLET.exec(line);
    const numbered = bullet ? null : NUMBERED.exec(line);
    const item = bullet ?? numbered;
    if (item) {
      flushParagraph();
      const ordered = Boolean(numbered);
      const previous = blocks[blocks.length - 1];
      if (previous?.type === "list" && previous.ordered === ordered) previous.items.push(parseInline(item[1]));
      else blocks.push({ type: "list", ordered, items: [parseInline(item[1])] });
      continue;
    }

    paragraph.push(line.trim());
  }
  flushParagraph();
  return blocks;
}
