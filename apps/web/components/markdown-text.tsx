import type { CSSProperties, ReactNode } from "react";

import { parseMarkdownBlocks, type InlineSpan } from "../lib/markdown-blocks";

function Spans({ spans }: { spans: InlineSpan[] }): ReactNode {
  return spans.map((span, index) => {
    if (span.bold) return <strong key={index}>{span.text}</strong>;
    if (span.italic) return <em key={index}>{span.text}</em>;
    return span.text;
  });
}

/** Renders a package description that may contain Markdown (see lib/markdown-blocks.ts). */
export default function MarkdownText({ text, className, style }: { text: string | null | undefined; className?: string; style?: CSSProperties }) {
  const blocks = parseMarkdownBlocks(text);
  if (!blocks.length) return null;
  return (
    <div className={["md-text", className].filter(Boolean).join(" ")} style={style}>
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          const Tag = block.level === 1 ? "h3" : block.level === 2 ? "h4" : "h5";
          return <Tag key={index}><Spans spans={block.spans} /></Tag>;
        }
        if (block.type === "list") {
          const List = block.ordered ? "ol" : "ul";
          return (
            <List key={index}>
              {block.items.map((item, itemIndex) => <li key={itemIndex}><Spans spans={item} /></li>)}
            </List>
          );
        }
        return <p key={index}><Spans spans={block.spans} /></p>;
      })}
    </div>
  );
}
