"use client";

import { useState, useRef, useEffect, DragEvent, ChangeEvent } from "react";
import { UploadCloud, FileText, Image as ImageIcon, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/ui";
import { Button } from "@/components/ui/button";

export const ALLOWED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

export const BLOCKED_EXTENSIONS = [
  ".exe",
  ".bat",
  ".cmd",
  ".sh",
  ".msi",
  ".js",
  ".vbs",
  ".ps1",
  ".bin",
  ".dll",
  ".scr",
  ".com",
];

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_FILES_COUNT = 5;

export interface FileUploaderProps {
  files: File[];
  onFilesChange: (files: File[]) => void;
  maxFiles?: number;
  maxSizeBytes?: number;
  disabled?: boolean;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileThumbnail({ file }: { file: File }) {
  const isPdf = file.type === "application/pdf";
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file.type.startsWith("image/")) return;
    let cancelled = false;
    const reader = new FileReader();
    reader.onload = () => {
      if (!cancelled && typeof reader.result === "string") {
        setDataUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
    return () => {
      cancelled = true;
    };
  }, [file]);

  if (dataUrl) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={dataUrl}
        alt={file.name}
        className="size-full object-cover"
      />
    );
  }

  if (isPdf) {
    return <FileText className="size-4 text-rose-400" />;
  }

  return <ImageIcon className="size-4 text-primary" />;
}

export function FileUploader({
  files,
  onFilesChange,
  maxFiles = MAX_FILES_COUNT,
  maxSizeBytes = MAX_FILE_SIZE_BYTES,
  disabled = false,
}: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function validateAndAddFiles(incomingFiles: FileList | File[]) {
    if (disabled) return;
    const array = Array.from(incomingFiles);

    const validNewFiles: File[] = [];

    for (const file of array) {
      const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
      if (BLOCKED_EXTENSIONS.includes(ext)) {
        toast.error(`File "${file.name}" has an unsafe file extension and was rejected.`);
        continue;
      }

      if (!ALLOWED_MIME_TYPES.includes(file.type as AllowedMimeType)) {
        toast.error(`"${file.name}" is not a supported format. Please upload PNG, JPG, WEBP, or PDF.`);
        continue;
      }

      if (file.size > maxSizeBytes) {
        toast.error(
          `"${file.name}" exceeds the ${maxSizeBytes / (1024 * 1024)} MB size limit (${formatFileSize(file.size)}).`
        );
        continue;
      }

      // Check if duplicate file already added
      const isDuplicate = files.some(
        (f) => f.name === file.name && f.size === file.size && f.lastModified === file.lastModified
      );
      if (isDuplicate) {
        toast.info(`"${file.name}" has already been attached.`);
        continue;
      }

      validNewFiles.push(file);
    }

    if (validNewFiles.length === 0) return;

    if (files.length + validNewFiles.length > maxFiles) {
      toast.error(`You can attach a maximum of ${maxFiles} files.`);
      const allowedCount = maxFiles - files.length;
      if (allowedCount > 0) {
        onFilesChange([...files, ...validNewFiles.slice(0, allowedCount)]);
      }
      return;
    }

    onFilesChange([...files, ...validNewFiles]);
  }

  function handleDragOver(e: DragEvent<HTMLElement>) {
    e.preventDefault();
    if (disabled) return;
    setIsDragging(true);
  }

  function handleDragLeave(e: DragEvent<HTMLElement>) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(e: DragEvent<HTMLElement>) {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    if (e.dataTransfer?.files) {
      validateAndAddFiles(e.dataTransfer.files);
    }
  }

  function handleInputChange(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      validateAndAddFiles(e.target.files);
      // Reset input value to allow re-selection of the same file if removed
      e.target.value = "";
    }
  }

  function removeFile(index: number) {
    if (disabled) return;
    const updated = files.filter((_, i) => i !== index);
    onFilesChange(updated);
  }

  return (
    <div className="space-y-3">
      {/* Drop Zone */}
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label="Upload feedback attachments"
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) {
            // Preserve current scroll position on mobile before triggering file picker
            const currentScroll = typeof window !== "undefined" ? window.scrollY : 0;
            fileInputRef.current?.click();
            if (typeof window !== "undefined") {
              requestAnimationFrame(() => {
                if (window.scrollY !== currentScroll) {
                  window.scrollTo({ top: currentScroll, behavior: "instant" });
                }
              });
            }
          }
        }}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !disabled) {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{ touchAction: "manipulation" }}
        className={cn(
          "relative flex flex-col items-center justify-center p-6 rounded-xl border-2 border-dashed transition-all cursor-pointer select-none overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-primary",
          isDragging
            ? "border-primary bg-primary/10 scale-[1.005]"
            : "border-border/80 hover:border-primary/60 bg-muted/20 hover:bg-muted/30",
          disabled && "opacity-50 cursor-not-allowed pointer-events-none"
        )}
      >
        {/* Hidden file input placed inside relative dropzone to retain exact document coordinates */}
        <input
          ref={fileInputRef}
          id="feedback-file-upload-input"
          type="file"
          multiple
          accept={ALLOWED_MIME_TYPES.join(",")}
          onChange={handleInputChange}
          disabled={disabled}
          tabIndex={-1}
          aria-hidden="true"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            opacity: 0,
            pointerEvents: "none",
            zIndex: -1,
          }}
        />

        <div className="flex flex-col items-center gap-2 text-center pointer-events-none">
          <div className="size-11 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <UploadCloud className="size-6" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">
              Drop files here or <span className="text-primary underline underline-offset-2">browse</span>
            </p>
            <p className="text-xs text-muted-foreground">
              PNG, JPG, WEBP, or PDF — up to {maxSizeBytes / (1024 * 1024)} MB each (max {maxFiles} files)
            </p>
          </div>
        </div>
      </div>

      {/* Selected Files List */}
      {files.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Attached Files ({files.length}/{maxFiles})
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {files.map((file, idx) => {
              return (
                <div
                  key={`${file.name}-${idx}`}
                  className="flex items-center justify-between p-2.5 rounded-lg border border-border/70 bg-card/60 gap-3 group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {/* Thumbnail or File Icon */}
                    <div className="size-9 rounded-md bg-muted/60 border border-border/50 flex items-center justify-center overflow-hidden shrink-0">
                      <FileThumbnail file={file} />
                    </div>

                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground truncate" title={file.name}>
                        {file.name}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {formatFileSize(file.size)}
                      </p>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(idx);
                    }}
                    disabled={disabled}
                    className="size-7 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                    aria-label={`Remove ${file.name}`}
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
