"use client";

import * as React from "react";
import { cn } from "@hollow-echo-distant-signal/ui/lib/utils";

function Avatar({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="avatar"
      className={cn(
        "relative flex size-8 shrink-0 overflow-hidden rounded-full border border-border/50 select-none",
        className,
      )}
      {...props}
    />
  );
}

function AvatarImage({
  className,
  alt = "",
  src,
  ...props
}: React.ComponentProps<"img">) {
  if (!src) {
    return null;
  }

  return (
    <img
      data-slot="avatar-image"
      alt={alt}
      src={src}
      className={cn("aspect-square size-full object-cover", className)}
      {...props}
    />
  );
}

function AvatarFallback({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="avatar-fallback"
      className={cn(
        "flex size-full items-center justify-center rounded-full bg-muted font-medium text-xs text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

export { Avatar, AvatarImage, AvatarFallback };
