"use client";

import { useEffect, useState, useRef } from "react";
import {
  generateCompleteLogbookPreviewBlob,
  generateCompleteLogbookPDF,
  SingleDayData,
} from "@/lib/pdf-generator";
import TimePicker from "@/components/time-picker";
import { calculateHours, ensureSpecialAchievements, formatDateDDMMYYYY } from "@/lib/utils";
import type { DailyEntry, Profile, ProfileFormData } from "@/lib/types";
import {
  Loader2,
  ExternalLink,
  Download,
  BookOpen,
  Save,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  FileText,
  PenTool,
  RefreshCw,
  Sparkles,
  UserCheck,
  ZoomIn,
  ZoomOut,
  Maximize2,
} from "lucide-react";

interface AutoFitTextareaProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  defaultFontSize?: number;
  minFontSize?: number;
  style: React.CSSProperties;
  className?: string;
}

function AutoFitTextarea({
  value,
  onChange,
  placeholder,
  defaultFontSize = 11.5,
  minFontSize = 7.5,
  style,
  className = "",
}: AutoFitTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [fontSize, setFontSize] = useState<number>(defaultFontSize);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;

    // Start with default font size
    let cur = defaultFontSize;
    el.style.fontSize = `${cur}px`;
    el.style.lineHeight = `${Math.round(cur * 1.34)}px`;

    // Gradually reduce font size if user enters more text than the container's height
    while (el.scrollHeight > el.clientHeight && cur > minFontSize) {
      cur = Math.max(minFontSize, +(cur - 0.4).toFixed(1));
      el.style.fontSize = `${cur}px`;
      el.style.lineHeight = `${Math.round(cur * 1.34)}px`;
    }

    setFontSize(cur);
  }, [value, defaultFontSize, minFontSize]);

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        ...style,
        fontSize: `${fontSize}px`,
        lineHeight: `${Math.round(fontSize * 1.34)}px`,
        resize: "none",
        overflow: "hidden",
      }}
      className={`bg-transparent hover:bg-sky-500/10 focus:bg-sky-500/15 focus:outline-none text-slate-900 font-sans rounded-xs border border-transparent focus:border-sky-500 select-text ${className}`}
    />
  );
}

interface LogbookPreviewProps {
  dayNumber?: number;
  date: string;
  startTime: string;
  endTime: string;
  department: string;
  designation: string;
  mySpace: string;
  tasksCarriedOut: string;
  keyLearningObservations: string;
  toolsTechnologyUsed: string;
  specialAchievements: string;
  totalHours?: string;

  editable?: boolean;
  onFieldChange?: (field: string, value: string) => void;
  onSave?: () => Promise<void> | void;
  isSaving?: boolean;

  allEntries?: DailyEntry[];
  profile?: Profile | ProfileFormData | null;
  onProfileChange?: (profile: ProfileFormData) => void;
  onSelectDay?: (dayNumber: number) => void;
}

export default function LogbookPreview({
  dayNumber = 1,
  date,
  startTime,
  endTime,
  department,
  designation,
  mySpace,
  tasksCarriedOut,
  keyLearningObservations,
  toolsTechnologyUsed,
  specialAchievements,
  totalHours,
  editable = true,
  onFieldChange,
  onSave,
  isSaving = false,
  allEntries = [],
  profile = null,
  onProfileChange,
  onSelectDay,
}: LogbookPreviewProps) {
  // Navigation: "profile" (Page 3) or "day" (Page 8+)
  const [activeTab, setActiveTab] = useState<"profile" | "day">("day");

  // View mode: direct interactive on-page editor vs compiled 90-page PDF viewer
  const [viewMode, setViewMode] = useState<"sheet" | "pdf">("sheet");

  // Zoom scale: allows the user to scale the sheet to fit their screen perfectly
  const [zoomScale, setZoomScale] = useState<number>(0.88);

  // Template background image URLs (pre-rendered pixel-perfect templates from official PDF)
  const [dayTemplateBg, setDayTemplateBg] = useState<string>("/templates/day_page_bg.png");
  const [profileTemplateBg, setProfileTemplateBg] = useState<string>("/templates/page_3_bg.png");
  const [loadingTemplate, setLoadingTemplate] = useState<boolean>(false);

  // Compiled PDF view state
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [downloadingComplete, setDownloadingComplete] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Local state for instant on-page editing of current day
  const [localDate, setLocalDate] = useState(formatDateDDMMYYYY(date));
  const [localStartTime, setLocalStartTime] = useState(startTime || "09:00 AM");
  const [localEndTime, setLocalEndTime] = useState(endTime || "05:00 PM");
  const [localDept, setLocalDept] = useState(department);
  const [localDesig, setLocalDesig] = useState(designation);
  const [localMySpace, setLocalMySpace] = useState(mySpace);
  const [localTasks, setLocalTasks] = useState(tasksCarriedOut);
  const [localKeyLearning, setLocalKeyLearning] = useState(keyLearningObservations);
  const [localTools, setLocalTools] = useState(toolsTechnologyUsed);
  const [localSpecial, setLocalSpecial] = useState(
    ensureSpecialAchievements(specialAchievements, tasksCarriedOut)
  );

  // Local state for Learner's Details (Page 3)
  const [localProfile, setLocalProfile] = useState<ProfileFormData>({
    learner_name: profile?.learner_name || "",
    registration_number: profile?.registration_number || "",
    program_name: profile?.program_name || "",
    semester: profile?.semester || "",
    location: profile?.location || "",
    industry_partner_name: profile?.industry_partner_name || "",
    ojt_start_date: formatDateDDMMYYYY(profile?.ojt_start_date || "") || profile?.ojt_start_date || "",
    ojt_end_date: profile?.ojt_end_date || "",
    department: profile?.department || "",
    designation: profile?.designation || "",
    supervisor_name: profile?.supervisor_name || "",
    phone_number: profile?.phone_number || "",
    email_id: profile?.email_id || "",
  });

  // Background templates are pre-rendered and ready instantly
  useEffect(() => {
    // If the template images exist, ensure loadingTemplate is false
    setLoadingTemplate(false);
  }, []);

  // Sync profile when prop changes from outside without clobbering active input
  useEffect(() => {
    if (profile) {
      setLocalProfile((prev) => {
        let isDifferent = false;
        for (const k of Object.keys(profile) as (keyof ProfileFormData)[]) {
          if ((profile[k] || "") !== (prev[k] || "")) {
            isDifferent = true;
            break;
          }
        }
        if (!isDifferent) return prev;
        return {
          ...prev,
          ...profile,
          ojt_start_date: profile.ojt_start_date || prev.ojt_start_date,
        };
      });
    }
  }, [profile]);

  // Sync day fields when props change
  useEffect(() => {
    setLocalDate(formatDateDDMMYYYY(date));
    setLocalStartTime(startTime || "09:00 AM");
    setLocalEndTime(endTime || "05:00 PM");
    setLocalDept(department);
    setLocalDesig(designation);
    const cleanEllipsis = (t: string) =>
      (t || "").replace(/\.{2,}\s*$/gm, ".").replace(/…\s*$/gm, ".");

    setLocalMySpace(cleanEllipsis(mySpace));
    setLocalTasks(cleanEllipsis(tasksCarriedOut));
    setLocalKeyLearning(cleanEllipsis(keyLearningObservations));
    setLocalTools(cleanEllipsis(toolsTechnologyUsed));
    setLocalSpecial(cleanEllipsis(ensureSpecialAchievements(specialAchievements, tasksCarriedOut)));
  }, [
    date,
    startTime,
    endTime,
    department,
    designation,
    mySpace,
    tasksCarriedOut,
    keyLearningObservations,
    toolsTechnologyUsed,
    specialAchievements,
  ]);

  const activeHours = totalHours || calculateHours(localStartTime, localEndTime);

  const handleUpdate = (field: string, value: string) => {
    switch (field) {
      case "date":
        setLocalDate(value);
        break;
      case "startTime":
        setLocalStartTime(value);
        break;
      case "endTime":
        setLocalEndTime(value);
        break;
      case "department":
        setLocalDept(value);
        break;
      case "designation":
        setLocalDesig(value);
        break;
      case "mySpace":
        setLocalMySpace(value);
        break;
      case "tasksCarriedOut":
        setLocalTasks(value);
        break;
      case "keyLearningObservations":
        setLocalKeyLearning(value);
        break;
      case "toolsTechnologyUsed":
        setLocalTools(value);
        break;
      case "specialAchievements":
        setLocalSpecial(value);
        break;
    }
    if (onFieldChange) {
      onFieldChange(field, value);
    }
  };

  const handleProfileUpdate = (field: keyof ProfileFormData, value: string) => {
    const updated = { ...localProfile, [field]: value };
    setLocalProfile(updated);
    if (onProfileChange) {
      onProfileChange(updated);
    }
    try {
      localStorage.setItem("ojt_user_profile", JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  // Compile entries for PDF generation
  const buildFormattedEntries = (): SingleDayData[] => {
    let foundCurrentDay = false;
    const formatted: SingleDayData[] = allEntries.map((e, idx) => {
      let dNum = idx + 1;
      const match = (e.original_text || e.my_space || "").match(/(?:day\s*([0-9]+)|day-([0-9]+))/i);
      if (match) {
        const parsed = parseInt(match[1] || match[2], 10);
        if (parsed >= 1 && parsed <= 76) dNum = parsed;
      }

      if (dNum === dayNumber) {
        foundCurrentDay = true;
        return {
          dayNumber,
          date: localDate,
          startTime: localStartTime,
          endTime: localEndTime,
          department: localDept,
          designation: localDesig,
          mySpace: localMySpace,
          tasksCarriedOut: localTasks,
          keyLearningObservations: localKeyLearning,
          toolsTechnologyUsed: localTools,
          specialAchievements: ensureSpecialAchievements(localSpecial, localTasks),
          totalHours: activeHours,
        };
      }

      return {
        dayNumber: dNum,
        date: e.date,
        startTime: e.start_time,
        endTime: e.end_time,
        department: e.department,
        designation: e.designation,
        mySpace: e.my_space,
        tasksCarriedOut: e.tasks_carried_out,
        keyLearningObservations: e.key_learning_observations,
        toolsTechnologyUsed: e.tools_technology_used,
        specialAchievements: ensureSpecialAchievements(e.special_achievements, e.tasks_carried_out),
        totalHours: calculateHours(e.start_time, e.end_time),
      };
    });

    if (!foundCurrentDay) {
      formatted.push({
        dayNumber,
        date: localDate,
        startTime: localStartTime,
        endTime: localEndTime,
        department: localDept,
        designation: localDesig,
        mySpace: localMySpace,
        tasksCarriedOut: localTasks,
        keyLearningObservations: localKeyLearning,
        toolsTechnologyUsed: localTools,
        specialAchievements: ensureSpecialAchievements(localSpecial, localTasks),
        totalHours: activeHours,
      });
    }

    return formatted;
  };

  // Generate PDF only when PDF mode is active
  useEffect(() => {
    if (viewMode !== "pdf") return;

    let activeUrl: string | null = null;
    let isMounted = true;

    async function loadPdf() {
      setLoadingPdf(true);
      setPdfError(null);
      try {
        const formattedEntries = buildFormattedEntries();
        const effectiveProfile: ProfileFormData = {
          ...(profile || {}),
          ...localProfile,
          department: localDept || localProfile.department || profile?.department || "",
          designation: localDesig || localProfile.designation || profile?.designation || "",
        };
        const url = await generateCompleteLogbookPreviewBlob(effectiveProfile, formattedEntries);

        if (isMounted) {
          activeUrl = url;
          setPdfUrl(url);
        }
      } catch (err: unknown) {
        if (isMounted) {
          setPdfError(err instanceof Error ? err.message : "Failed to render PDF");
        }
      } finally {
        if (isMounted) setLoadingPdf(false);
      }
    }

    const timer = setTimeout(() => {
      loadPdf();
    }, 400);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      if (activeUrl) window.URL.revokeObjectURL(activeUrl);
    };
  }, [
    viewMode,
    dayNumber,
    localDate,
    localStartTime,
    localEndTime,
    localDept,
    localDesig,
    localMySpace,
    localTasks,
    localKeyLearning,
    localTools,
    localSpecial,
    localProfile,
    allEntries,
    profile,
  ]);

  async function handleSaveClick() {
    try {
      localStorage.setItem("ojt_user_profile", JSON.stringify(localProfile));
    } catch {}
    if (onSave) {
      await onSave();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }
  }

  async function handleDownloadCompleteLogbook() {
    setDownloadingComplete(true);
    try {
      const formattedEntries = buildFormattedEntries();
      const effectiveProfile: ProfileFormData = {
        ...(profile || {}),
        ...localProfile,
        department: localDept || localProfile.department || profile?.department || "",
        designation: localDesig || localProfile.designation || profile?.designation || "",
      };
      await generateCompleteLogbookPDF(effectiveProfile, formattedEntries);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to download complete logbook PDF");
    } finally {
      setDownloadingComplete(false);
    }
  }

  const currentIndex = allEntries.findIndex((e, idx) => {
    let dNum = idx + 1;
    const match = (e.original_text || e.my_space || "").match(/(?:day\s*([0-9]+)|day-([0-9]+))/i);
    if (match) {
      const parsed = parseInt(match[1] || match[2], 10);
      if (parsed >= 1 && parsed <= 76) dNum = parsed;
    }
    return dNum === dayNumber;
  });

  const hasPrev = activeTab === "day" && (currentIndex > 0 || currentIndex === 0);
  const hasNext = activeTab === "profile" || (currentIndex !== -1 && currentIndex < allEntries.length - 1);

  const goToPrev = () => {
    if (activeTab === "day") {
      if (currentIndex === 0 || allEntries.length === 0) {
        setActiveTab("profile");
      } else if (currentIndex > 0 && onSelectDay) {
        const prevEntry = allEntries[currentIndex - 1];
        const match = (prevEntry.original_text || prevEntry.my_space || "").match(/(?:day\s*([0-9]+)|day-([0-9]+))/i);
        const dNum = match ? parseInt(match[1] || match[2], 10) : currentIndex;
        onSelectDay(dNum);
      }
    }
  };

  const goToNext = () => {
    if (activeTab === "profile") {
      setActiveTab("day");
      if (onSelectDay && allEntries.length > 0) {
        const firstEntry = allEntries[0];
        const match = (firstEntry.original_text || firstEntry.my_space || "").match(/(?:day\s*([0-9]+)|day-([0-9]+))/i);
        const dNum = match ? parseInt(match[1] || match[2], 10) : 1;
        onSelectDay(dNum);
      }
    } else if (hasNext && onSelectDay) {
      const nextEntry = allEntries[currentIndex + 1];
      const match = (nextEntry.original_text || nextEntry.my_space || "").match(/(?:day\s*([0-9]+)|day-([0-9]+))/i);
      const dNum = match ? parseInt(match[1] || match[2], 10) : currentIndex + 2;
      onSelectDay(dNum);
    }
  };

  const targetPdfPage = activeTab === "profile" ? 3 : 7 + dayNumber;

  return (
    <div className="bg-white rounded-2xl border border-surface-200 shadow-md overflow-hidden animate-fade-in">
      {/* ── Top Header & Mode Toggle Bar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-surface-200 bg-surface-50/90">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-primary-100 flex items-center justify-center text-primary-700 shadow-xs">
            <BookOpen className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-surface-900">
                {activeTab === "profile"
                  ? "Learner's Details (Page 3 of 90)"
                  : `OJT Logbook — Day ${dayNumber} (Page ${7 + dayNumber} of 90)`}
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800">
                {viewMode === "sheet" ? "Direct PDF Image Editor" : "Compiled PDF View"}
              </span>
            </div>
            <p className="text-[11px] text-surface-800/60">
              {viewMode === "sheet"
                ? "Full image of official PDF page with interactive editable overlays in exact boxes"
                : "Official 90-page document view with your text stamped"}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Zoom scale controls */}
          {viewMode === "sheet" && (
            <div className="flex items-center gap-1 bg-surface-200/80 px-2 py-1 rounded-lg border border-surface-200 text-xs text-surface-700">
              <button
                type="button"
                onClick={() => setZoomScale((s) => Math.max(0.65, +(s - 0.05).toFixed(2)))}
                className="p-0.5 hover:text-surface-900 cursor-pointer"
                title="Zoom Out (Fit page to screen)"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="font-bold text-[11px] px-1">{Math.round(zoomScale * 100)}%</span>
              <button
                type="button"
                onClick={() => setZoomScale((s) => Math.min(1.2, +(s + 0.05).toFixed(2)))}
                className="p-0.5 hover:text-surface-900 cursor-pointer"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setZoomScale(0.88)}
                className="ml-1 text-[10px] font-semibold text-primary-700 hover:underline cursor-pointer"
                title="Reset zoom to fit"
              >
                Fit
              </button>
            </div>
          )}

          {/* Segmented Mode Switcher */}
          <div className="flex items-center p-1 bg-surface-200/80 rounded-xl border border-surface-200">
            <button
              type="button"
              onClick={() => setViewMode("sheet")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === "sheet"
                  ? "bg-white text-primary-700 shadow-xs"
                  : "text-surface-600 hover:text-surface-900"
              }`}
            >
              <PenTool className="w-3.5 h-3.5" />
              Direct Edit (PDF Image)
            </button>
            <button
              type="button"
              onClick={() => setViewMode("pdf")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === "pdf"
                  ? "bg-white text-primary-700 shadow-xs"
                  : "text-surface-600 hover:text-surface-900"
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              Compiled PDF View
            </button>
          </div>

          {/* Save Button */}
          {editable && onSave && (
            <button
              type="button"
              onClick={handleSaveClick}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : saveSuccess ? (
                <CheckCircle className="w-3.5 h-3.5 text-emerald-200" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              {saveSuccess ? "Saved!" : "Save Changes"}
            </button>
          )}

          {/* Download Complete 90-Page PDF */}
          <button
            type="button"
            onClick={handleDownloadCompleteLogbook}
            disabled={downloadingComplete}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
          >
            {downloadingComplete ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            Download PDF
          </button>

          {/* Fullscreen external link if in PDF mode */}
          {viewMode === "pdf" && pdfUrl && (
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-surface-700 hover:bg-surface-200 border border-surface-200 transition-colors"
              title="Open full size PDF in new tab"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </div>

      {/* ── Day & Learner Details Navigation Ribbon ── */}
      <div className="flex items-center justify-between px-4 py-2 bg-surface-100/70 border-b border-surface-200 text-xs">
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={goToPrev}
            disabled={activeTab === "profile"}
            className="p-1.5 rounded-lg border border-surface-200 bg-white text-surface-700 hover:bg-surface-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            title="Previous Page"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <span className="font-bold text-surface-700">Navigate:</span>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto mx-2 py-0.5">
          {/* Learner's Details (Page 3) Tab */}
          <button
            type="button"
            onClick={() => setActiveTab("profile")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-bold shrink-0 transition-all cursor-pointer ${
              activeTab === "profile"
                ? "bg-indigo-600 text-white shadow-xs"
                : "bg-white text-surface-700 hover:bg-surface-200 border border-surface-200"
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            Learner’s Details (Page 3)
          </button>

          <span className="text-surface-300 font-bold px-1 select-none">|</span>

          {/* Days List */}
          {allEntries.length > 0 ? (
            allEntries.map((e, idx) => {
              let dNum = idx + 1;
              const match = (e.original_text || e.my_space || "").match(/(?:day\s*([0-9]+)|day-([0-9]+))/i);
              if (match) {
                const parsed = parseInt(match[1] || match[2], 10);
                if (parsed >= 1 && parsed <= 76) dNum = parsed;
              }
              const isActive = activeTab === "day" && dNum === dayNumber;
              return (
                <button
                  key={e.id || idx}
                  type="button"
                  onClick={() => {
                    setActiveTab("day");
                    if (onSelectDay) onSelectDay(dNum);
                  }}
                  className={`px-3 py-1 rounded-lg font-bold shrink-0 transition-all cursor-pointer ${
                    isActive
                      ? "bg-primary-600 text-white shadow-xs scale-102"
                      : "bg-white text-surface-700 hover:bg-surface-200 border border-surface-200"
                  }`}
                >
                  Day {dNum}
                </button>
              );
            })
          ) : (
            <button
              type="button"
              onClick={() => setActiveTab("day")}
              className={`px-3 py-1 rounded-lg font-bold shrink-0 transition-all cursor-pointer ${
                activeTab === "day"
                  ? "bg-primary-600 text-white shadow-xs"
                  : "bg-white text-surface-700 hover:bg-surface-200 border border-surface-200"
              }`}
            >
              Day {dayNumber}
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={goToNext}
          disabled={!hasNext}
          className="p-1.5 rounded-lg border border-surface-200 bg-white text-surface-700 hover:bg-surface-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0"
          title="Next Page"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ── Main Viewport ── */}
      {viewMode === "sheet" ? (
        /* ========================================================================= */
        /* MODE 1: DIRECT INTERACTIVE EDIT ON THE FULL REAL PDF PAGE IMAGE           */
        /* The real PDF template page image is the background, overlays are exact!   */
        /* ========================================================================= */
        <div className="bg-slate-200/90 py-6 px-2 sm:px-4 flex justify-center items-start overflow-auto min-h-[750px]">
          {loadingTemplate ? (
            <div className="flex flex-col items-center justify-center p-12 bg-white rounded-xl shadow-md">
              <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
              <p className="text-xs font-bold text-slate-700 mt-3">
                Loading authentic PDF template page image...
              </p>
            </div>
          ) : (
            <div
              style={{
                transform: `scale(${zoomScale})`,
                transformOrigin: "top center",
                width: "595px",
                height: "842px",
              }}
              className="relative bg-white shadow-2xl rounded-sm shrink-0 select-none"
            >
              {activeTab === "profile" ? (
                /* ── PAGE 3: FULL REAL PDF IMAGE + EDITABLE OVERLAYS ── */
                <>
                  {/* Full PDF Background Image of Page 3 */}
                  {profileTemplateBg ? (
                    <img
                      src={profileTemplateBg}
                      alt="Official OJT Page 3 (Learner Details)"
                      className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-white pointer-events-none" />
                  )}

                  {/* Absolute Positioned Editable Overlays for Page 3 */}
                  {/* 1. Learner's Name */}
                  <input
                    type="text"
                    value={localProfile.learner_name || ""}
                    onChange={(e) => handleProfileUpdate("learner_name", e.target.value)}
                    placeholder="Enter Learner's Name"
                    style={{
                      position: "absolute",
                      left: "27.5%",
                      top: "63.9%",
                      width: "58.5%",
                      height: "2.6%",
                      fontSize: (localProfile.learner_name?.length || 0) > 28 ? "10px" : "11.5px",
                    }}
                    className="bg-white/85 hover:bg-white focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-400 border border-sky-200 hover:border-sky-400 focus:border-sky-500 rounded-xs px-1.5 font-bold text-slate-900 leading-none shadow-2xs z-20 select-text pointer-events-auto transition-colors"
                  />

                  {/* 2. Registration No. */}
                  <input
                    type="text"
                    value={localProfile.registration_number || ""}
                    onChange={(e) => handleProfileUpdate("registration_number", e.target.value)}
                    placeholder="Reg No."
                    style={{
                      position: "absolute",
                      left: "27.5%",
                      top: "67.5%",
                      width: "25.0%",
                      height: "2.6%",
                      fontSize: "11px",
                    }}
                    className="bg-white/85 hover:bg-white focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-400 border border-sky-200 hover:border-sky-400 focus:border-sky-500 rounded-xs px-1.5 font-bold text-slate-900 leading-none shadow-2xs z-20 select-text pointer-events-auto transition-colors"
                  />

                  {/* 3. OJT Start Date */}
                  <input
                    type="text"
                    value={localProfile.ojt_start_date || ""}
                    onChange={(e) => handleProfileUpdate("ojt_start_date", e.target.value)}
                    onBlur={() => {
                      if (localProfile.ojt_start_date) {
                        const formatted = formatDateDDMMYYYY(localProfile.ojt_start_date);
                        if (formatted) handleProfileUpdate("ojt_start_date", formatted);
                      }
                    }}
                    placeholder="DD-MM-YYYY"
                    style={{
                      position: "absolute",
                      left: "62.0%",
                      top: "67.5%",
                      width: "24.0%",
                      height: "2.6%",
                      fontSize:
                        (localProfile.ojt_start_date?.length || 0) > 13
                          ? "8px"
                          : (localProfile.ojt_start_date?.length || 0) > 10
                          ? "9px"
                          : "10.5px",
                    }}
                    className="bg-white/85 hover:bg-white focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-400 border border-sky-200 hover:border-sky-400 focus:border-sky-500 rounded-xs px-1.5 font-bold text-slate-900 leading-none shadow-2xs z-20 select-text pointer-events-auto transition-colors"
                  />

                  {/* 4. Program Name */}
                  <input
                    type="text"
                    value={localProfile.program_name || ""}
                    onChange={(e) => handleProfileUpdate("program_name", e.target.value)}
                    placeholder="Program Name (e.g. B.Tech CSE)"
                    style={{
                      position: "absolute",
                      left: "27.5%",
                      top: "71.0%",
                      width: "58.5%",
                      height: "2.6%",
                      fontSize: (localProfile.program_name?.length || 0) > 34 ? "9px" : "11px",
                    }}
                    className="bg-white/85 hover:bg-white focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-400 border border-sky-200 hover:border-sky-400 focus:border-sky-500 rounded-xs px-1.5 font-bold text-slate-900 leading-none shadow-2xs z-20 select-text pointer-events-auto transition-colors"
                  />

                  {/* 5. Semester */}
                  <input
                    type="text"
                    value={localProfile.semester || ""}
                    onChange={(e) => handleProfileUpdate("semester", e.target.value)}
                    placeholder="Semester"
                    style={{
                      position: "absolute",
                      left: "22.5%",
                      top: "74.6%",
                      width: "11.5%",
                      height: "2.6%",
                      fontSize: "11px",
                    }}
                    className="bg-white/85 hover:bg-white focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-400 border border-sky-200 hover:border-sky-400 focus:border-sky-500 rounded-xs px-1.5 font-bold text-slate-900 leading-none shadow-2xs z-20 select-text pointer-events-auto transition-colors"
                  />

                  {/* 6. Location */}
                  <input
                    type="text"
                    value={localProfile.location || ""}
                    onChange={(e) => handleProfileUpdate("location", e.target.value)}
                    placeholder="Location"
                    style={{
                      position: "absolute",
                      left: "42.0%",
                      top: "74.6%",
                      width: "44.0%",
                      height: "2.6%",
                      fontSize:
                        (localProfile.location?.length || 0) > 32
                          ? "8px"
                          : (localProfile.location?.length || 0) > 22
                          ? "9.5px"
                          : "11px",
                    }}
                    className="bg-white/85 hover:bg-white focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-400 border border-sky-200 hover:border-sky-400 focus:border-sky-500 rounded-xs px-1.5 font-bold text-slate-900 leading-none shadow-2xs z-20 select-text pointer-events-auto transition-colors"
                  />

                  {/* 7. Industry Partner Name */}
                  <input
                    type="text"
                    value={localProfile.industry_partner_name || ""}
                    onChange={(e) => handleProfileUpdate("industry_partner_name", e.target.value)}
                    placeholder="Industry Partner Name"
                    style={{
                      position: "absolute",
                      left: "33.0%",
                      top: "78.2%",
                      width: "53.0%",
                      height: "2.6%",
                      fontSize: (localProfile.industry_partner_name?.length || 0) > 30 ? "9px" : "11px",
                    }}
                    className="bg-white/85 hover:bg-white focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-400 border border-sky-200 hover:border-sky-400 focus:border-sky-500 rounded-xs px-1.5 font-bold text-slate-900 leading-none shadow-2xs z-20 select-text pointer-events-auto transition-colors"
                  />

                  {/* 8. Phone No. */}
                  <input
                    type="text"
                    value={localProfile.phone_number || ""}
                    onChange={(e) => handleProfileUpdate("phone_number", e.target.value)}
                    placeholder="Phone No."
                    style={{
                      position: "absolute",
                      left: "17.5%",
                      top: "87.9%",
                      width: "25.0%",
                      height: "2.6%",
                      fontSize: "11px",
                    }}
                    className="bg-white/85 hover:bg-white focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-400 border border-sky-200 hover:border-sky-400 focus:border-sky-500 rounded-xs px-1.5 font-bold text-slate-900 leading-none shadow-2xs z-20 select-text pointer-events-auto transition-colors"
                  />

                  {/* 9. Email Id (Locked to University login) */}
                  <input
                    type="text"
                    value={localProfile.email_id || ""}
                    readOnly
                    title="Locked to authenticated university account"
                    placeholder="email Id"
                    style={{
                      position: "absolute",
                      left: "48.0%",
                      top: "87.9%",
                      width: "44.0%",
                      height: "2.6%",
                      fontSize: (localProfile.email_id?.length || 0) > 24 ? "10px" : "11.5px",
                    }}
                    className="bg-surface-100/90 text-slate-600 border border-surface-300 rounded-xs px-1.5 font-bold leading-none cursor-not-allowed select-text z-20 pointer-events-auto"
                  />
                </>
              ) : (
                /* ── DAY JOURNAL: FULL REAL PDF IMAGE + EDITABLE OVERLAYS ── */
                <>
                  {/* Full PDF Background Image of Page 8 */}
                  <img
                    src={dayTemplateBg || "/templates/day_page_bg.png"}
                    alt="Official OJT Day Journal Page"
                    className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none"
                  />

                  {/* Dynamic Top Pill Banner: DAILY ACTIVITY JOURNAL – Day X */}
                  <div
                    style={{
                      position: "absolute",
                      left: "8.15%",
                      top: "3.38%",
                      width: "83.85%",
                      height: "4.22%",
                      backgroundColor: "#e19528",
                      borderRadius: "9999px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      zIndex: 10,
                    }}
                    className="select-none pointer-events-none shadow-xs"
                  >
                    <span className="text-white font-extrabold text-[15px] tracking-wide uppercase drop-shadow-xs">
                      DAILY ACTIVITY JOURNAL – Day {dayNumber}
                    </span>
                  </div>

                  {/* Absolute Positioned Editable Overlays for Day Page */}
                  {/* 1. Date */}
                  <input
                    type="text"
                    value={localDate}
                    onChange={(e) => handleUpdate("date", e.target.value)}
                    placeholder="DD-MM-YYYY"
                    style={{
                      position: "absolute",
                      left: "13.8%",
                      top: "9.8%",
                      width: "32.0%",
                      height: "2.1%",
                    }}
                    className="bg-white/90 hover:bg-white focus:bg-white focus:outline-none px-1 text-[11px] font-bold text-slate-900 rounded-xs border border-transparent focus:border-sky-500 shadow-xs"
                  />

                  {/* 2. Start Time */}
                  <input
                    type="text"
                    value={localStartTime}
                    onChange={(e) => handleUpdate("startTime", e.target.value)}
                    placeholder="09:00 AM"
                    style={{
                      position: "absolute",
                      left: "62.0%",
                      top: "9.8%",
                      width: "12.8%",
                      height: "2.1%",
                    }}
                    className="bg-white/90 hover:bg-white focus:bg-white focus:outline-none px-1 text-[11px] font-bold text-slate-900 rounded-xs border border-transparent focus:border-sky-500 shadow-xs"
                  />

                  {/* 3. End Time */}
                  <input
                    type="text"
                    value={localEndTime}
                    onChange={(e) => handleUpdate("endTime", e.target.value)}
                    placeholder="05:00 PM"
                    style={{
                      position: "absolute",
                      left: "79.0%",
                      top: "9.8%",
                      width: "11.6%",
                      height: "2.1%",
                    }}
                    className="bg-white/90 hover:bg-white focus:bg-white focus:outline-none px-1 text-[11px] font-bold text-slate-900 rounded-xs border border-transparent focus:border-sky-500 shadow-xs"
                  />

                  {/* 4. Department */}
                  <input
                    type="text"
                    value={localDept}
                    onChange={(e) => handleUpdate("department", e.target.value)}
                    placeholder="Department"
                    style={{
                      position: "absolute",
                      left: "21.0%",
                      top: "12.8%",
                      width: "28.5%",
                      height: "2.1%",
                    }}
                    className="bg-white/90 hover:bg-white focus:bg-white focus:outline-none px-1 text-[10.5px] font-bold text-slate-900 rounded-xs border border-transparent focus:border-sky-500 shadow-xs"
                  />

                  {/* 5. Designation */}
                  <input
                    type="text"
                    value={localDesig}
                    onChange={(e) => handleUpdate("designation", e.target.value)}
                    placeholder="Designation"
                    style={{
                      position: "absolute",
                      left: "63.8%",
                      top: "12.8%",
                      width: "26.5%",
                      height: "2.1%",
                    }}
                    className="bg-white/90 hover:bg-white focus:bg-white focus:outline-none px-1 text-[10.5px] font-bold text-slate-900 rounded-xs border border-transparent focus:border-sky-500 shadow-xs"
                  />

                  {/* 6. Box 1: MY SPACE (Auto-fit font size, exact vector coordinates inside official PDF box) */}
                  <AutoFitTextarea
                    value={localMySpace}
                    onChange={(val) => handleUpdate("mySpace", val)}
                    placeholder="Click to type thoughts, notes, reflections..."
                    defaultFontSize={11.5}
                    minFontSize={8.0}
                    style={{
                      position: "absolute",
                      left: "8.1%",
                      top: "20.9%",
                      width: "83.8%",
                      height: "18.0%",
                      padding: "8px",
                    }}
                  />

                  {/* 7. Box 2: Tasks Carried Out Today (Auto-fit font size, exact vector coordinates) */}
                  <AutoFitTextarea
                    value={localTasks}
                    onChange={(val) => handleUpdate("tasksCarriedOut", val)}
                    placeholder="Click to type tasks completed today..."
                    defaultFontSize={11.5}
                    minFontSize={8.0}
                    style={{
                      position: "absolute",
                      left: "8.1%",
                      top: "43.9%",
                      width: "83.8%",
                      height: "13.5%",
                      padding: "8px",
                    }}
                  />

                  {/* 8. Box 3: Key Learnings / Observations (Auto-fit font size, exact vector coordinates) */}
                  <AutoFitTextarea
                    value={localKeyLearning}
                    onChange={(val) => handleUpdate("keyLearningObservations", val)}
                    placeholder="Click to type key learnings & observations..."
                    defaultFontSize={11.0}
                    minFontSize={7.5}
                    style={{
                      position: "absolute",
                      left: "8.1%",
                      top: "62.7%",
                      width: "83.8%",
                      height: "8.0%",
                      padding: "6px",
                    }}
                  />

                  {/* 9. Box 4: Tools, Equipment, Technology or Techniques Used (Auto-fit font size) */}
                  <AutoFitTextarea
                    value={localTools}
                    onChange={(val) => handleUpdate("toolsTechnologyUsed", val)}
                    placeholder="Tools, technologies, techniques..."
                    defaultFontSize={11.5}
                    minFontSize={8.0}
                    style={{
                      position: "absolute",
                      left: "8.1%",
                      top: "77.5%",
                      width: "44.8%",
                      height: "14.7%",
                      padding: "8px",
                    }}
                  />

                  {/* 10. Box 5: Special Achievements (Auto-fit font size) */}
                  <AutoFitTextarea
                    value={localSpecial}
                    onChange={(val) => handleUpdate("specialAchievements", val)}
                    placeholder="Special milestones or achievements..."
                    defaultFontSize={11.5}
                    minFontSize={8.0}
                    style={{
                      position: "absolute",
                      left: "54.3%",
                      top: "77.5%",
                      width: "37.6%",
                      height: "14.7%",
                      padding: "8px",
                    }}
                  />

                  {/* Dynamic Bottom Page Number & Day */}
                  <div
                    style={{
                      position: "absolute",
                      left: "40%",
                      top: "93.4%",
                      width: "20%",
                      height: "2.2%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: "#eaebec",
                      zIndex: 10,
                    }}
                    className="text-[11px] font-bold text-slate-700 select-none pointer-events-none rounded-xs"
                  >
                    Page {7 + dayNumber} of 90
                  </div>
                  <div
                    style={{
                      position: "absolute",
                      right: "8.15%",
                      top: "93.4%",
                      width: "12%",
                      height: "2.2%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "flex-end",
                      backgroundColor: "white",
                      zIndex: 10,
                    }}
                    className="text-[11px] font-bold text-slate-500 select-none pointer-events-none"
                  >
                    Day {dayNumber}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      ) : (
        /* ========================================================================= */
        /* MODE 2: COMPILED 90-PAGE PDF VIEWER (Official Stamped Logbook)           */
        /* ========================================================================= */
        <div className="bg-surface-100/60 p-4 sm:p-6 flex flex-col items-center justify-start min-h-[850px]">
          <div className="relative w-full min-h-[820px] flex items-center justify-center rounded-xl overflow-hidden border border-surface-200 bg-white shadow-sm">
            {loadingPdf && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/90 backdrop-blur-xs">
                <Loader2 className="w-9 h-9 text-primary-500 animate-spin" />
                <p className="text-xs font-bold text-surface-700 mt-3">
                  Rendering official 90-page logbook preview stamped at Page {targetPdfPage}...
                </p>
              </div>
            )}

            {pdfError ? (
              <div className="text-center p-8">
                <p className="text-sm text-red-600 font-bold">{pdfError}</p>
                <button
                  type="button"
                  onClick={() => setViewMode("sheet")}
                  className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surface-200 text-xs font-bold text-surface-800 hover:bg-surface-300 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Return to On-Page Editor
                </button>
              </div>
            ) : (
              pdfUrl && (
                <iframe
                  src={`${pdfUrl}#page=${targetPdfPage}&toolbar=1&navpanes=1`}
                  className="w-full h-[850px] rounded-xl bg-white border-0"
                  title="Official Complete OJT Logbook Preview (90 Pages)"
                />
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
