"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Download, FileText, X } from "lucide-react";

import { getBackendUrl } from "@/app/api/urls";
import { LoadingState } from "@/app/components/Spinner";
import {
  type Artifact,
  useWorkspaceDataStore,
} from "@/app/dashboard/workspace-data-store";

type ArtifactViewerContextValue = {
  openArtifact: (artifactId: string, title?: string) => void;
};

type ArtifactSelection = {
  artifactId: string;
  title?: string;
  artifact?: Artifact;
};

type ArtifactPreview = {
  objectUrl: string;
  mediaType: string;
  mode: "image" | "pdf" | "text" | "unsupported";
  text?: string;
};

const ArtifactViewerContext = createContext<ArtifactViewerContextValue | null>(
  null,
);

function isTextPreview(mediaType: string, title: string) {
  return (
    mediaType.startsWith("text/") ||
    /application\/(json|xml)/i.test(mediaType) ||
    /\.(csv|json|md|txt|xml)$/i.test(title)
  );
}

function kindLabel(artifact: Artifact | null) {
  if (!artifact) return "Workspace artifact";
  return artifact.kind.replaceAll("_", " ");
}

export function useArtifactViewer() {
  const value = useContext(ArtifactViewerContext);
  if (!value) {
    throw new Error(
      "useArtifactViewer must be used inside ArtifactViewerProvider.",
    );
  }
  return value;
}

export function ArtifactViewerProvider({ children }: { children: ReactNode }) {
  const artifacts = useWorkspaceDataStore((state) => state.artifacts);
  const [selection, setSelection] = useState<ArtifactSelection | null>(null);
  const [artifact, setArtifact] = useState<Artifact | null>(null);
  const [preview, setPreview] = useState<ArtifactPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const closeArtifact = useCallback(() => {
    setSelection(null);
    setArtifact(null);
    setPreview(null);
    setError(null);
    setIsLoading(false);
    requestAnimationFrame(() => returnFocusRef.current?.focus());
  }, []);

  const openArtifact = useCallback(
    (artifactId: string, title?: string) => {
      returnFocusRef.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      const cachedArtifact = artifacts.find(
        (item) => item.artifact_id === artifactId,
      );
      setArtifact(cachedArtifact ?? null);
      setPreview(null);
      setError(null);
      setIsLoading(true);
      setSelection({ artifactId, title, artifact: cachedArtifact });
    },
    [artifacts],
  );

  useEffect(() => {
    if (!selection) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeArtifact();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeArtifact, selection]);

  useEffect(() => {
    if (!selection) return;

    let cancelled = false;
    let objectUrl: string | null = null;
    const cachedArtifact = selection.artifact;
    async function loadArtifact() {
      const metadataPromise = cachedArtifact
        ? Promise.resolve(cachedArtifact)
        : fetch(`${getBackendUrl()}/artifacts/${selection?.artifactId}`, {
            credentials: "include",
          }).then(async (response) => {
            if (!response.ok) {
              throw new Error("This artifact is no longer available.");
            }
            return (await response.json()) as Artifact;
          });
      const contentPromise = fetch(
        `${getBackendUrl()}/artifacts/${selection?.artifactId}/content`,
        { credentials: "include" },
      ).then(async (response) => {
        if (!response.ok) {
          throw new Error(
            response.status === 404
              ? "The retained source has expired or is unavailable."
              : "The artifact source could not be opened.",
          );
        }
        return {
          blob: await response.blob(),
          mediaType: response.headers.get("content-type") ?? "",
        };
      });

      const [metadata, content] = await Promise.all([
        metadataPromise,
        contentPromise,
      ]);
      const mediaType =
        content.mediaType.split(";")[0] ||
        metadata.media_type ||
        "application/octet-stream";
      objectUrl = URL.createObjectURL(content.blob);
      const mode: ArtifactPreview["mode"] = mediaType.startsWith("image/")
        ? "image"
        : mediaType === "application/pdf" || /\.pdf$/i.test(metadata.title)
          ? "pdf"
          : isTextPreview(mediaType, metadata.title)
            ? "text"
            : "unsupported";
      const text = mode === "text" ? await content.blob.text() : undefined;

      if (cancelled) return;
      setArtifact(metadata);
      setPreview({ objectUrl, mediaType, mode, text });
    }

    void loadArtifact()
      .catch((requestError: unknown) => {
        if (!cancelled) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "The artifact could not be opened.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [selection]);

  const viewer = selection ? (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-3 backdrop-blur-[2px] sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeArtifact();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="artifact-viewer-title"
        className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-border px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">
              {kindLabel(artifact)}
            </p>
            <h2
              id="artifact-viewer-title"
              className="mt-1 truncate text-base font-semibold text-primary"
            >
              {artifact?.title ?? selection.title ?? "Artifact preview"}
            </h2>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={closeArtifact}
            aria-label="Close artifact preview"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground transition hover:bg-muted hover:text-primary"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-auto bg-background p-4 sm:p-5">
          {isLoading ? (
            <div className="flex min-h-72 items-center justify-center">
              <LoadingState label="Opening artifact" />
            </div>
          ) : error ? (
            <div className="flex min-h-72 items-center justify-center">
              <p
                role="alert"
                className="max-w-md text-center text-sm text-red-700"
              >
                {error}
              </p>
            </div>
          ) : preview?.mode === "text" ? (
            <pre className="min-h-72 whitespace-pre-wrap break-words rounded-lg border border-border bg-card p-4 font-mono text-xs leading-6 text-primary">
              {preview.text}
            </pre>
          ) : preview?.mode === "pdf" ? (
            <iframe
              title={`${artifact?.title ?? selection.title ?? "Artifact"} preview`}
              src={preview.objectUrl}
              className="h-[70vh] min-h-96 w-full rounded-lg border border-border bg-white"
            />
          ) : preview?.mode === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview.objectUrl}
              alt={artifact?.title ?? selection.title ?? "Artifact preview"}
              className="mx-auto max-h-[70vh] max-w-full rounded-lg border border-border object-contain"
            />
          ) : (
            <div className="flex min-h-72 flex-col items-center justify-center text-center">
              <FileText aria-hidden="true" className="h-8 w-8 text-accent" />
              <p className="mt-3 text-sm font-semibold text-primary">
                Browser preview is not available for this file type.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Download the retained source to open it in a compatible app.
              </p>
            </div>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-border px-4 py-3 sm:px-5">
          {preview ? (
            <a
              href={preview.objectUrl}
              download={artifact?.title ?? selection.title ?? "artifact"}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-primary transition hover:bg-muted"
            >
              <Download aria-hidden="true" className="h-4 w-4" />
              Download source
            </a>
          ) : null}
          <button
            type="button"
            onClick={closeArtifact}
            className="rounded-lg bg-secondary px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-secondary/85"
          >
            Close
          </button>
        </footer>
      </section>
    </div>
  ) : null;

  return (
    <ArtifactViewerContext.Provider value={{ openArtifact }}>
      {children}
      {typeof document !== "undefined" && viewer
        ? createPortal(viewer, document.body)
        : null}
    </ArtifactViewerContext.Provider>
  );
}
