"use client";

import React, { useState } from "react";
import {
  FileText,
  ImageIcon,
  FileSpreadsheet,
  FileCode,
  File,
  Download,
  Eye,
  Layers,
  Sparkles,
} from "lucide-react";
import type { AttachmentEntity, ChatArtifactEntity } from "@repo/validators";
import {
  Sheet,
  SheetContent,
} from "@repo/ui/components/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import { Button } from "@repo/ui/components/button";
import { Badge } from "@repo/ui/components/badge";
import { Card, CardContent } from "@repo/ui/components/card";

function getFileIcon(mimeType: string, filename: string) {
  if (mimeType.startsWith("image/")) {
    return <ImageIcon className="size-4 text-sky-500" data-icon="inline-start" />;
  }
  if (
    mimeType.includes("csv") ||
    mimeType.includes("spreadsheet") ||
    filename.endsWith(".csv") ||
    filename.endsWith(".xlsx")
  ) {
    return <FileSpreadsheet className="size-4 text-emerald-500" data-icon="inline-start" />;
  }
  if (
    mimeType.includes("json") ||
    mimeType.includes("javascript") ||
    mimeType.includes("python") ||
    filename.endsWith(".py") ||
    filename.endsWith(".ts") ||
    filename.endsWith(".js") ||
    filename.endsWith(".html") ||
    filename.endsWith(".css")
  ) {
    return <FileCode className="size-4 text-amber-500" data-icon="inline-start" />;
  }
  if (mimeType.includes("pdf") || mimeType.includes("text/")) {
    return <FileText className="size-4 text-primary" data-icon="inline-start" />;
  }
  return <File className="size-4 text-muted-foreground" data-icon="inline-start" />;
}

function formatBytes(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export interface ArtifactListPanelProps {
  sessionId: string;
  artifacts: (ChatArtifactEntity & { url?: string; downloadUrl?: string })[];
  attachments?: AttachmentEntity[];
  onSelectImage?: (img: { src: string; alt: string }) => void;
}

export function ArtifactListPanel({
  sessionId,
  artifacts,
  attachments = [],
  onSelectImage,
}: ArtifactListPanelProps) {
  const totalCount = artifacts.length + attachments.length;

  return (
    <div className="flex flex-col h-full bg-background" data-testid="artifact-list-panel">
      {/* Gemini-style Panel Header: Files */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/40 shrink-0 pr-12">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold tracking-tight text-foreground">
            Files
          </h3>
          {totalCount > 0 && (
            <Badge variant="secondary" className="h-5 px-1.5 text-[11px] font-mono">
              {totalCount}
            </Badge>
          )}
        </div>
      </div>

      {/* Body: Created (Artifacts) & Added (User Attachments) Sections */}
      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar scrollbar-none px-5 py-4 space-y-6">
        {/* Section 1: Created (에이전트가 생성한 산출물) */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground tracking-wide">
              Created
            </span>
            {artifacts.length > 0 && (
              <span className="text-[11px] text-muted-foreground/70 font-mono">
                {artifacts.length}개
              </span>
            )}
          </div>

          {artifacts.length === 0 ? (
            <div className="py-3 text-xs text-muted-foreground/70">
              아직 생성된 산출물이 없습니다.
            </div>
          ) : (
            <div className="space-y-2">
              {artifacts.map((art) => {
                const isImage = art.mimeType.startsWith("image/");
                const downloadUrl =
                  art.downloadUrl ||
                  art.url ||
                  `/api/chat/sessions/${sessionId}/artifacts/${encodeURIComponent(art.name)}`;

                return (
                  <Card
                    key={art.id}
                    className="group border border-border/70 bg-card hover:border-primary/40 transition-all shadow-2xs overflow-hidden"
                  >
                    <CardContent className="p-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="size-8 rounded-xl bg-muted/50 flex items-center justify-center shrink-0 border border-border/50">
                          {getFileIcon(art.mimeType, art.name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4
                            className="text-xs font-medium text-foreground truncate group-hover:text-primary transition-colors"
                            title={art.name}
                          >
                            {art.name}
                          </h4>
                          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-0.5 font-mono">
                            <span>{formatBytes(art.sizeBytes)}</span>
                            <span>•</span>
                            <span>
                              {new Date(art.createdAt).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-1 shrink-0">
                        {isImage && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-muted-foreground hover:text-foreground cursor-pointer"
                            title="미리보기"
                            onClick={() => {
                              onSelectImage?.({
                                src: downloadUrl,
                                alt: art.name,
                              });
                            }}
                          >
                            <Eye className="size-3.5" data-icon="inline-start" />
                          </Button>
                        )}
                        <a
                          href={downloadUrl}
                          download={art.name}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button
                            variant="outline"
                            size="icon"
                            className="size-7 text-muted-foreground hover:text-foreground hover:border-primary/40 cursor-pointer"
                            title="다운로드"
                          >
                            <Download className="size-3.5" data-icon="inline-start" />
                          </Button>
                        </a>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Section 2: Added (사용자가 첨부한 파일) */}
        <div className="space-y-2.5 pt-2 border-t border-border/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground tracking-wide">
              Added
            </span>
            {attachments.length > 0 && (
              <span className="text-[11px] text-muted-foreground/70 font-mono">
                {attachments.length}개
              </span>
            )}
          </div>

          {attachments.length === 0 ? (
            <div className="py-3 text-xs text-muted-foreground/70">
              첨부된 파일이 없습니다.
            </div>
          ) : (
            <div className="space-y-2">
              {attachments.map((att) => {
                const isImage = att.mimeType.startsWith("image/");
                return (
                  <Card
                    key={att.id}
                    className="group border border-border/70 bg-card hover:border-primary/40 transition-all shadow-2xs overflow-hidden"
                  >
                    <CardContent className="p-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="size-8 rounded-xl bg-muted/50 flex items-center justify-center shrink-0 border border-border/50">
                          {getFileIcon(att.mimeType, att.name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4
                            className="text-xs font-medium text-foreground truncate group-hover:text-primary transition-colors"
                            title={att.name}
                          >
                            {att.name}
                          </h4>
                          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-0.5 font-mono">
                            <span>{formatBytes(att.size)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {isImage && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-muted-foreground hover:text-foreground cursor-pointer"
                            title="미리보기"
                            onClick={() => {
                              onSelectImage?.({
                                src: att.url,
                                alt: att.name,
                              });
                            }}
                          >
                            <Eye className="size-3.5" data-icon="inline-start" />
                          </Button>
                        )}
                        <a
                          href={att.url}
                          download={att.name}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button
                            variant="outline"
                            size="icon"
                            className="size-7 text-muted-foreground hover:text-foreground hover:border-primary/40 cursor-pointer"
                            title="다운로드"
                          >
                            <Download className="size-3.5" data-icon="inline-start" />
                          </Button>
                        </a>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export interface ArtifactSidebarProps {
  sessionId: string;
  artifacts: (ChatArtifactEntity & { url?: string; downloadUrl?: string })[];
  attachments?: AttachmentEntity[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ArtifactSidebar({
  sessionId,
  artifacts,
  attachments,
  isOpen,
  onOpenChange,
}: ArtifactSidebarProps) {
  const [selectedImage, setSelectedImage] = useState<{
    src: string;
    alt: string;
  } | null>(null);

  return (
    <>
      <Sheet open={isOpen} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-md p-0 flex flex-col bg-background border-l border-border/60 shadow-xl"
        >
          <ArtifactListPanel
            sessionId={sessionId}
            artifacts={artifacts}
            attachments={attachments}
            onSelectImage={setSelectedImage}
          />
        </SheetContent>
      </Sheet>

      {/* Lightbox for Image Previews */}
      {selectedImage && (
        <Dialog
          open={!!selectedImage}
          onOpenChange={(open) => {
            if (!open) setSelectedImage(null);
          }}
        >
          <DialogContent className="max-w-4xl p-2 bg-background/95 backdrop-blur-md border border-border/80 shadow-2xl">
            <DialogHeader className="px-4 py-2 border-b border-border/40">
              <DialogTitle className="text-xs font-semibold truncate">
                {selectedImage.alt}
              </DialogTitle>
            </DialogHeader>
            <div className="flex items-center justify-center p-4 max-h-[75vh] overflow-hidden">
              <img
                src={selectedImage.src}
                alt={selectedImage.alt}
                className="max-h-[70vh] w-auto object-contain rounded-lg shadow-sm"
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
