"use client";

import { useState } from "react";
import { Download, Maximize2, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@repo/ui/components/button";
import { Badge } from "@repo/ui/components/badge";
import { Card, CardContent, CardFooter } from "@repo/ui/components/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import { cn } from "@repo/ui/lib/utils";

interface InteractiveChartImageProps {
  src: string;
  alt?: string;
  className?: string;
}

export function InteractiveChartImage({
  src,
  alt = "생성된 차트/시각화 이미지",
  className,
}: InteractiveChartImageProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [zoom, setZoom] = useState(1);

  const handleZoomIn = (e: React.MouseEvent) => {
    e.stopPropagation();
    setZoom((prev) => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = (e: React.MouseEvent) => {
    e.stopPropagation();
    setZoom((prev) => Math.max(prev - 0.25, 0.5));
  };

  return (
    <>
      {/* Thumbnail Card with Hover Overlay */}
      <Card
        data-testid="interactive-chart-card"
        size="sm"
        className={cn(
          "group/chart relative my-3 max-w-lg overflow-hidden shadow-xs cursor-pointer",
          className
        )}
        onClick={() => {
          setZoom(1);
          setIsOpen(true);
        }}
      >
        <CardContent className="p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            className="w-full h-auto rounded-xl object-contain bg-background/80 transition-transform duration-200 group-hover/chart:scale-[1.01]"
            loading="lazy"
          />

          {/* Hover Action Overlay */}
          <div className="absolute inset-0 bg-background/60 opacity-0 group-hover/chart:opacity-100 transition-opacity duration-150 rounded-none flex items-center justify-center gap-2">
            <Badge variant="secondary" className="gap-1.5 px-3 py-1 text-xs font-semibold shadow-md">
              <Maximize2 data-icon="inline-start" className="text-primary" />
              <span>크게 보기</span>
            </Badge>
          </div>
        </CardContent>

        {alt && (
          <CardFooter className="px-3 py-2 text-xs text-muted-foreground font-medium truncate">
            {alt}
          </CardFooter>
        )}
      </Card>

      {/* Artifact Lightbox Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent
          data-testid="chart-lightbox-modal"
          className="max-w-4xl p-4 gap-3 bg-popover"
        >
          <DialogHeader className="flex-row items-center justify-between pb-2 border-b border-border/50">
            <DialogTitle className="text-xs font-semibold text-foreground truncate max-w-md">
              {alt || "아티팩트 시각화 검사"}
            </DialogTitle>

            <div className="flex items-center gap-1.5 mr-6">
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={handleZoomIn}
                title="확대"
              >
                <ZoomIn data-icon="inline-start" />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={handleZoomOut}
                title="축소"
              >
                <ZoomOut data-icon="inline-start" />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                render={
                  <a
                    href={src}
                    download={alt || "chart.png"}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    title="원본 다운로드"
                  >
                    <Download data-icon="inline-start" />
                  </a>
                }
              />
            </div>
          </DialogHeader>

          {/* Lightbox Image Viewport */}
          <div className="max-h-[75vh] max-w-full overflow-auto flex items-center justify-center p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={alt}
              style={{ transform: `scale(${zoom})`, transition: "transform 0.15s ease-out" }}
              className="max-h-[70vh] max-w-full rounded-xl object-contain shadow-lg origin-center"
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
