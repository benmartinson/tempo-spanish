import type { Segment } from "../../types";

const TRANSCRIPT_PARAGRAPH_INDENT = "    ";

export const splitDraftIntoSentences = (text: string): string[] =>
  text
    .replace(/\s+/g, " ")
    .match(/[^.!?]+[.!?]+|[^.!?]+$/g)
    ?.map((sentence) => sentence.trim())
    .filter(Boolean) ?? [];

export const getActiveSentence = (text: string, cursor: number): string => {
  const safeCursor = Math.max(0, Math.min(cursor, text.length));
  const before = text.slice(0, safeCursor);
  const after = text.slice(safeCursor);
  const start = Math.max(
    before.lastIndexOf("."),
    before.lastIndexOf("!"),
    before.lastIndexOf("?"),
  );
  const nextStops = [after.indexOf("."), after.indexOf("!"), after.indexOf("?")]
    .filter((index) => index >= 0)
    .map((index) => safeCursor + index + 1);
  const end = nextStops.length ? Math.min(...nextStops) : text.length;
  return text.slice(start + 1, end).trim();
};

export const getSelectedPhrase = (
  draft: string,
  selection: { start: number; end: number },
): string => {
  let start = Math.min(selection.start, selection.end);
  let end = Math.max(selection.start, selection.end);
  if (start === end) return "";

  while (start > 0 && !/\s/.test(draft[start - 1])) {
    start -= 1;
  }
  while (end < draft.length && !/\s/.test(draft[end])) {
    end += 1;
  }

  return draft.slice(start, end).trim().replace(/\s+/g, " ");
};

export const makeCompositionTitle = (text: string): string => {
  const words = text.trim().split(/\s+/).filter(Boolean).slice(0, 7);
  if (!words.length) return "Untitled composition";
  return words.join(" ");
};

export const escapeIlikePattern = (value: string): string =>
  value.replace(/[%_]/g, (match) => `\\${match}`);

export const formatTranscriptSearchText = (value: string): string =>
  value.trim().split(/\s+/).filter(Boolean).join("  ");

export const makeTranscriptRangeText = (
  segments: Segment[],
  startIndex: number,
  endIndex: number,
): string => {
  const start = Math.max(0, Math.min(startIndex, endIndex));
  const end = Math.min(segments.length - 1, Math.max(startIndex, endIndex));
  return segments
    .slice(start, end + 1)
    .map((segment) => segment.text.trim())
    .filter(Boolean)
    .map((text) => `${TRANSCRIPT_PARAGRAPH_INDENT}${text}`)
    .join("\n\n");
};
