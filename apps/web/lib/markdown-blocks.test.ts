import assert from "node:assert/strict";
import test from "node:test";

import { parseInline, parseMarkdownBlocks } from "./markdown-blocks";

test("headings, paragraphs and bullet lists are separated", () => {
  const blocks = parseMarkdownBlocks("# 4-Day Bangkok\n\nA food trip for two.\n\n## Highlights\n- **Night Market**: bites\n- Cooking class");
  assert.deepEqual(blocks.map((block) => block.type), ["heading", "paragraph", "heading", "list"]);
  assert.equal(blocks[0].type === "heading" && blocks[0].level, 1);
  assert.equal(blocks[2].type === "heading" && blocks[2].level, 2);
  const list = blocks[3];
  assert.equal(list.type === "list" && list.items.length, 2);
  assert.deepEqual(list.type === "list" && list.items[0], [{ text: "Night Market", bold: true }, { text: ": bites" }]);
});

test("bold and italic are read, and stray asterisks stay as text", () => {
  assert.deepEqual(parseInline("a **b** and *c*"), [{ text: "a " }, { text: "b", bold: true }, { text: " and " }, { text: "c", italic: true }]);
  assert.deepEqual(parseInline("5 * 3 = 15"), [{ text: "5 * 3 = 15" }]);
  assert.deepEqual(parseInline("snake_case_name"), [{ text: "snake_case_name" }]);
});

test("lines in one paragraph are joined; numbered lists are ordered", () => {
  const blocks = parseMarkdownBlocks("first line\nsecond line\n\n1. one\n2. two");
  assert.deepEqual(blocks[0], { type: "paragraph", spans: [{ text: "first line second line" }] });
  assert.equal(blocks[1].type === "list" && blocks[1].ordered, true);
});

test("deep headings are capped at level 3 and markup never becomes HTML", () => {
  const blocks = parseMarkdownBlocks("###### tiny\n<script>alert(1)</script>");
  assert.equal(blocks[0].type === "heading" && blocks[0].level, 3);
  assert.deepEqual(blocks[1], { type: "paragraph", spans: [{ text: "<script>alert(1)</script>" }] });
});

test("empty and missing text give no blocks", () => {
  assert.deepEqual(parseMarkdownBlocks(""), []);
  assert.deepEqual(parseMarkdownBlocks(null), []);
  assert.deepEqual(parseMarkdownBlocks("  \n \n"), []);
});
