"use client";

import { useState, useEffect } from "react";
import { Download, Maximize2, X, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@repo/ui/components/button";

interface InteractiveChartImageProps {
  src: string;
  alt?: string;
  className?: string;
}

export function InteractiveChartImage({
  src,
  alt = "생성된 차트/시각화 이미지",
  className = "",
}: InteractiveChartImageProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [zoom, setZoom] = useState(1);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

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
      <div
        data-testid="interactive-chart-card"
        className={`group relative my-3 max-w-lg rounded-2xl border border-border/80 bg-card/60 p-2 overflow-hidden shadow-xs hover:border-primary/50 transition-all duration-200 cursor-pointer ${className}`}
        onClick={() => {
          setZoom(1);
          setIsOpen(true);
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          className="w-full h-auto rounded-xl object-contain bg-background/80 transition-transform duration-200 group-hover:scale-[1.01]"
          loading="lazy"
        />

        {/* Hover Action Overlay */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-150 rounded-2xl flex items-center justify-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-background/90 text-foreground text-xs font-semibold shadow-lg backdrop-blur-xs">
            <Maximize2 className="size-3.5 text-primary" />
            <span>크게 보기</span>
          </div>
        </div>

        {alt && (
          <div className="px-2 pt-2 pb-0.5 text-xs text-muted-foreground font-medium truncate">
            {alt}
          </div>
        )}
      </div>

      {/* Lightbox Modal */}
      {isOpen && (
        <div
          data-testid="chart-lightbox-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 sm:p-8 backdrop-blur-sm animate-in fade-in-50 duration-150"
          onClick={() => setIsOpen(false)}
        >
          {/* Top Control Bar */}
          <div className="absolute top-4 right-4 z-60 flex items-center gap-2">
            <Button
              variant="secondary"
              size="icon"
              className="size-9 rounded-full bg-black/60 text-white hover:bg-black/90 hover:text-white border-0 shadow-lg cursor-pointer"
              onClick={handleZoomIn}
              title="확대"
            >
              <ZoomIn className="size-4" />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              className="size-9 rounded-full bg-black/60 text-white hover:bg-black/90 hover:text-white border-0 shadow-lg cursor-pointer"
              onClick={handleZoomOut}
              title="축소"
            >
              <ZoomOut className="size-4" />
            </Button>
            <a
              href={src}
              download={alt || "chart.png"}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center justify-center size-9 rounded-full bg-black/60 text-white hover:bg-black/90 hover:text-white transition-colors shadow-lg"
              title="원본 다운로드"
            >
              <Download className="size-4" />
            </a>
            <Button
              variant="secondary"
              size="icon"
              className="size-9 rounded-full bg-black/60 text-white hover:bg-black/90 hover:text-white border-0 shadow-lg cursor-pointer"
              onClick={() => setIsOpen(false)}
              title="닫기 (ESC)"
            >
              <X className="size-4" />
            </Button>
          </div>

          {/* Lightbox Image Viewport */}
          <div
            className="max-h-[85vh] max-w-[90vw] overflow-auto flex flex-col items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={alt}
              style={{ transform: `scale(${zoom})`, transition: "transform 0.15s ease-out" }}
              className="max-h-[80vh] max-w-full rounded-xl object-contain shadow-2xl origin-center"
            />
            {alt && (
              <span className="text-xs text-white/80 mt-3 font-medium px-3 py-1 rounded-full bg-black/40">
                {alt}
              </span>
            )}
          </div>
        </div>
      )}
    </>
  );
}
