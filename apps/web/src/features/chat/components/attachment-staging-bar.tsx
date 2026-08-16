"use client";

import { AlertCircle, X, Loader2 } from "lucide-react";
import {
  type StagedAttachment,
  formatFileSize,
  isImageMime,
  getAttachmentFileIcon,
} from "../hooks/use-direct-upload";

interface AttachmentStagingBarProps {
  stagedFiles: StagedAttachment[];
  onRemove: (id: string) => void;
  disabled?: boolean;
}

export function AttachmentStagingBar({
  stagedFiles,
  onRemove,
  disabled,
}: AttachmentStagingBarProps) {
  if (stagedFiles.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 px-3.5 pt-2.5 pb-1 max-h-36 overflow-y-auto">
      {stagedFiles.map((item) => {
        const isImg = isImageMime(item.mimeType);
        const IconComponent = getAttachmentFileIcon(item.mimeType);

        return (
          <div
            key={item.id}
            className={`relative flex items-center gap-2.5 p-1.5 pr-2.5 rounded-xl border text-xs max-w-[240px] select-none transition-all shadow-2xs ${
              item.status === "error"
                ? "bg-destructive/10 border-destructive/30 text-destructive"
                : "bg-muted/40 border-border/80 text-foreground"
            }`}
          >
            {/* Thumbnail or File Icon */}
            {isImg && item.previewUrl ? (
              <div className="relative size-9 shrink-0 rounded-lg overflow-hidden bg-muted/60 border border-border/40">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.previewUrl}
                  alt={item.name}
                  className="size-full object-cover"
                />
                {item.status === "uploading" && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <Loader2 className="size-4 text-white animate-spin" />
                  </div>
                )}
              </div>
            ) : (
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
                {item.status === "uploading" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : item.status === "error" ? (
                  <AlertCircle className="size-4 text-destructive" />
                ) : (
                  <IconComponent className="size-4" />
                )}
              </div>
            )}

            {/* File Info & Upload Progress */}
            <div className="flex flex-col min-w-0 flex-1">
              <span className="font-medium truncate text-[11px] leading-tight" title={item.name}>
                {item.name}
              </span>
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-0.5">
                <span>{formatFileSize(item.size)}</span>
                {item.status === "uploading" && (
                  <span className="text-primary font-medium">{item.progress}%</span>
                )}
                {item.status === "error" && (
                  <span className="text-destructive font-medium">실패</span>
                )}
              </div>

              {/* Mini Progress Bar */}
              {item.status === "uploading" && (
                <div className="w-full bg-border/60 h-1 rounded-full overflow-hidden mt-1">
                  <div
                    className="bg-primary h-full transition-all duration-150"
                    style={{ width: `${item.progress}%` }}
                  />
                </div>
              )}
            </div>

            {/* Remove Button */}
            <button
              type="button"
              onClick={() => onRemove(item.id)}
              disabled={disabled}
              className="size-5 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer shrink-0 disabled:opacity-50"
              title="파일 첨부 취소"
            >
              <X className="size-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
