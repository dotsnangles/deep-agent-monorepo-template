/**
 * Default fallback title when input cannot be derived.
 */
export const DEFAULT_SESSION_TITLE = "새로운 대화";

/**
 * Maximum total character length for derived optimistic session titles.
 */
export const MAX_DERIVED_TITLE_LENGTH = 24;

/**
 * Derives a clean, concise session title from the user's initial prompt in-memory (0ms latency).
 *
 * Rules:
 * 1. Strips Markdown code blocks, blockquotes, headers (#), bullet points (-/*), bold/italics.
 * 2. Finds the first meaningful line containing alphanumeric characters.
 * 3. Truncates to strictly max 24 total characters (including ellipsis if truncated).
 * 4. Falls back to "새로운 대화" if input is empty, whitespace-only, or symbols only.
 */
export function deriveSessionTitle(
  prompt: string | null | undefined,
  maxLength: number = MAX_DERIVED_TITLE_LENGTH
): string {
  if (!prompt || typeof prompt !== "string") {
    return DEFAULT_SESSION_TITLE;
  }

  // 1. Remove Markdown code blocks (```...```)
  let cleaned = prompt.replace(/```[\s\S]*?```/g, "");

  // 2. Remove inline code backticks (`...` -> ...)
  cleaned = cleaned.replace(/`([^`]+)`/g, "$1");

  // 3. Remove URLs
  cleaned = cleaned.replace(/https?:\/\/\S+/g, "");

  // 4. Split lines and clean individual lines
  const rawLines = cleaned.split(/\r?\n/);
  let meaningfulLine = "";

  for (const rawLine of rawLines) {
    let line = rawLine.trim();
    if (!line) continue;

    // Strip leading Markdown headers (#, ##, ...)
    line = line.replace(/^#+(\s+|$)/, "");

    // Strip leading blockquotes (> or > )
    line = line.replace(/^>+\s*/, "");

    // Strip leading list markers (- , * , + , 1. )
    line = line.replace(/^[-*+]\s+/, "").replace(/^\d+\.\s+/, "");

    // Strip bold/italic/strikethrough markers (***text***, **text**, *text*, ~~text~~)
    line = line.replace(/(\*{1,3}|_{1,3}|~~)(.+?)\1/g, "$2");

    // Strip surrounding quotes and brackets
    line = line
      .replace(/^["'`“‘\(\[\{]+/, "")
      .replace(/["'`”’\)\]\}]+$/, "")
      .trim();

    // Check if line contains alphanumeric/letter characters
    if (/[a-zA-Z0-9\p{L}\p{N}]/u.test(line)) {
      meaningfulLine = line;
      break;
    }
  }

  if (!meaningfulLine) {
    return DEFAULT_SESSION_TITLE;
  }

  // 5. If text has multiple sentences, take the first sentence
  const sentenceMatch = meaningfulLine.match(/^(.+?[.!?])(?:\s+|$)/);
  if (
    sentenceMatch &&
    sentenceMatch[1] &&
    sentenceMatch[1].length <= maxLength &&
    sentenceMatch[1].length < meaningfulLine.length
  ) {
    meaningfulLine = sentenceMatch[1];
  }

  // Strip trailing period for a cleaner title format
  meaningfulLine = meaningfulLine.replace(/[.]+$/, "").trim();

  // 6. Normalize multiple whitespaces
  meaningfulLine = meaningfulLine.replace(/\s+/g, " ").trim();

  if (!meaningfulLine || !/[a-zA-Z0-9\p{L}\p{N}]/u.test(meaningfulLine)) {
    return DEFAULT_SESSION_TITLE;
  }

  // 7. Enforce strictly <= maxLength total characters
  if (meaningfulLine.length > maxLength) {
    const ellipsis = "...";
    const sliceLen = Math.max(1, maxLength - ellipsis.length);
    return `${meaningfulLine.slice(0, sliceLen).trimEnd()}${ellipsis}`;
  }

  return meaningfulLine;
}
