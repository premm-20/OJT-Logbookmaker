"use client";

import { useState, useEffect, useRef } from "react";
import { PDFDocument } from "pdf-lib";
import {
  FileEdit,
  Upload,
  Download,
  Trash2,
  ImagePlus,
  ArrowLeft,
  ArrowRight,
  RefreshCw,
  FileText,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Undo2,
  X,
  Layers,
  Sparkles,
} from "lucide-react";

export default function EditPdfPage() {
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [originalBytes, setOriginalBytes] = useState<Uint8Array | null>(null);
  const [docName, setDocName] = useState<string>("OJT_Logbook.pdf");
  const [pageCount, setPageCount] = useState<number>(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedPageIndices, setSelectedPageIndices] = useState<number[]>([]);
  const [activePreviewPage, setActivePreviewPage] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusType, setStatusType] = useState<"success" | "error" | "info">("info");

  // Add image modal state
  const [showImageModal, setShowImageModal] = useState<boolean>(false);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [imageMode, setImageMode] = useState<"as_new_page" | "on_current_page">("as_new_page");
  const [imageStampPosition, setImageStampPosition] = useState<"center" | "top" | "bottom" | "bottom-right">("center");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Auto-load official logbook on first mount
  useEffect(() => {
    loadOfficialTemplate();
  }, []);

  // Update preview URL when pdfBytes change
  useEffect(() => {
    if (!pdfBytes) {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      return;
    }

    const blob = new Blob([pdfBytes as any], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    setPreviewUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [pdfBytes]);

  function showStatus(msg: string, type: "success" | "error" | "info" = "info") {
    setStatusMessage(msg);
    setStatusType(type);
    setTimeout(() => {
      setStatusMessage(null);
    }, 4000);
  }

  // Load official OJT Logbook template
  async function loadOfficialTemplate() {
    setLoading(true);
    try {
      const res = await fetch("/templates/OJT_Logbook.pdf");
      if (!res.ok) throw new Error("Could not load official template");
      const buffer = await res.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const doc = await PDFDocument.load(bytes);
      setPdfBytes(bytes);
      setOriginalBytes(bytes.slice());
      setDocName("OJT_Logbook.pdf");
      setPageCount(doc.getPageCount());
      setSelectedPageIndices([]);
      setActivePreviewPage(1);
      showStatus("Official OJT Logbook loaded successfully", "success");
    } catch (err: any) {
      showStatus(err.message || "Failed to load logbook", "error");
    } finally {
      setLoading(false);
    }
  }

  // Handle local PDF upload
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const doc = await PDFDocument.load(bytes);
      setPdfBytes(bytes);
      setOriginalBytes(bytes.slice());
      setDocName(file.name);
      setPageCount(doc.getPageCount());
      setSelectedPageIndices([]);
      setActivePreviewPage(1);
      showStatus(`Loaded "${file.name}" (${doc.getPageCount()} pages)`, "success");
    } catch (err: any) {
      showStatus(err.message || "Invalid PDF file", "error");
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // =========================================================
  // 1. DELETE PAGE
  // =========================================================
  async function handleDeletePage(pageIndex: number) {
    if (!pdfBytes || pageCount <= 1) {
      showStatus("Cannot delete the only page in the document", "error");
      return;
    }

    setLoading(true);
    try {
      const doc = await PDFDocument.load(pdfBytes);
      doc.removePage(pageIndex);
      const newBytes = await doc.save();
      setPdfBytes(newBytes);
      const newCount = doc.getPageCount();
      setPageCount(newCount);
      setSelectedPageIndices((prev) =>
        prev
          .filter((idx) => idx !== pageIndex)
          .map((idx) => (idx > pageIndex ? idx - 1 : idx))
      );
      if (activePreviewPage > newCount) {
        setActivePreviewPage(newCount);
      }
      showStatus(`Page ${pageIndex + 1} deleted`, "success");
    } catch (err: any) {
      showStatus(err.message || "Failed to remove page", "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteSelected() {
    if (!pdfBytes || selectedPageIndices.length === 0) return;
    if (selectedPageIndices.length >= pageCount) {
      showStatus("Cannot delete all pages. At least 1 page must remain.", "error");
      return;
    }

    setLoading(true);
    try {
      const doc = await PDFDocument.load(pdfBytes);
      const sorted = [...selectedPageIndices].sort((a, b) => b - a);
      for (const idx of sorted) {
        doc.removePage(idx);
      }
      const newBytes = await doc.save();
      setPdfBytes(newBytes);
      const newCount = doc.getPageCount();
      setPageCount(newCount);
      const deletedCount = selectedPageIndices.length;
      setSelectedPageIndices([]);
      setActivePreviewPage(1);
      showStatus(`Deleted ${deletedCount} selected pages`, "success");
    } catch (err: any) {
      showStatus(err.message || "Failed to delete pages", "error");
    } finally {
      setLoading(false);
    }
  }

  // =========================================================
  // 2. ORGANISE PAGES (Reordering)
  // =========================================================
  async function handleMovePage(fromIndex: number, direction: "left" | "right") {
    if (!pdfBytes) return;
    const toIndex = direction === "left" ? fromIndex - 1 : fromIndex + 1;
    if (toIndex < 0 || toIndex >= pageCount) return;

    setLoading(true);
    try {
      const doc = await PDFDocument.load(pdfBytes);
      const [page] = await doc.copyPages(doc, [fromIndex]);
      doc.removePage(fromIndex);
      doc.insertPage(toIndex, page);
      const newBytes = await doc.save();
      setPdfBytes(newBytes);
      setActivePreviewPage(toIndex + 1);
      showStatus(`Organised: Moved page ${fromIndex + 1} to position ${toIndex + 1}`, "success");
    } catch (err: any) {
      showStatus(err.message || "Failed to move page", "error");
    } finally {
      setLoading(false);
    }
  }

  // =========================================================
  // 3. ADD IMAGE IN IT
  // =========================================================
  function handleImageFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedImageFile(file);
    const url = URL.createObjectURL(file);
    setImagePreviewUrl(url);
  }

  async function handleApplyImage() {
    if (!pdfBytes || !selectedImageFile) return;

    setLoading(true);
    try {
      const doc = await PDFDocument.load(pdfBytes);
      const imageBuffer = await selectedImageFile.arrayBuffer();
      const imageBytes = new Uint8Array(imageBuffer);

      const isPng =
        selectedImageFile.type === "image/png" ||
        selectedImageFile.name.toLowerCase().endsWith(".png");

      const embeddedImage = isPng
        ? await doc.embedPng(imageBytes)
        : await doc.embedJpg(imageBytes);

      if (imageMode === "as_new_page") {
        // Insert as a clean A4 page right after active page
        const a4Width = 595.28;
        const a4Height = 841.89;
        const insertIndex = Math.min(activePreviewPage, doc.getPageCount());
        const newPage = doc.insertPage(insertIndex, [a4Width, a4Height]);

        const margin = 36;
        const dims = embeddedImage.scaleToFit(a4Width - margin * 2, a4Height - margin * 2);

        newPage.drawImage(embeddedImage, {
          x: (a4Width - dims.width) / 2,
          y: (a4Height - dims.height) / 2,
          width: dims.width,
          height: dims.height,
        });

        const newBytes = await doc.save();
        setPdfBytes(newBytes);
        setPageCount(doc.getPageCount());
        setActivePreviewPage(insertIndex + 1);
        showStatus(`Image added as a new Page ${insertIndex + 1}`, "success");
      } else {
        // Stamp onto active current page
        const targetPageIndex = Math.max(0, activePreviewPage - 1);
        const page = doc.getPage(targetPageIndex);
        const { width: pageWidth, height: pageHeight } = page.getSize();

        // Fit within 240x240 for stamp/signature
        const dims = embeddedImage.scaleToFit(240, 240);

        let x = (pageWidth - dims.width) / 2;
        let y = (pageHeight - dims.height) / 2;

        if (imageStampPosition === "top") {
          y = pageHeight - dims.height - 30;
        } else if (imageStampPosition === "bottom") {
          y = 30;
        } else if (imageStampPosition === "bottom-right") {
          x = pageWidth - dims.width - 30;
          y = 30;
        }

        page.drawImage(embeddedImage, {
          x,
          y,
          width: dims.width,
          height: dims.height,
        });

        const newBytes = await doc.save();
        setPdfBytes(newBytes);
        showStatus(`Image stamped onto Page ${activePreviewPage}`, "success");
      }

      // Close modal
      setShowImageModal(false);
      setSelectedImageFile(null);
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
      setImagePreviewUrl(null);
    } catch (err: any) {
      showStatus(err.message || "Failed to add image to PDF", "error");
    } finally {
      setLoading(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  }

  // Reset to original bytes
  function handleReset() {
    if (!originalBytes) return;
    setPdfBytes(originalBytes.slice());
    setSelectedPageIndices([]);
    setActivePreviewPage(1);
    showStatus("Reset document to original state", "info");
  }

  // Download modified PDF
  function handleDownload() {
    if (!pdfBytes) return;
    const blob = new Blob([pdfBytes as any], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = docName.replace(/\.pdf$/i, "") + "_edited.pdf";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showStatus("Download started", "success");
  }

  // Selection toggle
  function toggleSelectPage(idx: number) {
    setSelectedPageIndices((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in pb-16">
      {/* Hidden file inputs */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept="application/pdf"
        className="hidden"
      />
      <input
        type="file"
        ref={imageInputRef}
        onChange={handleImageFileSelected}
        accept="image/png,image/jpeg,image/jpg"
        className="hidden"
      />

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-600 to-primary-800 flex items-center justify-center text-white shadow-md">
            <FileEdit className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-surface-900">PDF Editor & Organiser</h1>
            <p className="text-sm text-surface-600 mt-0.5">
              Upload your PDF, delete pages, add images, and organise page order.
            </p>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-surface-200 bg-white text-surface-800 hover:bg-surface-50 text-xs font-bold shadow-xs cursor-pointer transition-all"
          >
            <Upload className="w-4 h-4 text-primary-600" />
            Upload PDF
          </button>

          <button
            type="button"
            onClick={() => setShowImageModal(true)}
            disabled={!pdfBytes || loading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 text-xs font-bold shadow-xs cursor-pointer transition-all disabled:opacity-50"
          >
            <ImagePlus className="w-4 h-4 text-emerald-600" />
            Add Image
          </button>

          <button
            type="button"
            onClick={loadOfficialTemplate}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-surface-200 bg-surface-50 text-surface-700 hover:bg-surface-100 text-xs font-bold shadow-xs cursor-pointer transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Load Official Template
          </button>

          <button
            type="button"
            onClick={handleDownload}
            disabled={!pdfBytes || loading}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary-600 to-primary-700 text-white hover:from-primary-700 hover:to-primary-800 text-xs font-bold shadow-md shadow-primary-600/20 cursor-pointer disabled:opacity-50 transition-all"
          >
            <Download className="w-4 h-4" />
            Download PDF ({pageCount} Pages)
          </button>
        </div>
      </div>

      {/* Status Alert Banner */}
      {statusMessage && (
        <div
          className={`p-3.5 rounded-xl text-xs font-bold flex items-center gap-2 animate-fade-in ${
            statusType === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : statusType === "error"
              ? "bg-rose-50 text-rose-800 border border-rose-200"
              : "bg-blue-50 text-blue-800 border border-blue-200"
          }`}
        >
          {statusType === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          ) : statusType === "error" ? (
            <AlertCircle className="w-4 h-4 text-rose-600" />
          ) : (
            <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
          )}
          {statusMessage}
        </div>
      )}

      {/* Document Overview Bar */}
      <div className="bg-white rounded-2xl border border-surface-200 p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 rounded-lg bg-surface-100 border border-surface-200 text-xs font-bold text-surface-800">
            Document: <span className="text-primary-700 font-mono">{docName}</span>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-primary-50 border border-primary-200 text-xs font-bold text-primary-800">
            Total Pages: <span className="text-primary-900 font-extrabold">{pageCount}</span>
          </div>
          {originalBytes && pdfBytes && originalBytes.length !== pdfBytes.length && (
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-surface-600 hover:text-surface-900 hover:bg-surface-100 cursor-pointer"
            >
              <Undo2 className="w-3.5 h-3.5" />
              Reset Changes
            </button>
          )}
        </div>

        {/* Action Highlights */}
        <div className="flex items-center gap-2">
          {selectedPageIndices.length > 0 && (
            <button
              type="button"
              onClick={handleDeleteSelected}
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer shadow-xs animate-fade-in"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete Selected ({selectedPageIndices.length})
            </button>
          )}

          <span className="text-xs text-surface-500 font-medium hidden sm:inline">
            Tip: Use arrow buttons on tiles to organise page order
          </span>
        </div>
      </div>

      {/* Main Workspace: Page Grid (Left) + Interactive Live Preview (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[750px]">
        {/* ========================================================= */}
        {/* LEFT COLUMN: PAGE ORGANISER & DELETE TILES (7 cols) */}
        {/* ========================================================= */}
        <div className="lg:col-span-6 xl:col-span-7 space-y-4">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold uppercase tracking-wider text-surface-600 flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary-600" />
              Organise & Manage Pages ({pageCount} Pages)
            </span>
            <span className="text-[11px] text-surface-400">
              ← / → Organise order • 🗑️ Delete page
            </span>
          </div>

          {/* Scrollable Page Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 max-h-[820px] overflow-y-auto p-2 rounded-2xl bg-surface-50 border border-surface-200">
            {Array.from({ length: pageCount }, (_, idx) => {
              const isSelected = selectedPageIndices.includes(idx);
              const isActivePreview = activePreviewPage === idx + 1;

              return (
                <div
                  key={idx}
                  className={`relative flex flex-col justify-between p-3 rounded-xl border transition-all ${
                    isActivePreview
                      ? "border-primary-500 ring-2 ring-primary-400/20 bg-white shadow-sm"
                      : isSelected
                      ? "border-rose-300 bg-rose-50/50"
                      : "border-surface-200 bg-white hover:border-surface-300"
                  }`}
                >
                  {/* Card Header: Checkbox & Page Badge */}
                  <div className="flex items-center justify-between gap-1 mb-2">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelectPage(idx)}
                      className="w-3.5 h-3.5 rounded border-surface-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                      title="Select for bulk delete"
                    />

                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                        isActivePreview
                          ? "bg-primary-600 text-white"
                          : "bg-surface-100 text-surface-700"
                      }`}
                    >
                      Page {idx + 1}
                    </span>
                  </div>

                  {/* Thumbnail Clickable Preview */}
                  <button
                    type="button"
                    onClick={() => setActivePreviewPage(idx + 1)}
                    className="w-full h-28 my-1 rounded-lg border border-dashed border-surface-200 bg-surface-50/80 hover:bg-primary-50/40 flex flex-col items-center justify-center gap-1 cursor-pointer transition-all group"
                  >
                    <FileText
                      className={`w-7 h-7 transition-all ${
                        isActivePreview
                          ? "text-primary-600 scale-110"
                          : "text-surface-400 group-hover:text-primary-500"
                      }`}
                    />
                    <span className="text-[10px] font-bold text-surface-500 group-hover:text-primary-700">
                      {isActivePreview ? "Viewing Page" : "Click to Preview"}
                    </span>
                  </button>

                  {/* Page Tile Toolbar: ONLY ORGANISE + DELETE */}
                  <div className="flex items-center justify-between gap-1 pt-2 border-t border-surface-100">
                    <div className="flex items-center gap-1">
                      {/* Organise: Move Earlier */}
                      <button
                        type="button"
                        onClick={() => handleMovePage(idx, "left")}
                        disabled={idx === 0 || loading}
                        title="Move Page Earlier (Organise)"
                        className="p-1.5 rounded-lg text-surface-600 hover:text-primary-700 hover:bg-primary-50 disabled:opacity-20 cursor-pointer transition-colors"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                      </button>

                      {/* Organise: Move Later */}
                      <button
                        type="button"
                        onClick={() => handleMovePage(idx, "right")}
                        disabled={idx === pageCount - 1 || loading}
                        title="Move Page Later (Organise)"
                        className="p-1.5 rounded-lg text-surface-600 hover:text-primary-700 hover:bg-primary-50 disabled:opacity-20 cursor-pointer transition-colors"
                      >
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Delete This Page */}
                    <button
                      type="button"
                      onClick={() => handleDeletePage(idx)}
                      disabled={loading || pageCount <= 1}
                      title="Delete This Page"
                      className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 disabled:opacity-20 cursor-pointer transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ========================================================= */}
        {/* RIGHT COLUMN: LIVE PDF VIEWPORT (5 cols) */}
        {/* ========================================================= */}
        <div className="lg:col-span-6 xl:col-span-5 flex flex-col space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold uppercase tracking-wider text-surface-500">
              Live PDF Viewport
            </span>
            <span className="text-xs font-bold text-primary-700">
              Page {activePreviewPage} of {pageCount}
            </span>
          </div>

          <div className="relative w-full h-[760px] rounded-2xl overflow-hidden border border-surface-200 bg-white shadow-sm flex items-center justify-center">
            {loading && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/80 backdrop-blur-xs">
                <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
                <p className="text-xs font-bold text-surface-700 mt-2">Processing PDF...</p>
              </div>
            )}

            {previewUrl ? (
              <iframe
                src={`${previewUrl}#page=${activePreviewPage}&toolbar=1&navpanes=1`}
                className="w-full h-full rounded-2xl border-0"
                title="Live Edited PDF Preview"
              />
            ) : (
              <div className="text-center p-6 text-surface-400">
                <FileText className="w-12 h-12 mx-auto mb-2 opacity-40" />
                <p className="text-xs font-bold">No PDF Loaded</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* ADD IMAGE MODAL (Clean, Focused Dialog) */}
      {/* ========================================================= */}
      {showImageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-surface-200 relative overflow-hidden">
            <div className="flex items-center justify-between pb-4 border-b border-surface-200">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <ImagePlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-surface-900">Add Image into PDF</h3>
                  <p className="text-xs text-surface-500">Insert photos, certificates, or diagrams</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowImageModal(false);
                  setSelectedImageFile(null);
                  if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
                  setImagePreviewUrl(null);
                }}
                className="p-1.5 rounded-xl hover:bg-surface-100 text-surface-400 hover:text-surface-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-5 space-y-4">
              {/* Image Picker */}
              <div
                onClick={() => imageInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-all ${
                  selectedImageFile
                    ? "border-emerald-400 bg-emerald-50/40"
                    : "border-surface-300 hover:border-emerald-400 hover:bg-emerald-50/20"
                }`}
              >
                {selectedImageFile && imagePreviewUrl ? (
                  <div className="flex items-center justify-center gap-4">
                    <img
                      src={imagePreviewUrl}
                      alt="Selected preview"
                      className="w-16 h-16 object-cover rounded-xl border border-emerald-200 shadow-xs"
                    />
                    <div className="text-left">
                      <p className="text-xs font-bold text-surface-900 truncate max-w-[200px]">
                        {selectedImageFile.name}
                      </p>
                      <p className="text-[11px] text-surface-500">
                        {(selectedImageFile.size / 1024).toFixed(1)} KB • Click to change
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <ImagePlus className="w-8 h-8 text-surface-400" />
                    <p className="text-xs font-bold text-surface-700">Click to upload an image</p>
                    <p className="text-[11px] text-surface-400">Supports PNG, JPG, JPEG</p>
                  </div>
                )}
              </div>

              {/* Mode Selection: As New Page OR On Current Page */}
              <div>
                <label className="block text-xs font-bold text-surface-700 uppercase tracking-wider mb-2">
                  Choose Image Placement
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setImageMode("as_new_page")}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                      imageMode === "as_new_page"
                        ? "border-emerald-500 bg-emerald-50/60 ring-2 ring-emerald-400/20"
                        : "border-surface-200 hover:bg-surface-50"
                    }`}
                  >
                    <div className="text-xs font-bold text-surface-900">Add as New Page</div>
                    <div className="text-[11px] text-surface-500 mt-0.5">
                      Inserts a clean A4 page after Page {activePreviewPage}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setImageMode("on_current_page")}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                      imageMode === "on_current_page"
                        ? "border-emerald-500 bg-emerald-50/60 ring-2 ring-emerald-400/20"
                        : "border-surface-200 hover:bg-surface-50"
                    }`}
                  >
                    <div className="text-xs font-bold text-surface-900">Stamp onto Page {activePreviewPage}</div>
                    <div className="text-[11px] text-surface-500 mt-0.5">
                      Overlays image directly on current page
                    </div>
                  </button>
                </div>
              </div>

              {/* Position selector if stamped on current page */}
              {imageMode === "on_current_page" && (
                <div className="p-3 bg-surface-50 rounded-xl border border-surface-200 space-y-2 animate-fade-in">
                  <label className="block text-[11px] font-bold text-surface-700">
                    Stamp Position on Page {activePreviewPage}:
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {(["center", "top", "bottom", "bottom-right"] as const).map((pos) => (
                      <button
                        key={pos}
                        type="button"
                        onClick={() => setImageStampPosition(pos)}
                        className={`py-1.5 px-2 rounded-lg text-xs font-semibold capitalize cursor-pointer transition-all ${
                          imageStampPosition === pos
                            ? "bg-emerald-600 text-white shadow-xs"
                            : "bg-white border border-surface-200 text-surface-700 hover:bg-surface-100"
                        }`}
                      >
                        {pos.replace("-", " ")}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-surface-200">
              <button
                type="button"
                onClick={() => {
                  setShowImageModal(false);
                  setSelectedImageFile(null);
                  if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
                  setImagePreviewUrl(null);
                }}
                className="px-4 py-2.5 rounded-xl border border-surface-200 text-xs font-bold text-surface-700 hover:bg-surface-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplyImage}
                disabled={!selectedImageFile || loading}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 cursor-pointer disabled:opacity-50 transition-all flex items-center gap-1.5"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Embed Image into PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
