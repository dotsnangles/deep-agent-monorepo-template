"use client";

import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { Check, Copy } from "lucide-react";
import { useCopyToClipboard } from "../hooks/use-copy-to-clipboard";

interface CodeBlockProps {
  language?: string;
  value: string;
}

function CodeBlock({ language, value }: CodeBlockProps) {
  const { copied, copy } = useCopyToClipboard("코드가 클립보드에 복사되었습니다.");

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-border/70 bg-card shadow-xs">
      {/* Code Header Bar */}
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-muted/70 border-b border-border/50 text-[11px] font-mono text-muted-foreground">
        <span className="font-semibold text-foreground/80 lowercase">
          {language || "code"}
        </span>
        <button
          type="button"
          onClick={() => copy(value)}
          className="flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] hover:bg-background/80 hover:text-foreground transition-all cursor-pointer"
          title="코드 복사"
        >
          {copied ? (
            <>
              <Check className="size-3 text-emerald-500" />
              <span className="text-emerald-500 font-medium">복사됨</span>
            </>
          ) : (
            <>
              <Copy className="size-3" />
              <span>복사</span>
            </>
          )}
        </button>
      </div>

      {/* Code Body */}
      <pre className="overflow-x-auto p-3.5 text-xs font-mono leading-relaxed bg-muted/30 text-foreground/90 font-medium">
        <code>{value}</code>
      </pre>
    </div>
  );
}

interface MarkdownRendererProps {
  content: string;
  isGenerating?: boolean;
}

export const MarkdownRenderer = memo(function MarkdownRenderer({
  content,
  isGenerating = false,
}: MarkdownRendererProps) {
  return (
    <div className="prose-chat text-sm leading-relaxed text-foreground/95 break-words relative">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || "");
            const isInline = !match && !String(children).includes("\n");

            if (isInline) {
              return (
                <code
                  className="rounded-md bg-muted/80 px-1.5 py-0.5 font-mono text-[13px] text-foreground border border-border/40 font-medium"
                  {...props}
                >
                  {children}
                </code>
              );
            }

            const codeContent = String(children).replace(/\n$/, "");
            return (
              <CodeBlock
                language={match ? match[1] : undefined}
                value={codeContent}
              />
            );
          },
          p({ children }) {
            return <p className="mb-2.5 last:mb-0 leading-relaxed">{children}</p>;
          },
          ul({ children }) {
            return <ul className="list-disc pl-5 mb-2.5 space-y-1">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="list-decimal pl-5 mb-2.5 space-y-1">{children}</ol>;
          },
          li({ children }) {
            return <li className="leading-relaxed">{children}</li>;
          },
          blockquote({ children }) {
            return (
              <blockquote className="border-l-2 border-primary/60 pl-3.5 my-2.5 italic text-muted-foreground bg-muted/20 py-1 rounded-r-md">
                {children}
              </blockquote>
            );
          },
          table({ children }) {
            return (
              <div className="my-3 overflow-x-auto rounded-lg border border-border/60 shadow-2xs">
                <table className="w-full text-left text-xs border-collapse">{children}</table>
              </div>
            );
          },
          thead({ children }) {
            return (
              <thead className="bg-muted/70 border-b border-border/60 font-semibold text-foreground">
                {children}
              </thead>
            );
          },
          th({ children }) {
            return <th className="px-3.5 py-2 text-xs font-semibold">{children}</th>;
          },
          td({ children }) {
            return <td className="px-3.5 py-2 text-xs border-t border-border/40 text-foreground/90">{children}</td>;
          },
          tr({ children }) {
            return <tr className="hover:bg-muted/20 transition-colors">{children}</tr>;
          },
          h1({ children }) {
            return <h1 className="text-lg font-bold tracking-tight text-foreground mt-4 mb-2">{children}</h1>;
          },
          h2({ children }) {
            return <h2 className="text-base font-semibold tracking-tight text-foreground mt-3.5 mb-1.5">{children}</h2>;
          },
          h3({ children }) {
            return <h3 className="text-sm font-semibold tracking-tight text-foreground mt-3 mb-1">{children}</h3>;
          },
          hr() {
            return <hr className="my-3.5 border-border/50" />;
          },
          a({ href, children }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary font-medium underline underline-offset-4 hover:opacity-80 transition-opacity"
              >
                {children}
              </a>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>

      {/* Streaming blinking cursor */}
      {isGenerating && (
        <span className="inline-block size-2 rounded-full bg-primary animate-ping ml-1 align-baseline" />
      )}
    </div>
  );
});
