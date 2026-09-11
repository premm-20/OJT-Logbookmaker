"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RatingValue, SupervisorFeedback } from "@/lib/types";
import { RATING_CRITERIA, RATING_OPTIONS } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import {
  MessageSquare,
  Save,
  Loader2,
  CheckCircle,
  AlertCircle,
  PlusCircle,
  Trash2,
} from "lucide-react";

export default function FeedbackPage() {
  const supabase = createClient();
  const [feedbacks, setFeedbacks] = useState<SupervisorFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetchFeedbacks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchFeedbacks() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("supervisor_feedback")
      .select("*")
      .eq("user_id", user.id)
      .order("from_date", { ascending: false });

    if (data) setFeedbacks(data as SupervisorFeedback[]);
    setLoading(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this feedback?")) return;
    await supabase.from("supervisor_feedback").delete().eq("id", id);
    setFeedbacks((prev) => prev.filter((f) => f.id !== id));
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-primary-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-surface-900">Supervisor Feedback</h1>
            <p className="text-sm text-surface-800/50">Monthly performance assessments</p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-500 text-white text-sm font-medium hover:bg-primary-600 cursor-pointer shadow-md shadow-primary-500/15"
        >
          <PlusCircle className="w-4 h-4" />
          New Feedback
        </button>
      </div>

      {showForm && (
        <FeedbackForm
          onSaved={() => {
            setShowForm(false);
            fetchFeedbacks();
          }}
        />
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
        </div>
      ) : feedbacks.length === 0 && !showForm ? (
        <div className="text-center py-12 text-surface-800/50 text-sm">
          No supervisor feedback records yet.
        </div>
      ) : (
        <div className="space-y-4">
          {feedbacks.map((fb) => (
            <div key={fb.id} className="bg-white rounded-xl border border-surface-200 p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-sm font-semibold text-surface-900">
                    {formatDate(fb.from_date)} — {formatDate(fb.to_date)}
                  </p>
                  <p className="text-xs text-surface-800/50">{fb.student_name}</p>
                </div>
                <button
                  onClick={() => handleDelete(fb.id)}
                  className="p-1.5 rounded-lg text-surface-800/40 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                {RATING_CRITERIA.map((c) => {
                  const val = fb[c.key as keyof SupervisorFeedback] as string;
                  return (
                    <div key={c.key} className="flex items-center justify-between py-1 px-2 rounded bg-surface-50">
                      <span className="text-surface-800/70">{c.label}</span>
                      <span className={`font-medium ${
                        val === "good" ? "text-green-700" :
                        val === "acceptable" ? "text-amber-700" :
                        "text-red-700"
                      }`}>
                        {val ? val.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase()) : "—"}
                      </span>
                    </div>
                  );
                })}
              </div>

              {fb.remarks && (
                <div className="mt-3 p-3 rounded-lg bg-surface-50 text-sm text-surface-800/70">
                  <strong>Remarks:</strong> {fb.remarks}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Feedback Form Component
// ============================================================
function FeedbackForm({ onSaved }: { onSaved: () => void }) {
  const supabase = createClient();
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

  const [formData, setFormData] = useState({
    from_date: "",
    to_date: "",
    student_name: "",
    punctuality: "" as RatingValue,
    professional_appearance: "" as RatingValue,
    ability_to_communicate: "" as RatingValue,
    interest_shown_for_learning: "" as RatingValue,
    productivity_at_work: "" as RatingValue,
    error_free_work: "" as RatingValue,
    working_as_team: "" as RatingValue,
    initiative_and_commitment: "" as RatingValue,
    flexibility_and_adaptability: "" as RatingValue,
    adherence_to_safety_ethics: "" as RatingValue,
    remarks: "",
    supervisor_name: "",
    designation: "",
    signature_date: "",
  });

  function handleChange(field: string, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Calculate total score
    const ratingValues: Record<string, number> = { good: 3, acceptable: 2, needs_improvement: 1 };
    let total = 0;
    for (const c of RATING_CRITERIA) {
      const val = formData[c.key as keyof typeof formData] as string;
      total += ratingValues[val] || 0;
    }

    const { error } = await supabase.from("supervisor_feedback").insert({
      user_id: user.id,
      ...formData,
      total_score: total,
    });

    setSaving(false);
    if (error) {
      setStatus("error");
    } else {
      setStatus("success");
      onSaved();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-surface-200 p-6 shadow-sm space-y-4 animate-fade-in">
      <h3 className="text-base font-semibold text-surface-900">New Feedback</h3>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-medium text-surface-800 mb-1">From Date</label>
          <input type="date" value={formData.from_date} onChange={(e) => handleChange("from_date", e.target.value)} required
            className="w-full px-3 py-2 rounded-lg border border-surface-200 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-surface-800 mb-1">To Date</label>
          <input type="date" value={formData.to_date} onChange={(e) => handleChange("to_date", e.target.value)} required
            className="w-full px-3 py-2 rounded-lg border border-surface-200 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-surface-800 mb-1">Student Name</label>
          <input type="text" value={formData.student_name} onChange={(e) => handleChange("student_name", e.target.value)} required
            className="w-full px-3 py-2 rounded-lg border border-surface-200 text-sm" />
        </div>
      </div>

      {/* Rating criteria */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-surface-800">Performance Ratings</h4>
        {RATING_CRITERIA.map((criteria) => (
          <div key={criteria.key} className="flex items-center justify-between py-2 px-3 rounded-lg bg-surface-50">
            <span className="text-sm text-surface-800">{criteria.label}</span>
            <div className="flex gap-2">
              {RATING_OPTIONS.map((opt) => (
                <label key={opt.value} className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="radio"
                    name={criteria.key}
                    value={opt.value}
                    checked={formData[criteria.key as keyof typeof formData] === opt.value}
                    onChange={() => handleChange(criteria.key, opt.value)}
                    className="accent-primary-500"
                  />
                  <span className="text-xs text-surface-800/70">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Additional fields */}
      <div>
        <label className="block text-xs font-medium text-surface-800 mb-1">Supervisor&apos;s Remarks</label>
        <textarea value={formData.remarks} onChange={(e) => handleChange("remarks", e.target.value)} rows={3}
          className="w-full px-3 py-2 rounded-lg border border-surface-200 text-sm resize-y" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-medium text-surface-800 mb-1">Supervisor&apos;s Name</label>
          <input type="text" value={formData.supervisor_name} onChange={(e) => handleChange("supervisor_name", e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-surface-200 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-surface-800 mb-1">Designation</label>
          <input type="text" value={formData.designation} onChange={(e) => handleChange("designation", e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-surface-200 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-surface-800 mb-1">Date</label>
          <input type="date" value={formData.signature_date} onChange={(e) => handleChange("signature_date", e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-surface-200 text-sm" />
        </div>
      </div>

      {status !== "idle" && (
        <div className={`p-3 rounded-lg flex items-center gap-2 text-sm ${
          status === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
        }`}>
          {status === "success" ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {status === "success" ? "Feedback saved!" : "Failed to save feedback."}
        </div>
      )}

      <button type="submit" disabled={saving}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary-500 text-white text-sm font-medium hover:bg-primary-600 disabled:opacity-50 cursor-pointer shadow-md">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        {saving ? "Saving..." : "Save Feedback"}
      </button>
    </form>
  );
}
