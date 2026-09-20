"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { calculateHours, getTodayDate, ensureSpecialAchievements, formatDateDDMMYYYY, formatDateYYYYMMDD } from "@/lib/utils";
import { validateExtraction } from "@/lib/validation";
import type { ExtractedDayEntry, ExtractedLogbook, ExtractionResponse, DailyEntry, ProfileFormData } from "@/lib/types";
import { extractTextFromFile } from "@/lib/file-extractor";
import LogbookPreview from "@/components/logbook-preview";
import TimePicker from "@/components/time-picker";
import { generateSingleDayPDF, generateCompleteLogbookPDF } from "@/lib/pdf-generator";
import {
  Sparkles,
  Loader2,
  AlertTriangle,
  CheckCircle,
  Save,
  Download,
  Eye,
  EyeOff,
  PenLine,
  Calendar,
  Clock,
  Building2,
  Briefcase,
  Layers,
  UserCheck,
  ChevronDown,
  ChevronUp,
  Phone,
  Mail,
  Upload,
  FileText,
  X,
} from "lucide-react";

export default function NewEntryPage() {
  const router = useRouter();

  // Learner's Details (Page 3 of Logbook)
  const [profile, setProfile] = useState<ProfileFormData>({
    learner_name: "",
    registration_number: "",
    program_name: "",
    semester: "",
    location: "",
    industry_partner_name: "",
    ojt_start_date: "",
    ojt_end_date: "",
    department: "",
    designation: "",
    supervisor_name: "",
    phone_number: "",
    email_id: "",
  });
  const [showLearnersDetails, setShowLearnersDetails] = useState(false);
  const [savingLearnerDetails, setSavingLearnerDetails] = useState(false);
  const [learnerDetailsSaved, setLearnerDetailsSaved] = useState(false);

  // Multi-day state
  const [extractedDays, setExtractedDays] = useState<ExtractedDayEntry[]>([]);
  const [activeDayIndex, setActiveDayIndex] = useState<number>(0);

  // Active day basic info (Day Number is inferred from text or sequence)
  const [dayNumber, setDayNumber] = useState(1);
  const [date, setDate] = useState(getTodayDate());
  const [startTime, setStartTime] = useState("09:00 AM");
  const [endTime, setEndTime] = useState("05:00 PM");
  const [department, setDepartment] = useState("");
  const [designation, setDesignation] = useState("");

  // Content
  const [originalText, setOriginalText] = useState("");
  const [manualMode, setManualMode] = useState(false);

  // Detected fields for active day
  const [mySpace, setMySpace] = useState("");
  const [tasksCarriedOut, setTasksCarriedOut] = useState("");
  const [keyLearningObservations, setKeyLearningObservations] = useState("");
  const [toolsTechnologyUsed, setToolsTechnologyUsed] = useState("");
  const [specialAchievements, setSpecialAchievements] = useState("");

  // UI state
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [downloadingFullPdf, setDownloadingFullPdf] = useState(false);
  const [status, setStatus] = useState<"idle" | "analyzing" | "success" | "warning" | "error">("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [filled, setFilled] = useState(false);

  // ── PRD Upload state (Default to PRD first) ──
  const [inputTab, setInputTab] = useState<"paste" | "prd">("prd");
  const [prdFile, setPrdFile] = useState<File | null>(null);
  const [prdGenerating, setPrdGenerating] = useState(false);
  const [prdStatus, setPrdStatus] = useState<"idle" | "reading" | "generating" | "success" | "error">("idle");
  const [prdStatusMessage, setPrdStatusMessage] = useState("");

  const totalHours = calculateHours(startTime, endTime);

  // Load profile from Neon or localStorage on mount
  useEffect(() => {
    async function loadProfile() {
      let currentUserId = "";
      try {
        currentUserId = localStorage.getItem("ojt_user_id") || "";
        const localProf = localStorage.getItem("ojt_user_profile");
        const storedName = localStorage.getItem("ojt_user_name");
        const storedMobile = localStorage.getItem("ojt_user_mobile");
        const storedLoginEmail = localStorage.getItem("ojt_user_login_email");
        if (localProf) {
          const parsed = JSON.parse(localProf);
          setProfile((prev) => ({
            ...prev,
            ...parsed,
            learner_name: parsed.learner_name || storedName || prev.learner_name,
            phone_number: parsed.phone_number || storedMobile || prev.phone_number,
            email_id: storedLoginEmail || parsed.email_id || prev.email_id,
            ojt_start_date: parsed.ojt_start_date ? (formatDateDDMMYYYY(parsed.ojt_start_date) || parsed.ojt_start_date) : prev.ojt_start_date,
          }));
          if (parsed.department && !department) setDepartment(parsed.department);
          if (parsed.designation && !designation) setDesignation(parsed.designation);
        } else if (storedName || storedMobile || storedLoginEmail) {
          setProfile((prev) => ({
            ...prev,
            learner_name: storedName || prev.learner_name,
            phone_number: storedMobile || prev.phone_number,
            email_id: storedLoginEmail || prev.email_id,
          }));
        }
      } catch {}

      // Fetch from Neon PostgreSQL
      if (currentUserId) {
        try {
          const res = await fetch(`/api/profile?userId=${encodeURIComponent(currentUserId)}`);
          if (res.ok) {
            const data = await res.json();
            if (data?.profile) {
              const p = data.profile;
              setProfile((prev) => ({
                ...prev,
                learner_name: p.learner_name || prev.learner_name,
                registration_number: p.enrollment_no || prev.registration_number,
                program_name: p.program_name || prev.program_name,
                industry_partner_name: p.industry_partner || prev.industry_partner_name,
                supervisor_name: p.supervisor_name || prev.supervisor_name,
                phone_number: p.phone_number || prev.phone_number,
                email_id: p.email_id || prev.email_id,
                ojt_start_date: p.ojt_start_date ? (formatDateDDMMYYYY(p.ojt_start_date) || p.ojt_start_date) : prev.ojt_start_date,
                ojt_end_date: p.ojt_end_date ? (formatDateDDMMYYYY(p.ojt_end_date) || p.ojt_end_date) : prev.ojt_end_date,
              }));
              if (p.department && !department) setDepartment(p.department);
              if (p.designation && !designation) setDesignation(p.designation);
            }
          }
        } catch (err) {
          console.warn("Could not fetch profile from Neon:", err);
        }
      }
    }
    loadProfile();
  }, []);

  // Helper to immediately update and persist profile fields to localStorage
  const updateProfileField = (field: keyof ProfileFormData, value: string) => {
    setProfile((prev) => {
      const updated = { ...prev, [field]: value };
      try {
        localStorage.setItem("ojt_user_profile", JSON.stringify(updated));
      } catch {}
      return updated;
    });
    if (field === "department") setDepartment(value);
    if (field === "designation") setDesignation(value);
  };

  // Helper to persist profile both to localStorage and Neon PostgreSQL
  async function saveProfileToDatabase(profToSave: ProfileFormData) {
    try {
      localStorage.setItem("ojt_user_profile", JSON.stringify(profToSave));
      const currentUserId = localStorage.getItem("ojt_user_id") || `usr_${profToSave.phone_number || "student"}`;

      await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: currentUserId,
          learner_name: profToSave.learner_name,
          enrollment_no: profToSave.registration_number,
          program_name: profToSave.program_name,
          industry_partner: profToSave.industry_partner_name,
          supervisor_name: profToSave.supervisor_name,
          phone_number: profToSave.phone_number,
          email_id: profToSave.email_id,
          ojt_start_date: profToSave.ojt_start_date,
          ojt_end_date: profToSave.ojt_end_date,
        }),
      });
    } catch (err) {
      console.warn("Could not save profile to Neon:", err);
    }
  }

  async function handleSaveLearnersDetails() {
    setSavingLearnerDetails(true);
    try {
      await saveProfileToDatabase(profile);
      setLearnerDetailsSaved(true);
      setTimeout(() => setLearnerDetailsSaved(false), 3500);
    } catch (err: any) {
      console.warn("Error saving learner details:", err);
    } finally {
      setSavingLearnerDetails(false);
    }
  }

  const handleDepartmentChange = (val: string) => {
    setDepartment(val);
    updateProfileField("department", val);
    syncCurrentToDays("department", val);
  };

  const handleDesignationChange = (val: string) => {
    setDesignation(val);
    updateProfileField("designation", val);
    syncCurrentToDays("designation", val);
  };

  const handleTextChange = (text: string) => {
    setOriginalText(text);
    const match = text.match(/(?:day\s*([0-9]+)|day-([0-9]+))/i);
    if (match) {
      const d = parseInt(match[1] || match[2], 10);
      if (d >= 1 && d <= 76) {
        setDayNumber(d);
      }
    }
  };

  function loadDayIntoForm(dayEntry: ExtractedDayEntry) {
    if (dayEntry.dayNumber) setDayNumber(dayEntry.dayNumber);
    if (dayEntry.date) {
      const ymd = formatDateYYYYMMDD(dayEntry.date);
      setDate(ymd || dayEntry.date);
    }
    if (dayEntry.startTime) setStartTime(dayEntry.startTime);
    if (dayEntry.endTime) setEndTime(dayEntry.endTime);
    if (dayEntry.department) setDepartment(dayEntry.department);
    if (dayEntry.designation) setDesignation(dayEntry.designation);

    const tasks = joinFragments(dayEntry.tasksCarriedOutToday);
    const resolvedSpecial = ensureSpecialAchievements(
      joinFragments(dayEntry.specialAchievements),
      tasks
    );

    setMySpace(joinFragments(dayEntry.mySpace));
    setTasksCarriedOut(tasks);
    setKeyLearningObservations(joinFragments(dayEntry.keyLearningObservations));
    setToolsTechnologyUsed(joinFragments(dayEntry.toolsTechnologyUsed));
    setSpecialAchievements(resolvedSpecial);
    setFilled(true);
    setShowPreview(true);
  }

  // Sync current active edits back into extractedDays
  const syncCurrentToDays = (updatedField?: string, updatedValue?: string) => {
    if (extractedDays.length === 0) return;
    setExtractedDays((prev) =>
      prev.map((d, idx) => {
        if (idx !== activeDayIndex) return d;
        return {
          ...d,
          dayNumber: updatedField === "dayNumber" ? Number(updatedValue) : dayNumber,
          date: updatedField === "date" ? updatedValue || date : date,
          startTime: updatedField === "startTime" ? updatedValue || startTime : startTime,
          endTime: updatedField === "endTime" ? updatedValue || endTime : endTime,
          department: updatedField === "department" ? updatedValue || department : department,
          designation: updatedField === "designation" ? updatedValue || designation : designation,
          mySpace: updatedField === "mySpace" ? [updatedValue || ""] : [mySpace],
          tasksCarriedOutToday: updatedField === "tasksCarriedOut" ? [updatedValue || ""] : [tasksCarriedOut],
          keyLearningObservations: updatedField === "keyLearningObservations" ? [updatedValue || ""] : [keyLearningObservations],
          toolsTechnologyUsed: updatedField === "toolsTechnologyUsed" ? [updatedValue || ""] : [toolsTechnologyUsed],
          specialAchievements: updatedField === "specialAchievements" ? [updatedValue || ""] : [specialAchievements],
        };
      })
    );
  };

  // =====================================================
  // GENERATE FROM PRD — AI generation for all working days
  // File text is extracted CLIENT-SIDE (browser), then sent as JSON.
  // =====================================================
  async function handleGenerateFromPRD() {
    if (!prdFile) {
      setPrdStatus("error");
      setPrdStatusMessage("Please select a PRD file to upload.");
      return;
    }

    // Derive dates from Learner's Details and Basic Information section below
    const effStartDate = profile.ojt_start_date || date || getTodayDate();
    const effEndDate = profile.ojt_end_date || date || getTodayDate();

    setPrdGenerating(true);
    setWarnings([]);

    try {
      // Step 1: Extract text from the file right here in the browser
      setPrdStatus("reading");
      setPrdStatusMessage(`Reading "${prdFile.name}"...`);
      let prdText: string;
      try {
        prdText = await extractTextFromFile(prdFile);
      } catch (extractErr: unknown) {
        setPrdStatus("error");
        setPrdStatusMessage(
          extractErr instanceof Error
            ? extractErr.message
            : "Failed to read the file. Please try a different format."
        );
        return;
      }

      if (!prdText.trim()) {
        setPrdStatus("error");
        setPrdStatusMessage("The file appears to be empty or could not be read.");
        return;
      }

      // Step 2: Send plain JSON to the API (no file upload needed)
      setPrdStatus("generating");
      setPrdStatusMessage("AI is writing your logbook entries — this may take 20–40 seconds...");

      const res = await fetch("/api/generate-from-prd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prdText,
          startDate: effStartDate,
          endDate: effEndDate,
          startTime: startTime || "09:00 AM",
          endTime: endTime || "05:00 PM",
          department: department || profile.department || "Software Development",
          designation: designation || profile.designation || "Software Development Intern",
        }),
      });

      const result = await res.json();

      if (!result.success) {
        setPrdStatus("error");
        setPrdStatusMessage(result.error || "Failed to generate entries. Please try again.");
        return;
      }

      if (result.days && result.days.length > 0) {
        const sanitizedDays = result.days.map((d: ExtractedDayEntry) => {
          const tasks = Array.isArray(d.tasksCarriedOutToday)
            ? d.tasksCarriedOutToday.join("\n")
            : String(d.tasksCarriedOutToday || "");
          const rawAch = Array.isArray(d.specialAchievements)
            ? d.specialAchievements.join("\n")
            : String(d.specialAchievements || "");
          const cleanAch = ensureSpecialAchievements(rawAch, tasks);
          return {
            ...d,
            specialAchievements: [cleanAch],
          };
        });

        setExtractedDays(sanitizedDays);
        setActiveDayIndex(0);
        loadDayIntoForm(sanitizedDays[0]);
        setPrdStatus("success");
        setPrdStatusMessage(
          `🎉 Generated ${sanitizedDays.length} working-day entries (Sundays skipped)!`
        );
        setShowPreview(true);
        setFilled(true);
      } else {
        setPrdStatus("error");
        setPrdStatusMessage("No entries were generated. Try a different date range.");
      }
    } catch {
      setPrdStatus("error");
      setPrdStatusMessage("Network error. Please check your connection and try again.");
    } finally {
      setPrdGenerating(false);
    }
  }

  // =====================================================
  // AUTO FILL LOGBOOK — AI extraction supporting Multi-Day
  // =====================================================
  async function handleAutoFill() {
    if (!originalText.trim()) {
      setStatus("error");
      setStatusMessage("Please paste your OJT content first.");
      return;
    }

    setLoading(true);
    setStatus("analyzing");
    setStatusMessage("Analyzing and categorizing your OJT content...");
    setWarnings([]);

    try {
      const res = await fetch("/api/extract-logbook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: originalText }),
      });

      const result: ExtractionResponse = await res.json();

      if (!result.success) {
        setStatus("error");
        setStatusMessage(result.error || "Failed to analyze text. Please try again.");
        setLoading(false);
        return;
      }

      // Check if multi-day was detected
      if (result.days && result.days.length > 1) {
        setExtractedDays(result.days);
        setActiveDayIndex(0);
        loadDayIntoForm(result.days[0]);
        setStatus("success");
        setStatusMessage(`🎉 Detected and extracted ${result.days.length} days of OJT activities!`);
      } else if (result.days && result.days.length === 1) {
        setExtractedDays(result.days);
        setActiveDayIndex(0);
        loadDayIntoForm(result.days[0]);
        setStatus("success");
        setStatusMessage("Logbook fields filled successfully.");
      } else if (result.data) {
        // Fallback for single data object
        const extracted = result.data;
        if (result.detectedDayNumber) {
          setDayNumber(result.detectedDayNumber);
        }
        setMySpace(joinFragments(extracted.mySpace));
        setTasksCarriedOut(joinFragments(extracted.tasksCarriedOutToday));
        setKeyLearningObservations(joinFragments(extracted.keyLearningObservations));
        setToolsTechnologyUsed(joinFragments(extracted.toolsTechnologyUsed));
        setSpecialAchievements(joinFragments(extracted.specialAchievements));
        setFilled(true);
        setShowPreview(true);
        setStatus("success");
        setStatusMessage("Logbook fields filled successfully.");
      }

      if (result.validationWarnings && result.validationWarnings.length > 0) {
        setWarnings(result.validationWarnings);
      }
    } catch {
      setStatus("error");
      setStatusMessage("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  // =====================================================
  // Field update handler
  // =====================================================
  const handleFieldUpdate = useCallback(
    (field: string, value: string) => {
      switch (field) {
        case "my_space":
        case "mySpace":
          setMySpace(value);
          break;
        case "tasks_carried_out":
        case "tasksCarriedOutToday":
          setTasksCarriedOut(value);
          break;
        case "key_learning_observations":
        case "keyLearningObservations":
          setKeyLearningObservations(value);
          break;
        case "tools_technology_used":
        case "toolsTechnologyUsed":
          setToolsTechnologyUsed(value);
          break;
        case "special_achievements":
        case "specialAchievements":
          setSpecialAchievements(value);
          break;
      }
      syncCurrentToDays(field, value);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeDayIndex, extractedDays]
  );

  // =====================================================
  // Save Single Day Entry
  // =====================================================
  async function handleSave() {
    setSaving(true);
    const currentUserId = localStorage.getItem("ojt_user_id") || "student";

    // Ensure profile / learner's details are also persisted to database
    await saveProfileToDatabase(profile);

    const localRow = {
      id: `entry_${currentUserId}_${dayNumber}_${Date.now()}`,
      user_id: currentUserId,
      day_number: dayNumber,
      date,
      start_time: startTime,
      end_time: endTime,
      total_hours: totalHours,
      department,
      designation,
      original_text: originalText || `Day ${dayNumber}`,
      my_space: mySpace,
      tasks_carried_out: tasksCarriedOut,
      key_learning_observations: keyLearningObservations,
      tools_technology_used: toolsTechnologyUsed,
      special_achievements: specialAchievements,
    };

    try {
      const existing = JSON.parse(localStorage.getItem("ojt_saved_entries") || "[]");
      existing.push(localRow);
      localStorage.setItem("ojt_saved_entries", JSON.stringify(existing));
      const userScopedKey = currentUserId ? `ojt_saved_entries_${currentUserId}` : "";
      if (userScopedKey) {
        localStorage.setItem(userScopedKey, JSON.stringify(existing));
      }

      // Sync to Neon PostgreSQL
      await fetch("/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUserId, entries: [localRow] }),
      });
    } catch (err) {
      console.warn("Entry save warning:", err);
    }

    router.push("/dashboard/logbook");
  }

  // =====================================================
  // Save ALL Multiple Days in one batch
  // =====================================================
  async function handleSaveAllDays() {
    if (extractedDays.length === 0) {
      return handleSave();
    }

    setSaving(true);
    const currentUserId = localStorage.getItem("ojt_user_id") || "student";

    // Ensure profile / learner's details are also persisted to database
    await saveProfileToDatabase(profile);

    // Ensure the currently edited day's changes are included
    const daysToSave = extractedDays.map((d, i) => {
      if (i === activeDayIndex) {
        return {
          ...d,
          dayNumber,
          date,
          startTime,
          endTime,
          department,
          designation,
          mySpace: [mySpace],
          tasksCarriedOutToday: [tasksCarriedOut],
          keyLearningObservations: [keyLearningObservations],
          toolsTechnologyUsed: [toolsTechnologyUsed],
          specialAchievements: [specialAchievements],
        };
      }
      return d;
    });

    const rows = daysToSave.map((d, index) => ({
      id: `entry_${currentUserId}_${d.dayNumber || index + 1}_${Date.now()}_${index}`,
      user_id: currentUserId,
      day_number: d.dayNumber || index + 1,
      date: d.date || getTodayDate(),
      start_time: d.startTime || "09:00 AM",
      end_time: d.endTime || "05:00 PM",
      total_hours: calculateHours(d.startTime || "09:00 AM", d.endTime || "05:00 PM"),
      department: d.department || department,
      designation: d.designation || designation,
      original_text: d.originalText || `Day ${d.dayNumber || index + 1}`,
      my_space: Array.isArray(d.mySpace) ? joinFragments(d.mySpace) : d.mySpace || "",
      tasks_carried_out: Array.isArray(d.tasksCarriedOutToday)
        ? joinFragments(d.tasksCarriedOutToday)
        : d.tasksCarriedOutToday || "",
      key_learning_observations: Array.isArray(d.keyLearningObservations)
        ? joinFragments(d.keyLearningObservations)
        : d.keyLearningObservations || "",
      tools_technology_used: Array.isArray(d.toolsTechnologyUsed)
        ? joinFragments(d.toolsTechnologyUsed)
        : d.toolsTechnologyUsed || "",
      special_achievements: Array.isArray(d.specialAchievements)
        ? joinFragments(d.specialAchievements)
        : d.specialAchievements || "",
    }));

    try {
      localStorage.setItem("ojt_saved_entries", JSON.stringify(rows));
      const userScopedKey = currentUserId ? `ojt_saved_entries_${currentUserId}` : "";
      if (userScopedKey) {
        localStorage.setItem(userScopedKey, JSON.stringify(rows));
      }

      // Sync batch to Neon PostgreSQL
      await fetch("/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUserId, entries: rows }),
      });
    } catch (err) {
      console.warn("Neon bulk entries save warning:", err);
    }

    router.push("/dashboard/logbook");
  }

  // =====================================================
  // Complete PDF Download (Official 90-Page OJT Template)
  // =====================================================

  async function handleDownloadCompletePDF() {
    setDownloadingFullPdf(true);
    try {
      const formattedEntries =
        extractedDays.length > 0
          ? extractedDays.map((d) => ({
              dayNumber: d.dayNumber,
              date: d.date || date,
              startTime: d.startTime || "09:00 AM",
              endTime: d.endTime || "05:00 PM",
              department: d.department || department,
              designation: d.designation || designation,
              mySpace: Array.isArray(d.mySpace) ? joinFragments(d.mySpace) : d.mySpace || "",
              tasksCarriedOut: Array.isArray(d.tasksCarriedOutToday)
                ? joinFragments(d.tasksCarriedOutToday)
                : d.tasksCarriedOutToday || "",
              keyLearningObservations: Array.isArray(d.keyLearningObservations)
                ? joinFragments(d.keyLearningObservations)
                : d.keyLearningObservations || "",
              toolsTechnologyUsed: Array.isArray(d.toolsTechnologyUsed)
                ? joinFragments(d.toolsTechnologyUsed)
                : d.toolsTechnologyUsed || "",
              specialAchievements: Array.isArray(d.specialAchievements)
                ? joinFragments(d.specialAchievements)
                : d.specialAchievements || "",
              totalHours: calculateHours(d.startTime || "09:00 AM", d.endTime || "05:00 PM"),
            }))
          : [
              {
                dayNumber,
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
              },
            ];

      const effectiveProfile: ProfileFormData = {
        ...profile,
        department: department || profile.department || "",
        designation: designation || profile.designation || "",
      };

      await generateCompleteLogbookPDF(effectiveProfile, formattedEntries);
    } catch (err: any) {
      alert(err.message || "Failed to generate complete PDF");
    } finally {
      setDownloadingFullPdf(false);
    }
  }

  // Format all extracted days for LogbookPreview navigation
  const multiDayEntries: DailyEntry[] = extractedDays.map((d, idx) => ({
    id: `temp-${idx}`,
    user_id: "",
    date: d.date || date,
    start_time: d.startTime || "09:00 AM",
    end_time: d.endTime || "05:00 PM",
    department: d.department || department,
    designation: d.designation || designation,
    original_text: d.originalText || `Day ${d.dayNumber}`,
    my_space: Array.isArray(d.mySpace) ? joinFragments(d.mySpace) : d.mySpace || "",
    tasks_carried_out: Array.isArray(d.tasksCarriedOutToday)
      ? joinFragments(d.tasksCarriedOutToday)
      : d.tasksCarriedOutToday || "",
    key_learning_observations: Array.isArray(d.keyLearningObservations)
      ? joinFragments(d.keyLearningObservations)
      : d.keyLearningObservations || "",
    tools_technology_used: Array.isArray(d.toolsTechnologyUsed)
      ? joinFragments(d.toolsTechnologyUsed)
      : d.toolsTechnologyUsed || "",
    special_achievements: Array.isArray(d.specialAchievements)
      ? joinFragments(d.specialAchievements)
      : d.specialAchievements || "",
    created_at: "",
    updated_at: "",
  }));

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">New Daily / Multi-Day Entry</h1>
          <p className="text-sm text-surface-800/60 mt-1">
            Paste your OJT content for a single day or <strong>multiple days at once</strong> — the system automatically maps each day into the official logbook.
          </p>
        </div>
      </div>

      {/* =========================================== */}
      {/* LEARNER'S DETAILS OPTION (PAGE 3 OF LOGBOOK) */}
      {/* =========================================== */}
      <div className="bg-white rounded-2xl border border-surface-200 p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-50 border border-primary-200 flex items-center justify-center text-primary-700 shrink-0">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-bold text-surface-900">Learner’s Details</h2>
                <span className="text-[11px] font-semibold text-surface-500 bg-surface-100 px-2 py-0.5 rounded-md">
                  Page 3 of Official Logbook
                </span>
                {profile.learner_name ? (
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    <CheckCircle className="w-3 h-3 text-emerald-600" /> {profile.learner_name}
                  </span>
                ) : (
                  <span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
                    Not filled yet
                  </span>
                )}
              </div>
              <p className="text-xs text-surface-500 mt-0.5">
                Stamps student credentials onto Page 3 of the official 90-page logbook.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowLearnersDetails(!showLearnersDetails)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-surface-200 hover:bg-surface-100 text-xs font-bold text-surface-700 cursor-pointer transition-all shrink-0"
          >
            {showLearnersDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            {showLearnersDetails ? "Hide Details" : profile.learner_name ? "Edit Learner's Details" : "Fill Learner's Details"}
          </button>
        </div>

        {/* Collapsible Form matching Page 3 layout */}
        {showLearnersDetails && (
          <div className="pt-3 border-t border-surface-200 space-y-4 animate-fade-in">
            <div className="p-4 rounded-xl bg-sky-50/50 border border-sky-200/80 space-y-3">
              <span className="text-[11px] font-bold text-sky-900 uppercase tracking-wider">
                Inside Blue Box (Academic & OJT Details)
              </span>

              {/* Row 1: Learner's Name */}
              <div>
                <label className="block text-xs font-bold text-surface-800 mb-1">
                  Learner’s Name
                </label>
                <input
                  type="text"
                  value={profile.learner_name || ""}
                  onChange={(e) => updateProfileField("learner_name", e.target.value)}
                  placeholder="e.g. Prem Singh"
                  className="w-full px-3 py-2 rounded-xl border border-surface-200 bg-white text-sm font-semibold text-surface-900 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400"
                />
              </div>

              {/* Row 2: Registration No & Start Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-surface-800 mb-1">
                    Registration No.
                  </label>
                  <input
                    type="text"
                    value={profile.registration_number || ""}
                    onChange={(e) => updateProfileField("registration_number", e.target.value)}
                    placeholder="e.g. 220101001"
                    className="w-full px-3 py-2 rounded-xl border border-surface-200 bg-white text-sm font-semibold text-surface-900 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-surface-800 mb-1">
                    Start Date
                  </label>
                  <input
                    type="text"
                    value={profile.ojt_start_date || ""}
                    onChange={(e) => updateProfileField("ojt_start_date", e.target.value)}
                    placeholder="e.g. 01-09-2026 or 1 September 2026"
                    className="w-full px-3 py-2 rounded-xl border border-surface-200 bg-white text-sm font-semibold text-surface-900 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400"
                  />
                </div>
              </div>

              {/* Row 3: Program Name */}
              <div>
                <label className="block text-xs font-bold text-surface-800 mb-1">
                  Program Name
                </label>
                <input
                  type="text"
                  value={profile.program_name || ""}
                  onChange={(e) => updateProfileField("program_name", e.target.value)}
                  placeholder="e.g. B.Tech Computer Science & Engineering"
                  className="w-full px-3 py-2 rounded-xl border border-surface-200 bg-white text-sm font-semibold text-surface-900 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400"
                />
              </div>

              {/* Row 4: Semester & Location */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-surface-800 mb-1">
                    Semester
                  </label>
                  <input
                    type="text"
                    value={profile.semester || ""}
                    onChange={(e) => updateProfileField("semester", e.target.value)}
                    placeholder="e.g. 7th Semester"
                    className="w-full px-3 py-2 rounded-xl border border-surface-200 bg-white text-sm font-semibold text-surface-900 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-surface-800 mb-1">
                    Location
                  </label>
                  <input
                    type="text"
                    value={profile.location || ""}
                    onChange={(e) => updateProfileField("location", e.target.value)}
                    placeholder="e.g. Bengaluru, Karnataka"
                    className="w-full px-3 py-2 rounded-xl border border-surface-200 bg-white text-sm font-semibold text-surface-900 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400"
                  />
                </div>
              </div>

              {/* Row 5: Industry Partner Name */}
              <div>
                <label className="block text-xs font-bold text-surface-800 mb-1">
                  Industry Partner Name
                </label>
                <input
                  type="text"
                  value={profile.industry_partner_name || ""}
                  onChange={(e) => updateProfileField("industry_partner_name", e.target.value)}
                  placeholder="e.g. Hindustan Aeronautics Limited"
                  className="w-full px-3 py-2 rounded-xl border border-surface-200 bg-white text-sm font-semibold text-surface-900 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400"
                />
              </div>

              {/* Row 6: Department & Designation */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-surface-800 mb-1">
                    Department
                  </label>
                  <input
                    type="text"
                    value={profile.department || department || ""}
                    onChange={(e) => handleDepartmentChange(e.target.value)}
                    placeholder="e.g. Software Engineering"
                    className="w-full px-3 py-2 rounded-xl border border-surface-200 bg-white text-sm font-semibold text-surface-900 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-surface-800 mb-1">
                    Designation
                  </label>
                  <input
                    type="text"
                    value={profile.designation || designation || ""}
                    onChange={(e) => handleDesignationChange(e.target.value)}
                    placeholder="e.g. Software Development Intern"
                    className="w-full px-3 py-2 rounded-xl border border-surface-200 bg-white text-sm font-semibold text-surface-900 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400"
                  />
                </div>
              </div>
            </div>

            {/* Contact Details (Below Blue Box) */}
            <div className="p-4 rounded-xl bg-surface-50 border border-surface-200 space-y-3">
              <span className="text-[11px] font-bold text-surface-700 uppercase tracking-wider">
                Contact Details (If Logbook Lost and Found)
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-bold text-surface-800 mb-1">
                    <Phone className="w-3.5 h-3.5 text-primary-500" />
                    Phone No.
                  </label>
                  <input
                    type="text"
                    value={profile.phone_number || ""}
                    onChange={(e) => updateProfileField("phone_number", e.target.value)}
                    placeholder="e.g. +91 9876543210"
                    className="w-full px-3 py-2 rounded-xl border border-surface-200 bg-white text-sm font-semibold text-surface-900 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="flex items-center gap-1.5 text-xs font-bold text-surface-800">
                      <Mail className="w-3.5 h-3.5 text-primary-500" />
                      Email ID
                    </label>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      University Account
                    </span>
                  </div>
                  <input
                    type="email"
                    value={profile.email_id || ""}
                    readOnly
                    className="w-full px-3 py-2 rounded-xl border border-surface-200 bg-surface-100 text-sm font-semibold text-surface-700 cursor-not-allowed select-all"
                    title="Email is locked to your authenticated university account"
                  />
                  <p className="text-[10px] text-surface-500 mt-1">
                    Locked to your authenticated university login.
                  </p>
                </div>

              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              <div>
                {learnerDetailsSaved && (
                  <span className="text-xs text-emerald-600 font-bold flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" /> Saved & stamped onto Page 3!
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={handleSaveLearnersDetails}
                disabled={savingLearnerDetails}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold cursor-pointer shadow-sm transition-all"
              >
                {savingLearnerDetails ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                Save Learner’s Details
              </button>
            </div>
          </div>
        )}
      </div>

      {/* =========================================== */}
      {/* CONTENT INPUT — TABBED: Paste OR Upload PRD */}
      {/* =========================================== */}
      <div className="bg-white rounded-2xl border border-surface-200 shadow-sm overflow-hidden">

        {/* ── Tab Bar (PRD First, Paste Second) ── */}
        <div className="flex border-b border-surface-200">
          <button
            type="button"
            onClick={() => setInputTab("prd")}
            className={`flex-1 flex items-center justify-center gap-2 px-5 py-3.5 text-sm font-bold transition-all cursor-pointer ${
              inputTab === "prd"
                ? "bg-white text-primary-700 border-b-2 border-primary-600 shadow-xs"
                : "bg-surface-50 text-surface-600 hover:bg-surface-100"
            }`}
          >
            <Upload className="w-4 h-4 text-primary-600" />
            Upload PRD File
            <span className="ml-1 px-1.5 py-0.5 rounded-md text-[10px] font-extrabold bg-primary-100 text-primary-700">AI AUTO</span>
          </button>
          <button
            type="button"
            onClick={() => setInputTab("paste")}
            className={`flex-1 flex items-center justify-center gap-2 px-5 py-3.5 text-sm font-bold transition-all cursor-pointer ${
              inputTab === "paste"
                ? "bg-white text-primary-700 border-b-2 border-primary-600 shadow-xs"
                : "bg-surface-50 text-surface-600 hover:bg-surface-100"
            }`}
          >
            <PenLine className="w-4 h-4" />
            Paste OJT Content
          </button>
        </div>

        {/* ── Tab 1: Upload PRD File (FIRST) ── */}
        {inputTab === "prd" && (
          <div className="p-6 space-y-5">
            <div>
              <h2 className="text-base font-bold text-surface-900 flex items-center gap-2">
                <Upload className="w-4 h-4 text-primary-600" />
                Upload PRD / Project Document
              </h2>
              <p className="text-xs text-surface-800/60 mt-1">
                Upload your PRD or project description file. AI will read it and auto-write logbook entries for
                every working day <strong>(Mon–Sat, Sundays skipped)</strong> in your chosen date range.
              </p>
            </div>

            {/* File Drop Zone */}
            <div
              className={`relative border-2 border-dashed rounded-2xl p-6 text-center transition-all ${
                prdFile
                  ? "border-primary-400 bg-primary-50/40"
                  : "border-surface-300 bg-surface-50 hover:border-primary-400 hover:bg-primary-50/20"
              }`}
            >
              <input
                id="prd-file-input"
                type="file"
                accept=".pdf,.docx,.txt"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  setPrdFile(file);
                  setPrdStatus("idle");
                  setPrdStatusMessage("");
                }}
              />
              {prdFile ? (
                <div className="flex items-center justify-center gap-3">
                  <FileText className="w-8 h-8 text-primary-600 shrink-0" />
                  <div className="text-left">
                    <p className="text-sm font-bold text-surface-900 truncate max-w-xs">{prdFile.name}</p>
                    <p className="text-xs text-surface-500">{(prdFile.size / 1024).toFixed(1)} KB — click to change</p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPrdFile(null);
                      setPrdStatus("idle");
                      const input = document.getElementById("prd-file-input") as HTMLInputElement;
                      if (input) input.value = "";
                    }}
                    className="ml-2 p-1.5 rounded-lg hover:bg-red-50 text-surface-400 hover:text-red-500 transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 pointer-events-none">
                  <Upload className="w-8 h-8 text-surface-400" />
                  <p className="text-sm font-bold text-surface-700">Click to upload or drag & drop</p>
                  <p className="text-xs text-surface-500">Supports PDF, DOCX, TXT — max 10 MB</p>
                </div>
              )}
            </div>

            {/* Date, Timings, Department & Designation (Before Generate Button) */}
            <div className="p-4 rounded-xl bg-surface-50 border border-surface-200 space-y-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-surface-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-primary-600" />
                  OJT Schedule & Role Details
                </span>
                <span className="text-[11px] font-semibold text-surface-500">
                  AI will write logbook entries for every working day in this range
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                {/* OJT Start Date */}
                <div>
                  <label className="block text-xs font-bold text-surface-800 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={formatDateYYYYMMDD(profile.ojt_start_date || date)}
                    onChange={(e) => {
                      const val = e.target.value;
                      updateProfileField("ojt_start_date", val);
                      setDate(val);
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-surface-200 bg-white text-sm font-semibold text-surface-900 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400"
                  />
                </div>

                {/* OJT End Date */}
                <div>
                  <label className="block text-xs font-bold text-surface-800 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={formatDateYYYYMMDD(profile.ojt_end_date || date)}
                    onChange={(e) => {
                      const val = e.target.value;
                      updateProfileField("ojt_end_date", val);
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-surface-200 bg-white text-sm font-semibold text-surface-900 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400"
                  />
                </div>

                {/* Start Time */}
                <div>
                  <TimePicker
                    label="Start Time (AM/PM)"
                    value={startTime}
                    onChange={(val) => {
                      setStartTime(val);
                      syncCurrentToDays("startTime", val);
                    }}
                  />
                </div>

                {/* End Time */}
                <div>
                  <TimePicker
                    label="End Time (AM/PM)"
                    value={endTime}
                    onChange={(val) => {
                      setEndTime(val);
                      syncCurrentToDays("endTime", val);
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Department */}
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-bold text-surface-800 mb-1">
                    <Building2 className="w-3.5 h-3.5 text-primary-500" />
                    Department
                  </label>
                  <input
                    type="text"
                    value={department || profile.department || ""}
                    onChange={(e) => handleDepartmentChange(e.target.value)}
                    placeholder="e.g. Software Engineering"
                    className="w-full px-3 py-2 rounded-xl border border-surface-200 bg-white text-sm font-semibold text-surface-900 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 placeholder:text-surface-400"
                  />
                </div>

                {/* Designation */}
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-bold text-surface-800 mb-1">
                    <Briefcase className="w-3.5 h-3.5 text-primary-500" />
                    Designation
                  </label>
                  <input
                    type="text"
                    value={designation || profile.designation || ""}
                    onChange={(e) => handleDesignationChange(e.target.value)}
                    placeholder="e.g. Software Development Intern"
                    className="w-full px-3 py-2 rounded-xl border border-surface-200 bg-white text-sm font-semibold text-surface-900 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 placeholder:text-surface-400"
                  />
                </div>
              </div>
            </div>

            {/* Generate Button + Status (BELOW Date & Designation Part) */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleGenerateFromPRD}
                disabled={prdGenerating || !prdFile}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-primary-600 text-white font-bold text-sm hover:from-violet-700 hover:to-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-violet-600/20 cursor-pointer transition-all"
              >
                {prdGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {prdStatus === "reading" ? "Reading File..." : "AI is Writing Entries..."}
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Generate All Working Days with AI
                  </>
                )}
              </button>

              {prdStatus !== "idle" && (
                <div
                  className="flex items-center gap-2 text-sm font-semibold animate-fade-in"
                  style={{
                    color:
                      prdStatus === "success"
                        ? "var(--color-success)"
                        : prdStatus === "error"
                          ? "var(--color-danger)"
                          : "var(--color-primary-600)",
                  }}
                >
                  {(prdStatus === "reading" || prdStatus === "generating") && <Loader2 className="w-4 h-4 animate-spin" />}
                  {prdStatus === "success" && <CheckCircle className="w-4 h-4" />}
                  {prdStatus === "error" && <AlertTriangle className="w-4 h-4" />}
                  {prdStatusMessage}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Tab 2: Paste OJT Content (SECOND) ── */}
        {inputTab === "paste" && (
          <div className="p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-surface-900 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary-600" />
                  Paste Your OJT Content (Single Day or Multiple Days)
                </h2>
                <p className="text-xs text-surface-800/60 mt-1">
                  Supports notes for multiple days (e.g. <em>"Day 1: ... Day 2: ... Day 3: ..."</em>). The system will split and organize every day into the official logbook.
                </p>
              </div>
              <button
                onClick={() => {
                  const next = !manualMode;
                  setManualMode(next);
                  if (next) {
                    setFilled(true);
                    setShowPreview(true);
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-surface-800/60 hover:text-surface-800 hover:bg-surface-100 border border-surface-200 cursor-pointer"
              >
                <PenLine className="w-3.5 h-3.5" />
                {manualMode ? "Use Auto Fill" : "Fill Manually"}
              </button>
            </div>

            {!manualMode && (
              <>
                <textarea
                  value={originalText}
                  onChange={(e) => handleTextChange(e.target.value)}
                  rows={8}
                  placeholder={`Paste your daily or multi-day OJT notes here...\n\nExample:\nDay 1 (2026-09-01)\nTiming: 9:00 AM to 5:00 PM\nTasks: Configured development environment, attended orientation\nLearnings: Learned Git workflows and company codebase architecture\n\nDay 2 (2026-09-02)\nTiming: 9:00 AM to 5:00 PM\nTasks: Fixed UI alignment bug in user profile, wrote tests`}
                  className="w-full px-4 py-3 rounded-xl border border-surface-200 bg-surface-50 text-sm leading-relaxed focus:bg-white focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-400/20 placeholder:text-surface-800/30 resize-y font-mono"
                />

                {/* Date, Timings, Department & Designation (Exact same layout as PRD upload) */}
                <div className="p-4 rounded-xl bg-surface-50 border border-surface-200 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-surface-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-primary-600" />
                      OJT Schedule & Role Details
                    </span>
                    <span className="text-[11px] font-semibold text-surface-500">
                      Applied to your processed entries
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    {/* OJT Start Date */}
                    <div>
                      <label className="block text-xs font-bold text-surface-800 mb-1">
                        Start Date
                      </label>
                      <input
                        type="date"
                        value={formatDateYYYYMMDD(profile.ojt_start_date || date)}
                        onChange={(e) => {
                          const val = e.target.value;
                          updateProfileField("ojt_start_date", val);
                          setDate(val);
                        }}
                        className="w-full px-3 py-2 rounded-xl border border-surface-200 bg-white text-sm font-semibold text-surface-900 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400"
                      />
                    </div>

                    {/* OJT End Date */}
                    <div>
                      <label className="block text-xs font-bold text-surface-800 mb-1">
                        End Date
                      </label>
                      <input
                        type="date"
                        value={formatDateYYYYMMDD(profile.ojt_end_date || date)}
                        onChange={(e) => {
                          const val = e.target.value;
                          updateProfileField("ojt_end_date", val);
                        }}
                        className="w-full px-3 py-2 rounded-xl border border-surface-200 bg-white text-sm font-semibold text-surface-900 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400"
                      />
                    </div>

                    {/* Start Time */}
                    <div>
                      <TimePicker
                        label="Start Time (AM/PM)"
                        value={startTime}
                        onChange={(val) => {
                          setStartTime(val);
                          syncCurrentToDays("startTime", val);
                        }}
                      />
                    </div>

                    {/* End Time */}
                    <div>
                      <TimePicker
                        label="End Time (AM/PM)"
                        value={endTime}
                        onChange={(val) => {
                          setEndTime(val);
                          syncCurrentToDays("endTime", val);
                        }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Department */}
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-bold text-surface-800 mb-1">
                        <Building2 className="w-3.5 h-3.5 text-primary-500" />
                        Department
                      </label>
                      <input
                        type="text"
                        value={department || profile.department || ""}
                        onChange={(e) => handleDepartmentChange(e.target.value)}
                        placeholder="e.g. Software Engineering"
                        className="w-full px-3 py-2 rounded-xl border border-surface-200 bg-white text-sm font-semibold text-surface-900 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 placeholder:text-surface-400"
                      />
                    </div>

                    {/* Designation */}
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-bold text-surface-800 mb-1">
                        <Briefcase className="w-3.5 h-3.5 text-primary-500" />
                        Designation
                      </label>
                      <input
                        type="text"
                        value={designation || profile.designation || ""}
                        onChange={(e) => handleDesignationChange(e.target.value)}
                        placeholder="e.g. Software Development Intern"
                        className="w-full px-3 py-2 rounded-xl border border-surface-200 bg-white text-sm font-semibold text-surface-900 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 placeholder:text-surface-400"
                      />
                    </div>
                  </div>
                </div>

                {/* Auto Fill Button (BELOW Date & Designation Part) */}
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <button
                    onClick={handleAutoFill}
                    disabled={loading || !originalText.trim()}
                    className="px-6 py-3 rounded-xl bg-gradient-to-r from-primary-600 to-primary-700 text-white font-bold text-sm hover:from-primary-700 hover:to-primary-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-primary-600/20 cursor-pointer transition-all"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Processing & Mapping Days...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Process & Auto-Fill Logbook
                      </>
                    )}
                  </button>

                  {status !== "idle" && (
                    <div
                      className="flex items-center gap-2 text-sm font-semibold animate-fade-in"
                      style={{
                        color:
                          status === "success"
                            ? "var(--color-success)"
                            : status === "warning"
                              ? "var(--color-warning)"
                              : status === "error"
                                ? "var(--color-danger)"
                                : "var(--color-primary-600)",
                      }}
                    >
                      {status === "analyzing" && <Loader2 className="w-4 h-4 animate-spin" />}
                      {status === "success" && <CheckCircle className="w-4 h-4" />}
                      {status === "warning" && <AlertTriangle className="w-4 h-4" />}
                      {status === "error" && <AlertTriangle className="w-4 h-4" />}
                      {statusMessage}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Validation Warnings */}
            {warnings.length > 0 && (
              <div className="mt-4 p-4 rounded-xl bg-amber-50 border border-amber-200 animate-fade-in">
                <div className="flex items-center gap-2 text-sm font-bold text-amber-800 mb-2">
                  <AlertTriangle className="w-4 h-4" />
                  Verification Warnings
                </div>
                <ul className="space-y-1">
                  {warnings.map((w, i) => (
                    <li key={i} className="text-xs text-amber-700">
                      • {w}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

      </div>



      {/* =========================================== */}
      {/* ACTION BAR */}
      {/* =========================================== */}
      {(filled || manualMode) && (
        <div className="flex flex-wrap items-center gap-3 bg-white rounded-2xl border border-surface-200 p-4 shadow-sm animate-fade-in">
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-surface-200 text-sm font-semibold text-surface-800 hover:bg-surface-100 cursor-pointer"
          >
            {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {showPreview ? "Hide Preview" : "Preview Official Logbook"}
          </button>

          {extractedDays.length > 1 ? (
            <button
              onClick={handleSaveAllDays}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:opacity-50 cursor-pointer shadow-md shadow-emerald-600/20"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save All {extractedDays.length} Days
            </button>
          ) : (
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-bold hover:bg-primary-700 disabled:opacity-50 cursor-pointer shadow-md shadow-primary-600/15"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? "Saving..." : "Save Entry"}
            </button>
          )}

          <button
            onClick={handleDownloadCompletePDF}
            disabled={downloadingFullPdf}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-primary-600 to-primary-700 text-white text-sm font-bold hover:from-primary-700 hover:to-primary-800 disabled:opacity-50 cursor-pointer shadow-md shadow-primary-600/20"
          >
            {downloadingFullPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {downloadingFullPdf ? "Preparing 90-Page Logbook..." : "Download Complete Logbook (90 Pages)"}
          </button>
        </div>
      )}

      {/* =========================================== */}
      {/* UNIFIED INTERACTIVE IN-PREVIEW LOGBOOK */}
      {/* =========================================== */}
      {showPreview && (
        <div className="animate-fade-in">
          <LogbookPreview
            dayNumber={dayNumber}
            date={date}
            startTime={startTime}
            endTime={endTime}
            department={department}
            designation={designation}
            mySpace={mySpace}
            tasksCarriedOut={tasksCarriedOut}
            keyLearningObservations={keyLearningObservations}
            toolsTechnologyUsed={toolsTechnologyUsed}
            specialAchievements={specialAchievements}
            totalHours={totalHours}
            editable={true}
            onFieldChange={handleFieldUpdate}
            onSave={extractedDays.length > 1 ? handleSaveAllDays : handleSave}
            isSaving={saving}
            allEntries={multiDayEntries}
            profile={profile}
            onProfileChange={(newProf) => setProfile(newProf)}
            onSelectDay={(dNum) => {
              const idx = extractedDays.findIndex((d) => d.dayNumber === dNum);
              if (idx !== -1) {
                setActiveDayIndex(idx);
                loadDayIntoForm(extractedDays[idx]);
              } else {
                setDayNumber(dNum);
              }
            }}
          />
        </div>
      )}
    </div>
  );
}

function joinFragments(fragments: string[]): string {
  if (!Array.isArray(fragments)) return "";
  return fragments
    .map((f) => {
      const trimmed = f.trim().replace(/\.{2,}\s*$/, "").replace(/…\s*$/, "").trim();
      if (trimmed && !/[.!?]$/.test(trimmed)) {
        return trimmed + ".";
      }
      return trimmed;
    })
    .filter(Boolean)
    .join("\n");
}
