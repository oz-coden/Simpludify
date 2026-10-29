import { expect, it } from "vitest";
import { wrapCanvasText } from "../../packages/web/src/canvas-text";

const clusters = new Intl.Segmenter(undefined, { granularity: "grapheme" });
const measure = (text: string) =>
  Array.from(clusters.segment(text)).length * 10;
it("preserves explicit lines, CRLF, empty lines and unwrapped whitespace", () => {
  expect(wrapCanvasText(" a  b\r\n\n終わり\n", 100, measure)).toBe(
    " a  b\n\n終わり\n",
  );
});
it("wraps English at word boundaries, omitting only soft boundary separators", () => {
  expect(wrapCanvasText("one two three", 70, measure)).toBe("one two\nthree");
  expect(wrapCanvasText("one  two", 40, measure)).toBe("one\ntwo");
});
it("breaks long words and URLs and makes progress at zero width", () => {
  expect(wrapCanvasText("abcdef", 20, measure)).toBe("ab\ncd\nef");
  const text = "https://example.com/long";
  expect(wrapCanvasText(text, 30, measure).replaceAll("\n", "")).toBe(text);
  expect(wrapCanvasText("ab", 0, measure)).toBe("a\nb");
});
it("never splits emoji ZWJ, modifiers, flags or combining marks", () => {
  const values = ["👨‍👩‍👧‍👦", "👍🏽", "🇯🇵", "e\u0301"];
  expect(wrapCanvasText(values.join(""), 10, measure).split("\n")).toEqual(
    values,
  );
});
it("keeps common Japanese punctuation with neighbors and supports mixed words", () => {
  const result = wrapCanvasText(
    "開始「日本語」、English を表示する。",
    70,
    measure,
  );
  expect(result.replaceAll("\n", "")).toBe(
    "開始「日本語」、Englishを表示する。",
  );
  for (const line of result.split("\n")) {
    expect(line).not.toMatch(/^[、。）」]/u);
    expect(line).not.toMatch(/[（「]$/u);
    expect(measure(line)).toBeLessThanOrEqual(70);
  }
});
