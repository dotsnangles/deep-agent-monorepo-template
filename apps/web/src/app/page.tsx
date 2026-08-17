"use client";

import { useState } from "react";
import { FolderArchive, Layers, MoreVertical, Share2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import {
  MessageFeed,
  useChatSessions,
  useChatEngine,
  ArtifactSidebar,
} from "@/features/chat";

export default function Home() {
  const { activeSessionId, deleteSession } = useChatSessions();
  const { artifacts, activePath } = useChatEngine(activeSessionId);
  const [isArtifactsOpen, setIsArtifactsOpen] = useState(false);

  const sessionAttachments = activePath.flatMap((m) => m.attachments || []);

  const handleShare = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      toast.success("대화 링크가 클립보드에 복사되었습니다.");
    }
  };

  return (
    <div className="flex flex-col h-full w-full relative">
      {/* Top-Right Gemini-style Minimalist Action Bar */}
      <div className="absolute top-3 right-4 z-20 flex items-center gap-1.5">
        {artifacts.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-2.5 rounded-xl text-xs gap-1.5 bg-background/80 backdrop-blur-xs border-border/70 hover:border-primary/50 shadow-xs cursor-pointer animate-in fade-in duration-200"
            onClick={() => setIsArtifactsOpen(true)}
            title="대화 파일 및 산출물 보기"
          >
            <Layers className="size-3.5 text-primary" data-icon="inline-start" />
            <span className="hidden sm:inline">산출물</span>
            <Badge variant="secondary" className="h-4 px-1 text-[10px] font-mono leading-none">
              {artifacts.length}
            </Badge>
          </Button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="size-8 rounded-xl text-muted-foreground hover:text-foreground bg-background/60 hover:bg-muted/80 backdrop-blur-xs shadow-xs cursor-pointer"
                title="더보기"
              />
            }
          >
            <MoreVertical className="size-4" />
            <span className="sr-only">대화 옵션</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem
              onClick={() => setIsArtifactsOpen(true)}
              className="gap-2.5 text-xs cursor-pointer"
            >
              <FolderArchive className="size-4 text-primary" />
              <span>이 대화의 파일 (Files)</span>
              {artifacts.length > 0 && (
                <Badge variant="secondary" className="ml-auto h-4 px-1 text-[9px] font-mono leading-none">
                  {artifacts.length}
                </Badge>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleShare} className="gap-2.5 text-xs cursor-pointer">
              <Share2 className="size-4" />
              <span>대화 링크 복사</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => deleteSession(activeSessionId)}
              className="gap-2.5 text-xs text-destructive focus:text-destructive cursor-pointer"
            >
              <Trash2 className="size-4" />
              <span>대화 삭제</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Main Fullscreen Message Feed */}
      <div className="flex-1 min-h-0 relative flex flex-col w-full overflow-hidden">
        <MessageFeed
          key={activeSessionId}
          sessionId={activeSessionId}
          onOpenArtifacts={() => setIsArtifactsOpen(true)}
        />
      </div>

      {/* Right Artifacts & Files Drawer */}
      <ArtifactSidebar
        sessionId={activeSessionId}
        artifacts={artifacts}
        attachments={sessionAttachments}
        isOpen={isArtifactsOpen}
        onOpenChange={setIsArtifactsOpen}
      />
    </div>
  );
}
