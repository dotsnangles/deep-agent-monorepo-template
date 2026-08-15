export interface FuzzySegment {
  text: string;
  highlight: boolean;
}

export interface FuzzyMatchResult {
  matched: boolean;
  score: number;
  segments: FuzzySegment[];
}

/**
 * High-performance multi-token fuzzy/substring matcher that calculates match scores
 * and generates highlight segments for rendering bold/highlighted search results.
 */
export function fuzzyMatch(target: string, query: string): FuzzyMatchResult {
  if (!query || !query.trim()) {
    return {
      matched: true,
      score: 0,
      segments: [{ text: target, highlight: false }],
    };
  }

  const trimmedQuery = query.trim();
  const tokens = trimmedQuery.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return {
      matched: true,
      score: 0,
      segments: [{ text: target, highlight: false }],
    };
  }

  const targetLower = target.toLowerCase();
  const trimmedLower = trimmedQuery.toLowerCase();
  const matchRanges: [number, number][] = [];
  let totalScore = 0;

  // Check if the entire query matches as a full continuous phrase first
  const fullIdx = targetLower.indexOf(trimmedLower);
  if (fullIdx !== -1) {
    matchRanges.push([fullIdx, fullIdx + trimmedLower.length]);
    const positionScore = Math.max(1, 200 - fullIdx);
    const lengthScore = trimmedLower.length * 20;
    totalScore = positionScore + lengthScore + 50; // Bonus for full phrase match
  } else {
    // Keep track of search positions for repeated tokens
    const lastTokenIndexMap = new Map<string, number>();

    for (const token of tokens) {
      const tokenLower = token.toLowerCase();
      const fromIndex = lastTokenIndexMap.get(tokenLower) ?? 0;
      let idx = targetLower.indexOf(tokenLower, fromIndex);

      // If not found after previous occurrence, wrap back to start if needed
      if (idx === -1 && fromIndex > 0) {
        idx = targetLower.indexOf(tokenLower, 0);
      }

      if (idx === -1) {
        return {
          matched: false,
          score: -1,
          segments: [{ text: target, highlight: false }],
        };
      }

      lastTokenIndexMap.set(tokenLower, idx + token.length);
      matchRanges.push([idx, idx + token.length]);

      // Position score (earlier match has higher relevance score)
      const positionScore = Math.max(1, 100 - idx);
      const lengthScore = token.length * 10;
      totalScore += positionScore + lengthScore;
    }
  }

  // Merge overlapping/adjacent match ranges
  matchRanges.sort((a, b) => a[0] - b[0]);
  const mergedRanges: [number, number][] = [];
  for (const [start, end] of matchRanges) {
    if (mergedRanges.length === 0) {
      mergedRanges.push([start, end]);
    } else {
      const prev = mergedRanges[mergedRanges.length - 1];
      if (prev && start <= prev[1]) {
        prev[1] = Math.max(prev[1], end);
      } else {
        mergedRanges.push([start, end]);
      }
    }
  }

  // Build highlighted and non-highlighted text segments
  const segments: FuzzySegment[] = [];
  let cursor = 0;
  for (const [start, end] of mergedRanges) {
    if (start > cursor) {
      segments.push({
        text: target.slice(cursor, start),
        highlight: false,
      });
    }
    segments.push({
      text: target.slice(start, end),
      highlight: true,
    });
    cursor = end;
  }

  if (cursor < target.length) {
    segments.push({
      text: target.slice(cursor),
      highlight: false,
    });
  }

  return {
    matched: true,
    score: totalScore,
    segments,
  };
}
