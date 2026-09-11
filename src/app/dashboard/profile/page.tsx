"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ProfileFormData } from "@/lib/types";
import {
  User,
  Save,
  Loader2,
  CheckCircle,
  AlertCircle,
} from "lucide-react";

const INITIAL_PROFILE: ProfileFormData = {
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
};

export default function ProfilePage() {
  const supabase = createClient();
  const [profile, setProfile] = useState<ProfileFormData>(INITIAL_PROFILE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    fetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchProfile() {
    // 1. Check local storage first
    let localEmail = "";
    try {
      const storedLoginEmail = localStorage.getItem("ojt_user_login_email") || "";
      localEmail = storedLoginEmail;
      const storedName = localStorage.getItem("ojt_user_name") || "";
      const storedMobile = localStorage.getItem("ojt_user_mobile") || "";
      const localProf = localStorage.getItem("ojt_user_profile");
      if (localProf) {
        const parsed = JSON.parse(localProf);
        setProfile((prev) => ({
          ...prev,
          ...parsed,
          learner_name: parsed.learner_name || storedName || prev.learner_name,
          phone_number: parsed.phone_number || storedMobile || prev.phone_number,
          email_id: storedLoginEmail || parsed.email_id || prev.email_id,
        }));
      } else if (storedName || storedMobile || storedLoginEmail) {
        setProfile((prev) => ({
          ...prev,
          learner_name: storedName || prev.learner_name,
          phone_number: storedMobile || prev.phone_number,
          email_id: storedLoginEmail || prev.email_id,
        }));
      }
    } catch {}

    // 2. Fetch from Supabase if authenticated
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();

        if (data) {
          setProfile((prev) => ({
            ...prev,
            ...data,
            email_id: localEmail || data.email_id || prev.email_id,
          }));
        }
      }
    } catch {}

    setLoading(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setStatus("idle");

    // Always ensure login email is preserved
    const storedLoginEmail = localStorage.getItem("ojt_user_login_email") || profile.email_id;
    const finalProfile = { ...profile, email_id: storedLoginEmail };

    // Save to localStorage
    try {
      localStorage.setItem("ojt_user_profile", JSON.stringify(finalProfile));
      if (finalProfile.learner_name) {
        localStorage.setItem("ojt_user_name", finalProfile.learner_name);
      }
      if (finalProfile.phone_number) {
        localStorage.setItem("ojt_user_mobile", finalProfile.phone_number);
      }
    } catch {}

    // Save to Supabase if session exists
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("profiles").upsert(
          {
            id: user.id,
            ...finalProfile,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        );
      }
    } catch {}

    setSaving(false);
    setStatus("success");
    setStatusMessage("Profile saved successfully!");
    setTimeout(() => setStatus("idle"), 3000);
  }


  function handleChange(field: keyof ProfileFormData, value: string) {
    setProfile((prev) => ({ ...prev, [field]: value }));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
      </div>
    );
  }

  const fields: { key: keyof ProfileFormData; label: string; type?: string; placeholder?: string }[] = [
    { key: "learner_name", label: "Learner Name", placeholder: "Your full name" },
    { key: "registration_number", label: "Registration Number", placeholder: "e.g., REG-2026-001" },
    { key: "program_name", label: "Program Name", placeholder: "e.g., B.Tech Computer Science" },
    { key: "semester", label: "Semester", placeholder: "e.g., 6th Semester" },
    { key: "location", label: "Location", placeholder: "e.g., Bangalore, India" },
    { key: "industry_partner_name", label: "Industry Partner Name", placeholder: "Company name" },
    { key: "ojt_start_date", label: "OJT Start Date", type: "date" },
    { key: "ojt_end_date", label: "OJT End Date", type: "date" },
    { key: "department", label: "Department", placeholder: "e.g., Software Development" },
    { key: "designation", label: "Designation", placeholder: "e.g., Software Development Intern" },
    { key: "supervisor_name", label: "Supervisor Name", placeholder: "Supervisor's full name" },
    { key: "phone_number", label: "Phone Number", placeholder: "e.g., +91 9876543210" },
    { key: "email_id", label: "Email ID", placeholder: "e.g., student@university.edu" },
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center">
          <User className="w-5 h-5 text-primary-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-surface-900">Student Profile</h1>
          <p className="text-sm text-surface-800/50">
            This information appears on your OJT logbook cover page
          </p>
        </div>
      </div>

      <form onSubmit={handleSave}>
        <div className="bg-white rounded-2xl border border-surface-200 p-6 shadow-sm space-y-4">
          {fields.map((field) => (
            <div key={field.key}>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-surface-800">
                  {field.label}
                </label>
                {field.key === "email_id" && (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    Locked to Login Account
                  </span>
                )}
              </div>
              <input
                type={field.type || "text"}
                value={profile[field.key]}
                onChange={(e) => handleChange(field.key, e.target.value)}
                placeholder={field.placeholder}
                readOnly={field.key === "email_id"}
                className={`w-full px-3 py-2.5 rounded-xl border border-surface-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/20 placeholder:text-surface-800/30 ${
                  field.key === "email_id"
                    ? "bg-surface-100 text-surface-700 font-semibold cursor-not-allowed select-all"
                    : "bg-surface-50 focus:bg-white focus:border-primary-400"
                }`}
              />
              {field.key === "email_id" && (
                <p className="text-[11px] text-surface-500 mt-1">
                  Official university email is permanently bound to your authenticated login.
                </p>
              )}
            </div>
          ))}

        </div>

        {/* Status */}
        {status !== "idle" && (
          <div
            className={`mt-4 p-3 rounded-lg flex items-center gap-2 text-sm animate-fade-in ${
              status === "success"
                ? "bg-green-50 border border-green-200 text-green-700"
                : "bg-red-50 border border-red-200 text-red-700"
            }`}
          >
            {status === "success" ? (
              <CheckCircle className="w-4 h-4" />
            ) : (
              <AlertCircle className="w-4 h-4" />
            )}
            {statusMessage}
          </div>
        )}

        <div className="mt-4">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary-500 text-white text-sm font-medium hover:bg-primary-600 disabled:opacity-50 cursor-pointer shadow-md shadow-primary-500/15"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saving ? "Saving..." : "Save Profile"}
          </button>
        </div>
      </form>
    </div>
  );
}
