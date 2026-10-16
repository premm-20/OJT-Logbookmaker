"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "next/navigation";
import { PDFDocument } from "pdf-lib";
import type { PDFDocumentProxy } from "pdfjs-dist";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  AlertCircle,
  ArrowLeftRight,
  BookCheck,
  CheckCircle2,
  CloudUpload,
  Download,
  FileClock,
  FileUp,
  GripVertical,
  ImagePlus,
  Loader2,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { loadPdfForRendering, normalizeImageForPdf, renderPageToDataUrl } from "@/lib/pdf-render";
import { buildSavedLogbookPdf, loadSavedLogbookData } from "@/lib/saved-logbook";
import { getEditedPdfInfo, loadEditedPdf, saveEditedPdf, type EditedPdfInfo } from "@/lib/edited-pdf-client";

type Source = "upload" | "saved" | "edited";
interface PageItem {
  /** Stable id for drag and drop. */
  id: string;
  /** Index of the page in the working document. */
  src: number;
  /** A full-page image the student added. */
  image?: boolean;
}

/** Pages of Section 2 (Supervisor's feedback), found by their heading. */
async function findSectionTwoPages(doc: PDFDocumentProxy): Promise<Set<number>> {
  const found = new Set<number>();
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    const text = content.items.map((item) => ("str" in item ? item.str : "")).join(" ");
    if (/SUPERVISOR.{0,3}S\s+FEEDBACK/i.test(text)) found.add(n - 1);
  }
  return found;
}

const THUMB_WIDTH = 150;
const PREVIEW_WIDTH = 620;
const A4: [number, number] = [595.28, 841.89];

export default function EditPdfPage() {
  return (
    <Suspense fallback={null}>
      <PdfEditor />
    </Suspense>
  );
}

function PdfEditor() {
  const searchParams = useSearchParams();

  // Working document: pdf-lib for edits, pdf.js for rendering.
  const libDocRef = useRef<PDFDocument | null>(null);
  // Thumbnails always render from the latest document, even if it changes mid-queue.
  const renderDocRef = useRef<PDFDocumentProxy | null>(null);
  const pumpQueueRef = useRef<() => Promise<void>>(async () => {});
  const originalRef = useRef<{ bytes: Uint8Array; name: string; source: Source } | null>(null);
  const [renderDoc, setRenderDoc] = useState<PDFDocumentProxy | null>(null);
  const [source, setSource] = useState<Source | null>(null);
  const [docName, setDocName] = useState("");
  const [pages, setPages] = useState<PageItem[]>([]);
  const [thumbs, setThumbs] = useState<Record<number, string>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; tone: "success" | "error" } | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewVersion, setPreviewVersion] = useState(0);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [showImageDialog, setShowImageDialog] = useState(false);
  // Source page indexes of Section 2; images are added after it.
  const sectionTwoRef = useRef<Set<number>>(new Set());
  const [hasSectionTwo, setHasSectionTwo] = useState(false);
  const [savedCount, setSavedCount] = useState<number | null>(null);
  // undefined while checking, null when the student has no saved edit.
  const [editedInfo, setEditedInfo] = useState<EditedPdfInfo | null | undefined>(undefined);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const idCounter = useRef(0);
  const autoLoadedRef = useRef(false);

  const activeIndex = Math.max(0, pages.findIndex((p) => p.id === activeId));
  const activePage = pages[activeIndex];

  const flash = useCallback((text: string, tone: "success" | "error" = "success") => {
    setNotice({ text, tone });
    window.setTimeout(() => setNotice((n) => (n?.text === text ? null : n)), 3500);
  }, []);

  const newId = () => `p${idCounter.current++}`;

  // ── Loading a document ────────────────────────────────────────
  const openBytes = useCallback(
    async (bytes: Uint8Array, name: string, from: Source) => {
      const libDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const rendered = await loadPdfForRendering(bytes);
      libDocRef.current = libDoc;
      renderDocRef.current = rendered;
      originalRef.current = { bytes, name, source: from };
      sectionTwoRef.current = new Set();
      setHasSectionTwo(false);
      void findSectionTwoPages(rendered)
        .then((found) => {
          if (libDocRef.current !== libDoc) return; // another PDF was opened meanwhile
          sectionTwoRef.current = found;
          setHasSectionTwo(found.size > 0);
        })
        .catch(() => {});
      setRenderDoc((prev) => {
        void prev?.loadingTask.destroy();
        return rendered;
      });
      const items = Array.from({ length: libDoc.getPageCount() }, (_, i) => ({ id: newId(), src: i }));
      setPages(items);
      setThumbs({});
      setActiveId(items[0]?.id ?? null);
      setSelected(new Set());
      setDirty(false);
      setSource(from);
      setDocName(name);
      setPreviewVersion((v) => v + 1);
    },
    []
  );

  const openSavedLogbook = useCallback(async () => {
    setBusy("Building your saved logbook. This can take a few seconds...");
    try {
      const { profile, entries } = await loadSavedLogbookData();
      if (entries.length === 0) {
        flash("You haven't saved any logbook entries yet. Use Fill logbook first.", "error");
        return;
      }
      const bytes = await buildSavedLogbookPdf(profile, entries);
      await openBytes(bytes, "OJT_Logbook.pdf", "saved");
      flash(`Saved logbook loaded with ${entries.length} ${entries.length === 1 ? "day" : "days"} filled in.`);
    } catch (err) {
      flash(err instanceof Error ? err.message : "Couldn't load your saved logbook.", "error");
    } finally {
      setBusy(null);
    }
  }, [flash, openBytes]);

  async function openEditedPdf() {
    if (!editedInfo) return;
    setBusy("Opening your saved PDF...");
    try {
      await openBytes(await loadEditedPdf(editedInfo), editedInfo.fileName, "edited");
    } catch (err) {
      flash(err instanceof Error ? err.message : "Couldn't open your saved PDF.", "error");
    } finally {
      setBusy(null);
    }
  }

  async function openUploadedFile(file: File) {
    if (!/pdf$/i.test(file.type) && !/\.pdf$/i.test(file.name)) {
      flash("Choose a PDF file.", "error");
      return;
    }
    setBusy(`Opening "${file.name}"...`);
    try {
      await openBytes(new Uint8Array(await file.arrayBuffer()), file.name, "upload");
    } catch {
      flash("That PDF couldn't be opened. It may be damaged or password protected.", "error");
    } finally {
      setBusy(null);
    }
  }

  // Count saved entries for the chooser, and open the saved logbook when
  // arriving from "Save" on Fill logbook (?source=saved).
  useEffect(() => {
    let cancelled = false;
    fetch("/api/entries")
      .then((res) => (res.ok ? res.json() : { entries: [] }))
      .then((data) => {
        if (!cancelled) setSavedCount((data.entries || []).length);
      })
      .catch(() => {
        if (!cancelled) setSavedCount(0);
      });
    getEditedPdfInfo()
      .then((info) => {
        if (!cancelled) setEditedInfo(info);
      })
      .catch(() => {
        if (!cancelled) setEditedInfo(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (autoLoadedRef.current || searchParams.get("source") !== "saved") return;
    autoLoadedRef.current = true;
    void openSavedLogbook();
  }, [searchParams, openSavedLogbook]);

  // ── Rendering: thumbnails (queued, only for visible tiles) and preview ──
  const queueRef = useRef<number[]>([]);
  const renderingRef = useRef(false);
  const thumbsRef = useRef(thumbs);
  useEffect(() => {
    thumbsRef.current = thumbs;
  }, [thumbs]);

  useEffect(() => {
    renderDocRef.current = renderDoc;
    if (renderDoc && queueRef.current.length) void pumpQueueRef.current();
  }, [renderDoc]);

  const pumpQueue = useCallback(async () => {
    if (renderingRef.current || !renderDocRef.current) return;
    renderingRef.current = true;
    try {
      while (queueRef.current.length && renderDocRef.current) {
        const src = queueRef.current.shift()!;
        if (thumbsRef.current[src]) continue;
        try {
          const url = await renderPageToDataUrl(renderDocRef.current, src + 1, THUMB_WIDTH);
          thumbsRef.current = { ...thumbsRef.current, [src]: url };
          setThumbs((prev) => ({ ...prev, [src]: url }));
        } catch (err) {
          // Leave the placeholder for pages pdf.js can't draw.
          console.warn("[edit-pdf] thumbnail failed for page", src + 1, err);
        }
      }
    } finally {
      renderingRef.current = false;
    }
  }, []);
  useEffect(() => {
    pumpQueueRef.current = pumpQueue;
  }, [pumpQueue]);

  const requestThumb = useCallback(
    (src: number) => {
      if (thumbsRef.current[src] || queueRef.current.includes(src)) return;
      queueRef.current.push(src);
      void pumpQueue();
    },
    [pumpQueue]
  );

  useEffect(() => {
    if (!renderDoc || !activePage) return;
    let cancelled = false;
    renderPageToDataUrl(renderDoc, activePage.src + 1, PREVIEW_WIDTH)
      .then((url) => {
        if (!cancelled) setPreviewUrl(url);
      })
      .catch(() => {
        if (!cancelled) setPreviewUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [renderDoc, activePage, previewVersion]);

  // ── Organise: drag and drop (instant; the PDF is assembled on download) ──
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragStart(event: DragStartEvent) {
    setDraggingId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setDraggingId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setPages((items) => {
      const from = items.findIndex((p) => p.id === active.id);
      const to = items.findIndex((p) => p.id === over.id);
      return arrayMove(items, from, to);
    });
    setDirty(true);
  }

  // ── Delete ────────────────────────────────────────────────────
  function deletePages(ids: string[]) {
    const remaining = pages.filter((p) => !ids.includes(p.id));
    if (remaining.length === 0) {
      flash("A PDF needs at least one page.", "error");
      return;
    }
    if (activeId && ids.includes(activeId)) {
      const nextActive = remaining[Math.min(activeIndex, remaining.length - 1)];
      setActiveId(nextActive.id);
    }
    setPages(remaining);
    setSelected((prev) => new Set([...prev].filter((id) => !ids.includes(id))));
    setDirty(true);
    flash(ids.length === 1 ? "Page deleted." : `${ids.length} pages deleted.`);
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // ── Add image ─────────────────────────────────────────────────
  /** Adds each image as a full A4 page after Section 2 (or at the end). */
  async function addImages(files: File[]) {
    const libDoc = libDocRef.current;
    if (!libDoc || files.length === 0) return;
    setBusy(files.length === 1 ? "Adding your image..." : `Adding ${files.length} images...`);
    try {
      const added: PageItem[] = [];
      for (const file of files) {
        const image = await normalizeImageForPdf(file);
        const embedded = image.kind === "png" ? await libDoc.embedPng(image.bytes) : await libDoc.embedJpg(image.bytes);
        // Appended to the working document, so existing page indexes stay valid.
        const page = libDoc.addPage(A4);
        const margin = 36;
        const dims = embedded.scaleToFit(A4[0] - margin * 2, A4[1] - margin * 2);
        page.drawImage(embedded, { x: (A4[0] - dims.width) / 2, y: (A4[1] - dims.height) / 2, ...dims });
        added.push({ id: newId(), src: libDoc.getPageCount() - 1, image: true });
      }

      // Re-render from the edited document before the new tiles appear, so
      // their thumbnails render from a document that contains them.
      const bytes = await libDoc.save();
      const rendered = await loadPdfForRendering(bytes);
      renderDocRef.current = rendered;
      setRenderDoc((prev) => {
        void prev?.loadingTask.destroy();
        return rendered;
      });

      const sectionTwo = sectionTwoRef.current;
      setPages((items) => {
        let at = items.length;
        const lastSectionTwo = items.findLastIndex((p) => sectionTwo.has(p.src));
        if (lastSectionTwo >= 0) {
          at = lastSectionTwo + 1;
          while (at < items.length && items[at].image) at++; // after images added earlier
        }
        return [...items.slice(0, at), ...added, ...items.slice(at)];
      });
      setActiveId(added[0].id);
      setPreviewVersion((v) => v + 1);
      setDirty(true);
      setShowImageDialog(false);
      const where = sectionTwo.size > 0 ? "after Section 2" : "at the end";
      flash(files.length === 1 ? `Image added ${where}.` : `${files.length} images added ${where}.`);
    } catch (err) {
      flash(err instanceof Error ? err.message : "Couldn't add those images.", "error");
    } finally {
      setBusy(null);
    }
  }

  // ── Reset / switch / download ─────────────────────────────────
  async function resetChanges() {
    const original = originalRef.current;
    if (!original) return;
    setBusy("Restoring the original...");
    try {
      await openBytes(original.bytes, original.name, original.source);
      flash("Changes undone.");
    } finally {
      setBusy(null);
    }
  }

  function switchDocument() {
    if (dirty && !window.confirm("Discard your changes to this PDF?")) return;
    libDocRef.current = null;
    originalRef.current = null;
    setRenderDoc((prev) => {
      void prev?.loadingTask.destroy();
      return null;
    });
    setPages([]);
    setSource(null);
    setPreviewUrl(null);
  }

  /** The PDF as it looks now, in the current page order. */
  async function assemble(): Promise<Uint8Array | null> {
    const libDoc = libDocRef.current;
    if (!libDoc) return null;
    const out = await PDFDocument.create();
    const copied = await out.copyPages(libDoc, pages.map((p) => p.src));
    copied.forEach((page) => out.addPage(page));
    return out.save();
  }

  function outputName() {
    const base = docName.replace(/\.pdf$/i, "").replace(/_edited$/i, "") || "document";
    return `${base}_edited.pdf`;
  }

  /** Stores the PDF in the student's account, replacing their last one. */
  async function storeInAccount(bytes: Uint8Array): Promise<boolean> {
    try {
      await saveEditedPdf(bytes, outputName(), pages.length);
      setEditedInfo(await getEditedPdfInfo().catch(() => null));
      return true;
    } catch (err) {
      flash(err instanceof Error ? err.message : "Couldn't save your PDF.", "error");
      return false;
    }
  }

  async function saveToAccount() {
    setBusy("Saving to your account...");
    try {
      const bytes = await assemble();
      if (bytes && (await storeInAccount(bytes))) flash("Saved. It replaces your previous saved PDF.");
    } catch {
      flash("Couldn't prepare the PDF. Please try again.", "error");
    } finally {
      setBusy(null);
    }
  }

  async function download() {
    setBusy("Preparing your PDF...");
    try {
      const bytes = await assemble();
      if (!bytes) return;
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = outputName();
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 2000);
      // Every downloaded version is also kept in the student's account.
      setBusy("Saving a copy to your account...");
      if (await storeInAccount(bytes)) flash("Downloaded and saved to your account.");
    } catch {
      flash("Couldn't prepare the PDF. Please try again.", "error");
    } finally {
      setBusy(null);
    }
  }

  const draggingPage = pages.find((p) => p.id === draggingId);

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-16 animate-fade-in">
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void openUploadedFile(file);
        }}
      />

      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[28px] font-semibold tracking-tight text-surface-950">Edit PDF</h1>
          <p className="mt-1 text-sm text-surface-600">
            {source
              ? `${docName} · ${pages.length} ${pages.length === 1 ? "page" : "pages"}${source === "saved" ? " · saved logbook" : source === "edited" ? " · your saved PDF" : ""}`
              : "Open your saved logbook or upload a PDF, then reorder pages, delete pages or add images."}
          </p>
        </div>
        {source && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={switchDocument}
              className="flex h-10 cursor-pointer items-center gap-2 rounded-xl px-3 text-sm font-semibold text-surface-700 hover:bg-surface-100"
            >
              <ArrowLeftRight className="h-4 w-4" aria-hidden />
              Switch PDF
            </button>
            <button
              type="button"
              onClick={() => setShowImageDialog(true)}
              disabled={!!busy}
              className="flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-surface-300 bg-white px-3.5 text-sm font-semibold text-surface-900 hover:bg-surface-50 disabled:opacity-50"
            >
              <ImagePlus className="h-4 w-4 text-primary-700" aria-hidden />
              Add images
            </button>
            <button
              type="button"
              onClick={saveToAccount}
              disabled={!!busy}
              className="flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-surface-300 bg-white px-3.5 text-sm font-semibold text-surface-900 hover:bg-surface-50 disabled:opacity-50"
            >
              <CloudUpload className="h-4 w-4 text-primary-700" aria-hidden />
              Save
            </button>
            <button
              type="button"
              onClick={download}
              disabled={!!busy}
              className="flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-primary-700 px-4 text-sm font-semibold text-white hover:bg-primary-800 disabled:opacity-50"
            >
              <Download className="h-4 w-4" aria-hidden />
              Download
            </button>
          </div>
        )}
      </div>

      {notice && (
        <div
          role={notice.tone === "error" ? "alert" : "status"}
          className={cn(
            "flex items-center gap-2 rounded-xl px-3.5 py-3 text-sm font-medium animate-fade-in",
            notice.tone === "error" ? "bg-danger/10 text-[oklch(0.45_0.16_25)]" : "bg-success/10 text-[oklch(0.42_0.11_155)]"
          )}
        >
          {notice.tone === "error" ? <AlertCircle className="h-4 w-4 shrink-0" /> : <CheckCircle2 className="h-4 w-4 shrink-0" />}
          {notice.text}
        </div>
      )}

      {!source ? (
        <SourceChooser
          savedCount={savedCount}
          editedInfo={editedInfo}
          busy={busy}
          onOpenEdited={openEditedPdf}
          onOpenSaved={openSavedLogbook}
          onChooseFile={() => fileInputRef.current?.click()}
          onDropFile={openUploadedFile}
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Page organiser */}
          <section className="lg:col-span-7" aria-label="Pages">
            <div className="mb-3 flex min-h-9 flex-wrap items-center justify-between gap-2 px-1">
              <p className="flex items-center gap-1.5 text-[13px] text-surface-600">
                <GripVertical className="h-4 w-4" aria-hidden />
                Drag pages to change their order. Click a page to preview it.
              </p>
              <div className="flex items-center gap-2">
                {dirty && (
                  <button
                    type="button"
                    onClick={resetChanges}
                    disabled={!!busy}
                    className="flex h-9 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-semibold text-surface-600 hover:bg-surface-100 hover:text-surface-900"
                  >
                    <Undo2 className="h-4 w-4" aria-hidden />
                    Undo all
                  </button>
                )}
                {selected.size > 0 && (
                  <button
                    type="button"
                    onClick={() => deletePages([...selected])}
                    className="flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-danger px-3 text-[13px] font-semibold text-white hover:opacity-90"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                    Delete {selected.size}
                  </button>
                )}
              </div>
            </div>

            <div className="max-h-[78dvh] overflow-y-auto rounded-2xl bg-surface-100 p-3">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragCancel={() => setDraggingId(null)}
              >
                <SortableContext items={pages.map((p) => p.id)} strategy={rectSortingStrategy}>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                    {pages.map((page, index) => (
                      <SortablePageTile
                        key={page.id}
                        page={page}
                        position={index + 1}
                        thumb={thumbs[page.src]}
                        active={page.id === activePage?.id}
                        selected={selected.has(page.id)}
                        onVisible={requestThumb}
                        onActivate={() => setActiveId(page.id)}
                        onToggleSelect={() => toggleSelected(page.id)}
                        onDelete={() => deletePages([page.id])}
                      />
                    ))}
                  </div>
                </SortableContext>
                {/* Rendered on <body>: the page's entrance animation leaves a
                    transform on its container, which would offset the dragged
                    copy from the pointer. */}
                {createPortal(
                <DragOverlay dropAnimation={{ duration: 220, easing: "cubic-bezier(0.25, 1, 0.5, 1)" }}>
                  {draggingPage ? (
                    <PageTileFace
                      position={pages.findIndex((p) => p.id === draggingPage.id) + 1}
                      thumb={thumbs[draggingPage.src]}
                      active={false}
                      selected={false}
                      lifted
                    />
                  ) : null}
                </DragOverlay>,
                document.body
                )}
              </DndContext>
            </div>
          </section>

          {/* Preview */}
          <section className="lg:col-span-5" aria-label="Page preview">
            <div className="lg:sticky lg:top-4">
              <p className="mb-3 flex min-h-9 items-center px-1 text-[13px] font-medium text-surface-600">
                Page {activeIndex + 1} of {pages.length}
              </p>
              <div className="flex min-h-[420px] items-center justify-center overflow-hidden rounded-2xl bg-white p-3 ring-1 ring-surface-200">
                {previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- rendered canvas data URL
                  <img src={previewUrl} alt={`Preview of page ${activeIndex + 1}`} className="h-auto max-h-[72dvh] w-auto max-w-full rounded-md shadow-sm" />
                ) : (
                  <div className="skeleton aspect-[1/1.414] w-full max-w-[420px]" aria-hidden />
                )}
              </div>
            </div>
          </section>
        </div>
      )}

      {busy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-950/30 backdrop-blur-[2px] p-4">
          <div className="flex max-w-sm items-center gap-3 rounded-2xl bg-white px-5 py-4 shadow-xl" role="status">
            <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary-700" aria-hidden />
            <p className="text-sm font-medium text-surface-800">{busy}</p>
          </div>
        </div>
      )}

      {showImageDialog && (
        <AddImageDialog
          placement={hasSectionTwo ? "after Section 2 (Supervisor's feedback)" : "at the end of the PDF"}
          onCancel={() => setShowImageDialog(false)}
          onApply={addImages}
        />
      )}
    </div>
  );
}

// ─── Source chooser ─────────────────────────────────────────────

function SourceChooser({
  savedCount,
  editedInfo,
  busy,
  onOpenEdited,
  onOpenSaved,
  onChooseFile,
  onDropFile,
}: {
  savedCount: number | null;
  editedInfo: EditedPdfInfo | null | undefined;
  busy: string | null;
  onOpenEdited: () => void;
  onOpenSaved: () => void;
  onChooseFile: () => void;
  onDropFile: (file: File) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const hasSaved = (savedCount ?? 0) > 0;

  return (
    <div className="space-y-4">
      {editedInfo && (
        <div className="flex flex-wrap items-center gap-4 rounded-3xl bg-white p-5 ring-1 ring-surface-200">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
            <FileClock className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-semibold text-surface-950">Continue your saved PDF</h2>
            <p className="mt-0.5 truncate text-sm text-surface-600">
              {editedInfo.fileName} · {editedInfo.pageCount} {editedInfo.pageCount === 1 ? "page" : "pages"} · saved{" "}
              {new Date(editedInfo.updatedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenEdited}
            disabled={!!busy}
            className="flex h-11 cursor-pointer items-center rounded-xl bg-primary-700 px-5 text-sm font-semibold text-white hover:bg-primary-800 disabled:opacity-60"
          >
            Open
          </button>
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2">
      <div className="flex flex-col rounded-3xl bg-primary-950 p-7 text-white">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 ring-1 ring-inset ring-white/15">
          <BookCheck className="h-5 w-5" aria-hidden />
        </span>
        <h2 className="mt-5 text-xl font-semibold tracking-tight">Saved logbook</h2>
        <p className="mt-2 max-w-[40ch] text-sm leading-relaxed text-primary-100/80">
          The official logbook with every entry you&apos;ve saved already printed in.
        </p>
        <p className="mt-4 text-sm font-medium text-primary-100">
          {savedCount === null
            ? "Checking your saved entries..."
            : hasSaved
              ? `${savedCount} ${savedCount === 1 ? "day" : "days"} saved`
              : "No entries saved yet"}
        </p>
        <div className="mt-auto pt-6">
          {hasSaved || savedCount === null ? (
            <button
              type="button"
              onClick={onOpenSaved}
              disabled={!!busy || !hasSaved}
              className="flex h-11 cursor-pointer items-center rounded-xl bg-white px-5 text-sm font-semibold text-primary-900 hover:bg-primary-50 disabled:opacity-60"
            >
              Open saved logbook
            </button>
          ) : (
            <Link
              href="/dashboard/new-entry"
              className="inline-flex h-11 items-center rounded-xl bg-white px-5 text-sm font-semibold text-primary-900 hover:bg-primary-50"
            >
              Fill logbook first
            </Link>
          )}
        </div>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) onDropFile(file);
        }}
        className={cn(
          "flex flex-col rounded-3xl border-2 border-dashed bg-white p-7",
          dragOver ? "border-primary-500 bg-primary-50" : "border-surface-300"
        )}
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
          <FileUp className="h-5 w-5" aria-hidden />
        </span>
        <h2 className="mt-5 text-xl font-semibold tracking-tight text-surface-950">Upload a PDF</h2>
        <p className="mt-2 max-w-[40ch] text-sm leading-relaxed text-surface-600">
          Edit any PDF from your device. Drop it here or choose a file.
        </p>
        <div className="mt-auto pt-6">
          <button
            type="button"
            onClick={onChooseFile}
            disabled={!!busy}
            className="flex h-11 cursor-pointer items-center rounded-xl bg-primary-700 px-5 text-sm font-semibold text-white hover:bg-primary-800 disabled:opacity-60"
          >
            Choose PDF
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}

// ─── Page tiles ─────────────────────────────────────────────────

function PageTileFace({
  position,
  thumb,
  active,
  selected,
  lifted = false,
}: {
  position: number;
  thumb?: string;
  active: boolean;
  selected: boolean;
  lifted?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl bg-white p-2 ring-1 transition-shadow",
        active ? "ring-2 ring-primary-500" : selected ? "ring-2 ring-danger/60" : "ring-surface-200",
        lifted && "rotate-[1.5deg] shadow-[0_24px_48px_-12px_oklch(0.3_0.058_236/0.45)] ring-primary-400"
      )}
    >
      <div className="relative aspect-[1/1.414] w-full overflow-hidden rounded-md bg-surface-100">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element -- rendered canvas data URL
          <img src={thumb} alt="" draggable={false} className="h-full w-full object-cover" />
        ) : (
          <div className="skeleton h-full w-full rounded-none" aria-hidden />
        )}
      </div>
      <p className="mt-1.5 text-center font-mono text-xs tabular-nums text-surface-700">{position}</p>
    </div>
  );
}

function SortablePageTile({
  page,
  position,
  thumb,
  active,
  selected,
  onVisible,
  onActivate,
  onToggleSelect,
  onDelete,
}: {
  page: PageItem;
  position: number;
  thumb?: string;
  active: boolean;
  selected: boolean;
  onVisible: (src: number) => void;
  onActivate: () => void;
  onToggleSelect: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: page.id,
    // Neighbouring pages glide aside rather than jump.
    transition: { duration: 260, easing: "cubic-bezier(0.25, 1, 0.5, 1)" },
  });
  const elementRef = useRef<HTMLDivElement | null>(null);

  // Render the thumbnail only once the tile scrolls into view.
  useEffect(() => {
    const el = elementRef.current;
    if (!el || thumb) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          onVisible(page.src);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [page.src, thumb, onVisible]);

  return (
    <div
      ref={(node) => {
        setNodeRef(node);
        elementRef.current = node;
      }}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("group relative touch-manipulation", isDragging && "opacity-30")}
      {...attributes}
      {...listeners}
      onClick={onActivate}
      aria-label={`Page ${position}. Drag to reorder.`}
    >
      <div className="cursor-grab active:cursor-grabbing">
        <PageTileFace position={position} thumb={thumb} active={active} selected={selected} />
      </div>

      <label
        className="absolute left-3 top-3 flex h-6 w-6 cursor-pointer items-center justify-center rounded-md bg-white/90 shadow-sm ring-1 ring-surface-200"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        title="Select"
      >
        <input type="checkbox" checked={selected} onChange={onToggleSelect} className="h-3.5 w-3.5 cursor-pointer accent-[var(--color-danger)]" aria-label={`Select page ${position}`} />
      </label>
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="absolute right-3 top-3 flex h-7 w-7 cursor-pointer items-center justify-center rounded-md bg-white/90 text-surface-600 opacity-100 shadow-sm ring-1 ring-surface-200 hover:text-danger sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
        aria-label={`Delete page ${position}`}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ─── Add image dialog ───────────────────────────────────────────

function AddImageDialog({
  placement,
  onCancel,
  onApply,
}: {
  placement: string;
  onCancel: () => void;
  onApply: (files: File[]) => void;
}) {
  const [picked, setPicked] = useState<{ file: File; url: string }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const pickedRef = useRef(picked);
  useEffect(() => {
    pickedRef.current = picked;
  }, [picked]);
  // Free the preview URLs when the dialog closes.
  useEffect(() => () => pickedRef.current.forEach((p) => URL.revokeObjectURL(p.url)), []);

  function addFiles(files: FileList | null) {
    const images = Array.from(files || []).filter((f) => f.type.startsWith("image/"));
    setPicked((prev) => [...prev, ...images.map((file) => ({ file, url: URL.createObjectURL(file) }))]);
  }

  function remove(index: number) {
    setPicked((prev) => {
      URL.revokeObjectURL(prev[index].url);
      return prev.filter((_, i) => i !== index);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-950/40 p-4 backdrop-blur-[2px] animate-fade-in" onClick={onCancel}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-image-title"
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="add-image-title" className="text-lg font-semibold tracking-tight text-surface-950">
              Add images
            </h2>
            <p className="mt-1 text-sm text-surface-600">Each image becomes a full page, added {placement}.</p>
          </div>
          <button type="button" onClick={onCancel} className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-surface-500 hover:bg-surface-100" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = ""; // allow picking the same files again
          }}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            addFiles(e.dataTransfer.files);
          }}
          className="mt-5 flex w-full cursor-pointer items-center gap-4 rounded-xl border-2 border-dashed border-surface-300 p-4 text-left hover:border-primary-400"
        >
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-surface-100 text-surface-500">
            <ImagePlus className="h-6 w-6" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-surface-900">{picked.length ? "Add more images" : "Choose images"}</span>
            <span className="block text-[13px] text-surface-600">PNG, JPG, WebP or GIF. Pick several at once or drop them here.</span>
          </span>
        </button>

        {picked.length > 0 && (
          <ul className="mt-4 grid max-h-64 grid-cols-4 gap-2 overflow-y-auto" aria-label="Chosen images">
            {picked.map((p, i) => (
              <li key={p.url} className="group relative aspect-[1/1.414] overflow-hidden rounded-lg bg-surface-100 ring-1 ring-surface-200">
                {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
                <img src={p.url} alt={p.file.name} className="h-full w-full object-contain" />
                <span className="absolute left-1 top-1 rounded bg-surface-950/70 px-1.5 text-[11px] font-semibold text-white">{i + 1}</span>
                <button
                  type="button"
                  onClick={() => remove(i)}
                  aria-label={`Remove ${p.file.name}`}
                  className="absolute right-1 top-1 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full bg-white/90 text-surface-700 shadow-sm hover:bg-white"
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="h-10 cursor-pointer rounded-xl px-4 text-sm font-semibold text-surface-700 hover:bg-surface-100">
            Cancel
          </button>
          <button
            type="button"
            disabled={picked.length === 0}
            onClick={() => onApply(picked.map((p) => p.file))}
            className="h-10 cursor-pointer rounded-xl bg-primary-700 px-5 text-sm font-semibold text-white hover:bg-primary-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {picked.length > 1 ? `Add ${picked.length} images` : "Add image"}
          </button>
        </div>
      </div>
    </div>
  );
}
