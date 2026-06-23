import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";

import { Button } from "@/components/ui/button";
import {
  Upload,
  Download,
  File,
  Image,
  FileText,
  X,
  FolderOpen,
} from "lucide-react";
import { cn } from "../lib/utils";

interface AttachmentItem {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  createdAt: string;
  issueId?: string | null;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function FileTypeIcon({ mimeType, className }: { mimeType: string; className?: string }) {
  if (mimeType.startsWith("image/")) return <Image className={cn("text-yellow-500", className)} />;
  if (mimeType === "application/pdf") return <FileText className={cn("text-red-400", className)} />;
  return <File className={cn("text-muted-foreground", className)} />;
}

export function FileBrowser() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<AttachmentItem | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    setBreadcrumbs([{ label: "Dateien" }]);
  }, [setBreadcrumbs]);

  // Fetch company-level attachments (not issue-specific)
  const { data: attachments = [], isLoading } = useQuery<AttachmentItem[]>({
    queryKey: ["company-attachments", selectedCompanyId],
    queryFn: async () => {
      const res = await fetch(`/api/companies/${selectedCompanyId}/attachments`, {
        credentials: "include",
      });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : (data.attachments ?? data.items ?? []);
    },
    enabled: !!selectedCompanyId,
  });

  const handleUpload = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0 || !selectedCompanyId) return;
      setUploading(true);
      setUploadError(null);
      try {
        for (const file of Array.from(files)) {
          const formData = new FormData();
          formData.append("file", file);
          const res = await fetch(`/api/companies/${selectedCompanyId}/attachments`, {
            method: "POST",
            credentials: "include",
            body: formData,
          });
          if (!res.ok) {
            const msg = await res.text().catch(() => "Upload fehlgeschlagen");
            setUploadError(msg);
          }
        }
        queryClient.invalidateQueries({ queryKey: ["company-attachments", selectedCompanyId] });
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [selectedCompanyId, queryClient],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      handleUpload(e.dataTransfer.files);
    },
    [handleUpload],
  );

  const handleDownload = useCallback(async (attachment: AttachmentItem) => {
    const res = await fetch(`/api/attachments/${attachment.id}/content`, {
      credentials: "include",
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = attachment.name;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handlePreview = useCallback(async (attachment: AttachmentItem) => {
    setPreviewFile(attachment);
    if (
      attachment.mimeType.startsWith("image/") ||
      attachment.mimeType === "application/pdf"
    ) {
      const res = await fetch(`/api/attachments/${attachment.id}/content`, {
        credentials: "include",
      });
      if (res.ok) {
        const blob = await res.blob();
        setPreviewUrl(URL.createObjectURL(blob));
      }
    } else {
      setPreviewUrl(null);
    }
  }, []);

  const closePreview = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewFile(null);
    setPreviewUrl(null);
  }, [previewUrl]);

  if (!selectedCompanyId) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">Kein Unternehmen ausgewählt.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-border px-6 py-3 shrink-0">
        <h1 className="text-base font-semibold" style={{ color: "#C9A962" }}>Dateien</h1>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-6">
        {/* Upload area */}
        <div
          className={cn(
            "rounded-lg border-2 border-dashed p-8 text-center transition-colors cursor-pointer",
            dragging
              ? "border-primary bg-primary/10"
              : "border-border hover:border-primary/50 hover:bg-accent/20",
          )}
          style={dragging ? { borderColor: "#C9A962", background: "#C9A96210" } : undefined}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          aria-label="Dateien hochladen"
          onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
        >
          <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm font-medium text-foreground">
            {uploading ? "Wird hochgeladen…" : "Dateien hierher ziehen oder klicken zum Auswählen"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Bilder, PDFs, Dokumente — alle Dateitypen
          </p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="sr-only"
            onChange={(e) => handleUpload(e.target.files)}
            aria-hidden
          />
        </div>

        {uploadError && (
          <p className="text-sm text-destructive">{uploadError}</p>
        )}

        {/* File list */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm text-muted-foreground">Dateien werden geladen…</p>
          </div>
        ) : attachments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FolderOpen className="h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">Noch keine Dateien hochgeladen.</p>
          </div>
        ) : (
          /* Mobile: cards / Desktop: table */
          <>
            {/* Desktop table */}
            <div className="hidden md:block rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/20">
                    <th className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium">Name</th>
                    <th className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium">Größe</th>
                    <th className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium">Datum</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {attachments.map((file) => (
                    <tr key={file.id} className="border-b border-border last:border-0 hover:bg-accent/20 transition-colors">
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          className="flex items-center gap-2 text-left hover:underline"
                          onClick={() => handlePreview(file)}
                        >
                          <FileTypeIcon mimeType={file.mimeType} className="h-4 w-4 shrink-0" />
                          <span className="truncate max-w-xs">{file.name}</span>
                        </button>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{formatBytes(file.size)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(file.createdAt)}</td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          className="text-muted-foreground"
                          onClick={() => handleDownload(file)}
                          aria-label={`${file.name} herunterladen`}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              {attachments.map((file) => (
                <div
                  key={file.id}
                  className="rounded-lg border border-border bg-card p-3 flex items-center gap-3"
                >
                  <FileTypeIcon mimeType={file.mimeType} className="h-6 w-6 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <button
                      type="button"
                      className="text-sm font-medium truncate block text-left hover:underline"
                      onClick={() => handlePreview(file)}
                    >
                      {file.name}
                    </button>
                    <p className="text-xs text-muted-foreground">
                      {formatBytes(file.size)} · {formatDate(file.createdAt)}
                    </p>
                  </div>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    className="text-muted-foreground shrink-0"
                    onClick={() => handleDownload(file)}
                    aria-label={`${file.name} herunterladen`}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Preview modal */}
      {previewFile && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
          onClick={closePreview}
        >
          <div
            className="relative max-w-4xl w-full mx-4 rounded-lg border border-border bg-card shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="text-sm font-medium truncate">{previewFile.name}</span>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDownload(previewFile)}
                >
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                  Download
                </Button>
                <Button size="icon-sm" variant="ghost" onClick={closePreview} aria-label="Schließen">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="p-4 max-h-[70vh] overflow-auto">
              {previewUrl && previewFile.mimeType.startsWith("image/") && (
                <img
                  src={previewUrl}
                  alt={previewFile.name}
                  className="max-w-full mx-auto rounded"
                />
              )}
              {previewUrl && previewFile.mimeType === "application/pdf" && (
                <iframe
                  src={previewUrl}
                  title={previewFile.name}
                  className="w-full h-[60vh] rounded"
                />
              )}
              {!previewUrl && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <FileTypeIcon mimeType={previewFile.mimeType} className="h-12 w-12 mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Keine Vorschau verfügbar. Datei herunterladen um sie zu öffnen.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
