"use client";

import { useState, useRef, useEffect, DragEvent, ChangeEvent } from "react";
import { UploadCloud, FileText, Image as ImageIcon, X, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/ui";
import { Button } from "@/components/ui/button";

export const ALLOWED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
] as const;

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

export function FileUploader({
  files,
  onFilesChange,
  maxFiles = MAX_FILES_COUNT,
  maxSizeBytes = MAX_FILE_SIZE_BYTES,
  disabled = false,
}: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Generate and manage thumbnail object URLs for image files
  useEffect(() => {
    const urls: Record<string, string> = {};
    files.forEach((file) => {
      if (file.type.startsWith("image/")) {
        urls[file.name + file.size] = URL.createObjectURL(file);
      }
    });
    setThumbnails(urls);

    return () => {
      Object.values(urls).forEach((url) => URL.revokeObjectURL(url));
    };
  }, [files]);

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

      if (!ALLOWED_MIME_TYPES.includes(file.type as any)) {
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

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (disabled) return;
    setIsDragging(true);
  }

  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
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
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
        className={cn(
          "relative flex flex-col items-center justify-center p-6 rounded-xl border-2 border-dashed transition-all cursor-pointer select-none",
          isDragging
            ? "border-primary bg-primary/10 scale-[1.005]"
            : "border-border/80 hover:border-primary/60 bg-muted/20 hover:bg-muted/30",
          disabled && "opacity-50 cursor-not-allowed pointer-events-none"
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ALLOWED_MIME_TYPES.join(",")}
          onChange={handleInputChange}
          className="hidden"
          disabled={disabled}
        />

        <div className="flex flex-col items-center gap-2 text-center">
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
              const key = file.name + file.size;
              const thumbUrl = thumbnails[key];
              const isPdf = file.type === "application/pdf";

              return (
                <div
                  key={`${file.name}-${idx}`}
                  className="flex items-center justify-between p-2.5 rounded-lg border border-border/70 bg-card/60 gap-3 group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {/* Thumbnail or File Icon */}
                    <div className="size-9 rounded-md bg-muted/60 border border-border/50 flex items-center justify-center overflow-hidden shrink-0">
                      {thumbUrl ? (
                        <img
                          src={thumbUrl}
                          alt={file.name}
                          className="size-full object-cover"
                        />
                      ) : isPdf ? (
                        <FileText className="size-4 text-rose-400" />
                      ) : (
                        <ImageIcon className="size-4 text-primary" />
                      )}
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
