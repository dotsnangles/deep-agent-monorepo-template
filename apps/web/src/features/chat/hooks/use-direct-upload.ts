"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { FileText, FileSpreadsheet, FileCode, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import {
  ALLOWED_ATTACHMENT_MIME_TYPES,
  MAX_ATTACHMENT_SIZE_BYTES,
  MAX_ATTACHMENTS_PER_MESSAGE,
  type AttachmentEntity,
  type PresignedUploadResponseDTO,
} from "@repo/validators";

export interface StagedAttachment {
  id: string;
  file: File;
  name: string;
  size: number;
  mimeType: string;
  previewUrl?: string;
  progress: number;
  status: "uploading" | "complete" | "error";
  error?: string;
  entity?: AttachmentEntity;
}

export interface UseDirectUploadOptions {
  sessionId?: string;
  maxFiles?: number;
  onUploadComplete?: (entity: AttachmentEntity) => void;
  onUploadError?: (error: string) => void;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function isImageMime(mimeType: string): boolean {
  return mimeType.toLowerCase().startsWith("image/");
}

export function getAttachmentFileIcon(mimeType: string): LucideIcon {
  if (mimeType === "text/csv") return FileSpreadsheet;
  if (mimeType === "application/json" || mimeType === "text/markdown") {
    return FileCode;
  }
  return FileText;
}

export function useDirectUpload(options?: UseDirectUploadOptions) {
  const [stagedFiles, setStagedFiles] = useState<StagedAttachment[]>([]);
  const maxFiles = options?.maxFiles || MAX_ATTACHMENTS_PER_MESSAGE;
  const activeXhrsRef = useRef<Map<string, XMLHttpRequest>>(new Map());
  const createdBlobUrlsRef = useRef<Set<string>>(new Set());

  // Clean up all object URLs and abort ongoing XHRs on unmount
  useEffect(() => {
    const urls = createdBlobUrlsRef.current;
    const xhrs = activeXhrsRef.current;
    return () => {
      for (const url of urls) {
        URL.revokeObjectURL(url);
      }
      urls.clear();
      for (const xhr of xhrs.values()) {
        xhr.abort();
      }
      xhrs.clear();
    };
  }, []);

  const uploadFile = async (
    tempId: string,
    file: File,
    sessionId?: string
  ): Promise<AttachmentEntity | null> => {
    try {
      // 1. Request presigned upload URL
      const presignedRes = await fetch("/api/storage/presigned-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
          sessionId,
        }),
      });

      if (!presignedRes.ok) {
        const errorData = await presignedRes.json().catch(() => ({}));
        throw new Error(errorData.error || `업로드 URL 발급 실패 (HTTP ${presignedRes.status})`);
      }

      const presignedData: PresignedUploadResponseDTO = await presignedRes.json();

      // 2. Perform direct PUT upload to S3/MinIO with progress tracking
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        activeXhrsRef.current.set(tempId, xhr);

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = Math.min(99, Math.round((event.loaded / event.total) * 100));
            setStagedFiles((prev) =>
              prev.map((item) => (item.id === tempId ? { ...item, progress: percent } : item))
            );
          }
        };

        xhr.onload = () => {
          activeXhrsRef.current.delete(tempId);
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`S3 업로드 실패 (HTTP ${xhr.status})`));
          }
        };

        xhr.onerror = () => {
          activeXhrsRef.current.delete(tempId);
          reject(new Error("네트워크 연결 오류로 업로드에 실패했습니다."));
        };

        xhr.onabort = () => {
          activeXhrsRef.current.delete(tempId);
          reject(new Error("업로드가 취소되었습니다."));
        };

        xhr.open("PUT", presignedData.uploadUrl, true);
        xhr.setRequestHeader("Content-Type", file.type);
        xhr.send(file);
      });

      const entity: AttachmentEntity = {
        id: presignedData.id,
        name: presignedData.name,
        url: presignedData.downloadUrl,
        mimeType: presignedData.mimeType,
        size: presignedData.size,
        s3Key: presignedData.key,
      };

      setStagedFiles((prev) =>
        prev.map((item) =>
          item.id === tempId
            ? {
                ...item,
                progress: 100,
                status: "complete",
                entity,
              }
            : item
        )
      );

      options?.onUploadComplete?.(entity);
      return entity;
    } catch (err: any) {
      const errorMessage = err?.message || "파일 업로드 실패";
      setStagedFiles((prev) =>
        prev.map((item) =>
          item.id === tempId
            ? {
                ...item,
                status: "error",
                error: errorMessage,
              }
            : item
        )
      );
      toast.error(`'${file.name}' 업로드 실패: ${errorMessage}`);
      options?.onUploadError?.(errorMessage);
      return null;
    }
  };

  const addFiles = useCallback(
    async (incoming: FileList | File[]) => {
      const filesArray = Array.from(incoming);
      if (filesArray.length === 0) return;

      const currentCount = stagedFiles.length;
      if (currentCount + filesArray.length > maxFiles) {
        toast.error(`메시지당 최대 ${maxFiles}개의 파일만 첨부할 수 있습니다.`);
        return;
      }

      const validFilesToUpload: Array<{ id: string; file: File; staged: StagedAttachment }> = [];

      for (const file of filesArray) {
        // Validate MIME type
        const isMimeAllowed = (ALLOWED_ATTACHMENT_MIME_TYPES as readonly string[]).includes(
          file.type
        );
        if (!isMimeAllowed) {
          toast.error(
            `'${file.name}': 지원하지 않는 파일 형식입니다. (이미지, PDF, TXT, CSV, JSON, MD만 지원)`
          );
          continue;
        }

        // Validate File Size
        if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
          toast.error(
            `'${file.name}': 파일 크기가 20MB를 초과했습니다. (${formatFileSize(file.size)})`
          );
          continue;
        }

        const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        let previewUrl: string | undefined;
        if (isImageMime(file.type)) {
          previewUrl = URL.createObjectURL(file);
          createdBlobUrlsRef.current.add(previewUrl);
        }

        const stagedItem: StagedAttachment = {
          id: tempId,
          file,
          name: file.name,
          size: file.size,
          mimeType: file.type,
          previewUrl,
          progress: 0,
          status: "uploading",
        };

        validFilesToUpload.push({ id: tempId, file, staged: stagedItem });
      }

      if (validFilesToUpload.length === 0) return;

      // Add to staged items state immediately
      setStagedFiles((prev) => [...prev, ...validFilesToUpload.map((v) => v.staged)]);

      // Execute uploads in parallel
      await Promise.all(
        validFilesToUpload.map(({ id, file }) => uploadFile(id, file, options?.sessionId))
      );
    },
    [stagedFiles.length, maxFiles, options?.sessionId]
  );

  const removeFile = useCallback((id: string) => {
    const activeXhr = activeXhrsRef.current.get(id);
    if (activeXhr) {
      activeXhr.abort();
      activeXhrsRef.current.delete(id);
    }

    setStagedFiles((prev) => {
      const itemToRemove = prev.find((item) => item.id === id);
      if (itemToRemove?.previewUrl) {
        URL.revokeObjectURL(itemToRemove.previewUrl);
        createdBlobUrlsRef.current.delete(itemToRemove.previewUrl);
      }
      return prev.filter((item) => item.id !== id);
    });
  }, []);

  const clearStaged = useCallback(() => {
    for (const url of createdBlobUrlsRef.current) {
      URL.revokeObjectURL(url);
    }
    createdBlobUrlsRef.current.clear();
    for (const xhr of activeXhrsRef.current.values()) {
      xhr.abort();
    }
    activeXhrsRef.current.clear();
    setStagedFiles([]);
  }, []);

  const isUploading = stagedFiles.some((f) => f.status === "uploading");
  const completedAttachments: AttachmentEntity[] = stagedFiles
    .filter((f) => f.status === "complete" && f.entity)
    .map((f) => f.entity!);

  return {
    stagedFiles,
    isUploading,
    completedAttachments,
    addFiles,
    removeFile,
    clearStaged,
  };
}
