export interface PartitionedStreamState {
  content: string;
  reasoning?: string;
  reasoningDuration?: number;
  isThinking: boolean;
}

const THINK_START = "<think>";
const THINK_END = "</think>";

export class StreamReasoningPartitioner {
  private rawTokens = "";
  private explicitReasoning = "";
  private hasExplicitReasoning = false;
  private reasoningStartTime: number | null = null;
  private reasoningEndTime: number | null = null;
  private isThinking = false;

  constructor(initialContent = "", initialReasoning?: string, initialDuration?: number) {
    this.rawTokens = initialContent;
    if (initialReasoning) {
      this.explicitReasoning = initialReasoning;
      this.hasExplicitReasoning = true;
    }
    if (initialDuration !== undefined) {
      this.reasoningStartTime = 0;
      this.reasoningEndTime = initialDuration * 1000;
    }
  }

  public feedReasoning(chunk: string): void {
    if (!this.reasoningStartTime) {
      this.reasoningStartTime = Date.now();
    }
    this.hasExplicitReasoning = true;
    this.isThinking = true;
    this.explicitReasoning += chunk;
  }

  public feedToken(chunk: string): void {
    this.rawTokens += chunk;

    const lower = this.rawTokens.toLowerCase();
    const lastStartIndex = lower.lastIndexOf(THINK_START);
    const lastEndIndex = lower.lastIndexOf(THINK_END);

    if (lastStartIndex >= 0) {
      if (!this.reasoningStartTime) {
        this.reasoningStartTime = Date.now();
      }

      if (lastEndIndex >= 0 && lastEndIndex > lastStartIndex) {
        // Tag has completed
        this.isThinking = false;
        if (!this.reasoningEndTime) {
          this.reasoningEndTime = Date.now();
        }
      } else {
        // Tag is currently open and streaming
        this.isThinking = true;
      }
    } else if (this.hasExplicitReasoning && this.isThinking) {
      // Normal token arrived while explicit reasoning was active
      this.isThinking = false;
      this.reasoningEndTime = Date.now();
    }
  }

  public getState(): PartitionedStreamState {
    const contentSegments: string[] = [];
    const reasoningSegments: string[] = [];
    let cursor = 0;
    let isCurrentlyOpen = false;
    const lower = this.rawTokens.toLowerCase();

    while (cursor < this.rawTokens.length) {
      const nextStart = lower.indexOf(THINK_START, cursor);

      if (nextStart === -1) {
        // No more <think> tags.
        // Check if the remainder ends with a partial prefix of <think> (e.g. "<", "<th")
        let remainder = this.rawTokens.slice(cursor);
        for (let i = 1; i < THINK_START.length; i++) {
          if (remainder.toLowerCase().endsWith(THINK_START.slice(0, i))) {
            remainder = remainder.slice(0, -i);
            break;
          }
        }
        if (remainder) {
          contentSegments.push(remainder);
        }
        break;
      }

      // There is normal content before the next <think>
      if (nextStart > cursor) {
        contentSegments.push(this.rawTokens.slice(cursor, nextStart));
      }

      // Find the closing </think> after nextStart
      const afterStart = nextStart + THINK_START.length;
      const nextEnd = lower.indexOf(THINK_END, afterStart);

      if (nextEnd === -1) {
        // Unclosed <think> block extending to end of string (actively streaming thought)
        let ongoingReasoning = this.rawTokens.slice(afterStart);
        // Strip partial closing tag prefix at the end (e.g. "</thi")
        for (let i = 1; i < THINK_END.length; i++) {
          if (ongoingReasoning.toLowerCase().endsWith(THINK_END.slice(0, i))) {
            ongoingReasoning = ongoingReasoning.slice(0, -i);
            break;
          }
        }
        ongoingReasoning = ongoingReasoning.replace(/^\n/, "");
        if (ongoingReasoning) {
          reasoningSegments.push(ongoingReasoning);
        }
        isCurrentlyOpen = true;
        break;
      }

      // Closed <think> block
      const closedReasoning = this.rawTokens.slice(afterStart, nextEnd).replace(/^\n/, "");
      if (closedReasoning) {
        reasoningSegments.push(closedReasoning);
      }
      cursor = nextEnd + THINK_END.length;
    }

    // Merge explicit reasoning and inline reasoning segments
    const allReasoning: string[] = [];
    if (this.explicitReasoning.trim()) {
      allReasoning.push(this.explicitReasoning.trim());
    }
    for (const r of reasoningSegments) {
      if (r && !allReasoning.includes(r.trim())) {
        allReasoning.push(
          reasoningSegments.length === 1 && !this.explicitReasoning
            ? r
            : r.trim()
        );
      }
    }

    const finalReasoning =
      allReasoning.length > 0
        ? allReasoning.length === 1
          ? allReasoning[0]
          : allReasoning.join("\n\n---\n\n")
        : undefined;

    // Format content cleanly across multi-turn segments
    const filteredContentSegments = contentSegments
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const cleanContent =
      filteredContentSegments.length > 0
        ? filteredContentSegments.join("\n\n")
        : "";

    const currentlyThinking = isCurrentlyOpen || (this.hasExplicitReasoning && this.isThinking);

    const durationSec =
      this.reasoningStartTime !== null
        ? Math.max(
            0.1,
            ((currentlyThinking ? Date.now() : (this.reasoningEndTime ?? Date.now())) -
              this.reasoningStartTime) /
              1000
          )
        : undefined;

    return {
      content: cleanContent,
      reasoning: finalReasoning,
      reasoningDuration: durationSec,
      isThinking: currentlyThinking,
    };
  }

  public getRawContent(): string {
    if (this.hasExplicitReasoning && this.explicitReasoning.trim()) {
      if (this.rawTokens.toLowerCase().includes(THINK_START)) {
        return this.rawTokens;
      }
      if (this.rawTokens) {
        return `<think>\n${this.explicitReasoning.trim()}\n</think>\n\n${this.rawTokens}`;
      }
      return `<think>\n${this.explicitReasoning.trim()}\n</think>`;
    }
    return this.rawTokens;
  }
}

export function partitionMessageContent(rawContent: string): PartitionedStreamState {
  const partitioner = new StreamReasoningPartitioner();
  partitioner.feedToken(rawContent);
  return partitioner.getState();
}
