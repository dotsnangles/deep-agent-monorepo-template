"use client";

import { AlertCircle, X, Loader2 } from "lucide-react";
import {
  Attachment,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentContent,
  AttachmentTitle,
  AttachmentDescription,
  AttachmentAction,
} from "@repo/ui/components/attachment";
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
    <div className="px-3.5 pt-2.5 pb-1 max-h-36 overflow-y-auto">
      <AttachmentGroup className="max-w-full">
        {stagedFiles.map((item) => {
          const isImg = isImageMime(item.mimeType);
          const IconComponent = getAttachmentFileIcon(item.mimeType);
          const state =
            item.status === "error"
              ? "error"
              : item.status === "uploading"
              ? "uploading"
              : "done";

          return (
            <Attachment key={item.id} state={state} size="sm">
              <AttachmentMedia variant={isImg && item.previewUrl ? "image" : "icon"}>
                {isImg && item.previewUrl ? (
                  <>
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
                  </>
                ) : item.status === "uploading" ? (
                  <Loader2 className="size-4 animate-spin text-primary" />
                ) : item.status === "error" ? (
                  <AlertCircle className="size-4 text-destructive" />
                ) : (
                  <IconComponent className="size-4 text-primary" />
                )}
              </AttachmentMedia>

              <AttachmentContent>
                <AttachmentTitle>{item.name}</AttachmentTitle>
                <AttachmentDescription>
                  {formatFileSize(item.size)}
                  {item.status === "uploading" && ` · ${item.progress}%`}
                  {item.status === "error" && " · 실패"}
                </AttachmentDescription>
              </AttachmentContent>

              <AttachmentAction
                disabled={disabled}
                onClick={() => onRemove(item.id)}
                title="파일 첨부 취소"
              >
                <X data-icon="inline-start" />
              </AttachmentAction>
            </Attachment>
          );
        })}
      </AttachmentGroup>
    </div>
  );
}
