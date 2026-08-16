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

    // If explicit reasoning was active and a normal token arrives, mark reasoning complete
    if (this.hasExplicitReasoning && this.isThinking) {
      this.isThinking = false;
      this.reasoningEndTime = Date.now();
    }

    // Process inline <think> tags if present
    const lower = this.rawTokens.toLowerCase();
    const startIndex = lower.indexOf(THINK_START);

    if (startIndex >= 0) {
      if (!this.reasoningStartTime) {
        this.reasoningStartTime = Date.now();
      }

      const endIndex = lower.indexOf(THINK_END, startIndex + THINK_START.length);

      if (endIndex >= 0) {
        // Tag is closed
        this.isThinking = false;
        if (!this.reasoningEndTime) {
          this.reasoningEndTime = Date.now();
        }
      } else {
        // Tag is currently open and streaming
        this.isThinking = true;
      }
    }
  }

  public getState(): PartitionedStreamState {
    // 1. Explicit reasoning flow
    if (this.hasExplicitReasoning) {
      const durationSec =
        this.reasoningStartTime !== null
          ? ((this.reasoningEndTime ?? Date.now()) - this.reasoningStartTime) / 1000
          : undefined;

      return {
        content: this.rawTokens,
        reasoning: this.explicitReasoning.trim() || undefined,
        reasoningDuration: durationSec,
        isThinking: this.isThinking,
      };
    }

    // 2. Inline <think> tag parsing flow
    const lower = this.rawTokens.toLowerCase();
    const startIndex = lower.indexOf(THINK_START);

    if (startIndex === -1) {
      // Check if rawTokens ends with a partial prefix of <think> (e.g. "<", "<th", "<think")
      // to avoid momentary flickering of partial tags into content
      let cleanContent = this.rawTokens;
      for (let i = 1; i < THINK_START.length; i++) {
        if (cleanContent.toLowerCase().endsWith(THINK_START.slice(0, i))) {
          cleanContent = cleanContent.slice(0, -i);
          break;
        }
      }

      return {
        content: cleanContent,
        reasoning: undefined,
        reasoningDuration: undefined,
        isThinking: false,
      };
    }

    const beforeThink = this.rawTokens.slice(0, startIndex);
    const afterStart = this.rawTokens.slice(startIndex + THINK_START.length);
    const endIndex = afterStart.toLowerCase().indexOf(THINK_END);

    if (endIndex === -1) {
      // Inside active <think> block
      // Filter out partial ending tag if buffering (e.g. "</thi")
      let cleanReasoning = afterStart;
      for (let i = 1; i < THINK_END.length; i++) {
        if (cleanReasoning.toLowerCase().endsWith(THINK_END.slice(0, i))) {
          cleanReasoning = cleanReasoning.slice(0, -i);
          break;
        }
      }

      const durationSec =
        this.reasoningStartTime !== null
          ? (Date.now() - this.reasoningStartTime) / 1000
          : undefined;

      return {
        content: beforeThink,
        reasoning: cleanReasoning.replace(/^\n/, ""),
        reasoningDuration: durationSec,
        isThinking: true,
      };
    }

    // Closed <think> block
    const reasoningText = afterStart.slice(0, endIndex).replace(/^\n/, "");
    const afterThink = afterStart.slice(endIndex + THINK_END.length);
    const combinedContent = `${beforeThink}${afterThink}`.replace(/^\s*\n/, "");

    const durationSec =
      this.reasoningStartTime !== null && this.reasoningEndTime !== null
        ? Math.max(0.1, (this.reasoningEndTime - this.reasoningStartTime) / 1000)
        : undefined;

    return {
      content: combinedContent,
      reasoning: reasoningText,
      reasoningDuration: durationSec,
      isThinking: false,
    };
  }
}
