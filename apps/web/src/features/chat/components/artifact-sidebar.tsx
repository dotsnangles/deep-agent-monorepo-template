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
import type { ChatArtifactEntity } from "@repo/validators";
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
  onSelectImage?: (img: { src: string; alt: string }) => void;
}

export function ArtifactListPanel({
  sessionId,
  artifacts,
  onSelectImage,
}: ArtifactListPanelProps) {
  return (
    <div className="flex flex-col h-full bg-background" data-testid="artifact-list-panel">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border/40 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="size-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary shadow-xs">
              <Layers className="size-4" />
            </div>
            <div className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-2">
              <span>대화 산출물</span>
              <Badge variant="secondary" className="h-5 px-1.5 text-[11px] font-mono">
                {artifacts.length}
              </Badge>
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground pt-1">
          에이전트가 대화 중 생성한 차트, 파일 및 데이터 결과물 목록입니다.
        </p>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-3">
        {artifacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center space-y-3 py-12">
            <div className="size-12 rounded-2xl bg-muted/60 flex items-center justify-center text-muted-foreground/60 shadow-2xs">
              <Sparkles className="size-6" />
            </div>
            <div className="space-y-1 max-w-[240px]">
              <p className="text-xs font-semibold text-foreground">
                아직 생성된 산출물이 없습니다
              </p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                에이전트에게 데이터 분석, 차트 그리기, 보고서 작성을 요청해 보세요.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2.5">
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
                  <CardContent className="p-3.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="size-9 rounded-xl bg-muted/50 flex items-center justify-center shrink-0 border border-border/50">
                        {getFileIcon(art.mimeType, art.name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4
                          className="text-xs font-medium text-foreground truncate group-hover:text-primary transition-colors"
                          title={art.name}
                        >
                          {art.name}
                        </h4>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5 font-mono">
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
                          className="size-7 text-muted-foreground hover:text-foreground"
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
                          className="size-7 text-muted-foreground hover:text-foreground hover:border-primary/40"
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
  );
}

export interface ArtifactSidebarProps {
  sessionId: string;
  artifacts: (ChatArtifactEntity & { url?: string; downloadUrl?: string })[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ArtifactSidebar({
  sessionId,
  artifacts,
  isOpen,
  onOpenChange,
}: ArtifactSidebarProps) {
  const [selectedImage, setSelectedImage] = useState<{
    src: string;
    alt: string;
  } | null>(null);
  const [fetchedArtifacts, setFetchedArtifacts] = useState<
    (ChatArtifactEntity & { url?: string; downloadUrl?: string })[]
  >([]);

  React.useEffect(() => {
    if (!isOpen || !sessionId) return;
    let isSubscribed = true;
    fetch(`/api/chat/sessions/${encodeURIComponent(sessionId)}/artifacts`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isSubscribed && data?.artifacts) {
          setFetchedArtifacts(data.artifacts);
        }
      })
      .catch((err) => {
        console.warn("[ArtifactSidebar] Failed to fetch session artifacts:", err);
      });
    return () => {
      isSubscribed = false;
    };
  }, [isOpen, sessionId]);

  const displayArtifacts = React.useMemo(() => {
    const map = new Map<string, ChatArtifactEntity & { url?: string; downloadUrl?: string }>();
    for (const art of artifacts) {
      map.set(art.id, art);
    }
    for (const art of fetchedArtifacts) {
      map.set(art.id, art);
    }
    return Array.from(map.values());
  }, [artifacts, fetchedArtifacts]);

  return (
    <>
      <Sheet open={isOpen} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-md p-0 flex flex-col bg-background border-l border-border/60 shadow-xl"
        >
          <ArtifactListPanel
            sessionId={sessionId}
            artifacts={displayArtifacts}
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
