"use client";

import { useEffect, useState, useMemo } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  Users,
  LogOut,
  Calendar,
  Clock,
  Search,
  Download,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Building2,
  Lock,
  UserCheck,
  Eye,
  EyeOff,
  KeyRound,
} from "lucide-react";
import type { AdminStudentProfile } from "@/app/api/admin/profiles/route";
import AdminStudentProfiles, { PrdLinks, studentProfilesToCsv } from "@/components/admin-student-profiles";
import type { AdminGuest } from "@/app/api/admin/guests/route";

export default function AdminPage() {
  // Authentication states
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [adminId, setAdminId] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  // Data states
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [students, setStudents] = useState<AdminStudentProfile[]>([]);
  const [guests, setGuests] = useState<AdminGuest[]>([]);

  const [searchQuery, setSearchQuery] = useState("");

  // Only the latest sign-in is stored per student, so the figures come from
  // the student list itself.
  const stats = useMemo(() => {
    const today = new Date().toDateString();
    const latest = students
      .filter((s) => s.lastLoginAt)
      .sort((a, b) => new Date(b.lastLoginAt!).getTime() - new Date(a.lastLoginAt!).getTime())[0];
    return {
      totalUsers: students.length,
      withProfile: students.filter((s) => s.profile).length,
      todayLogins: students.filter((s) => s.lastLoginAt && new Date(s.lastLoginAt).toDateString() === today).length,
      latestName: latest ? latest.name || latest.email : null,
      lastLoginAt: latest?.lastLoginAt ?? null,
    };
  }, [students]);

  // Fetch admin audit data
  async function fetchData(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const [res, prdRes] = await Promise.all([fetch("/api/admin/profiles"), fetch("/api/admin/guests")]);

      if (res.status === 401) {
        setIsAuthenticated(false);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load students.");
      }

      setIsAuthenticated(true);
      setStudents(data.students || []);
      if (prdRes.ok) setGuests((await prdRes.json()).guests || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error connecting to server.";
      setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  // Check auth on load
  useEffect(() => {
    fetchData();
  }, []);

  // Handle Admin Login submission
  async function handleAdminLogin(e: React.FormEvent) {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: adminId,
          password: adminPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Invalid Admin credentials.");
      }

      setIsAuthenticated(true);
      setAdminPassword("");
      fetchData();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to authenticate administrator.";
      setAuthError(msg);
    } finally {
      setAuthLoading(false);
    }
  }

  // Handle Admin Logout
  async function handleAdminLogout() {
    try {
      await fetch("/api/admin/logout", { method: "POST" });
    } catch {}
    setIsAuthenticated(false);
    setStudents([]);
  }

  // Filtered lists based on search
  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return students;
    const q = searchQuery.toLowerCase().trim();
    return students.filter((st) =>
      [
        st.name,
        st.email,
        st.mobile,
        st.profile?.learnerName,
        st.profile?.registrationNumber,
        st.profile?.programName,
        st.profile?.industryPartner,
        st.profile?.supervisorName,
      ].some((v) => (v || "").toLowerCase().includes(q))
    );
  }, [students, searchQuery]);

  const filteredGuests = useMemo(() => {
    if (!searchQuery.trim()) return guests;
    const q = searchQuery.toLowerCase().trim();
    return guests.filter((g) =>
      [g.name, g.email, g.details.registration_number, g.details.program_name, g.details.industry_partner_name, g.prd?.fileName].some((v) =>
        (v || "").toLowerCase().includes(q)
      )
    );
  }, [guests, searchQuery]);

  // Export the active tab to CSV
  function handleExportCSV() {
    if (filteredStudents.length === 0) return;
    const blob = new Blob([studentProfilesToCsv(filteredStudents)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `student_profiles_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function formatDateTime(iso: string | null | undefined) {
    if (!iso) return "N/A";
    try {
      const d = new Date(iso);
      return d.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });
    } catch {
      return iso;
    }
  }

  // 1. Initial Checking Screen
  if (isAuthenticated === null && loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center">
        <div className="w-12 h-12 rounded-2xl bg-surface-900 border border-surface-800 flex items-center justify-center animate-pulse mb-4">
          <Lock className="w-6 h-6 text-primary-400" />
        </div>
        <p className="text-sm font-semibold text-surface-600">Verifying administrator credentials...</p>
      </div>
    );
  }

  // 2. Administrator Login Screen (When not authenticated)
  if (!isAuthenticated) {
    return (
      <div className="min-h-[75vh] flex items-center justify-center px-4 py-8 animate-fade-in">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-surface-200/80 p-8 sm:p-9 relative overflow-hidden">
          {/* Subtle glow */}
          <div className="absolute -top-20 -right-20 w-44 h-44 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -left-20 w-44 h-44 bg-primary-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Header */}
          <div className="text-center mb-7">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-surface-900 via-surface-800 to-surface-950 flex items-center justify-center mx-auto mb-3.5 shadow-xl text-primary-400 border border-surface-700">
              <ShieldAlert className="w-7 h-7 text-rose-500" />
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 text-rose-700 text-[11px] font-bold uppercase tracking-wider mb-2 border border-rose-200">
              <Lock className="w-3 h-3" />
              <span>Restricted Access</span>
            </div>
            <h2 className="text-2xl font-black text-surface-900 tracking-tight">Admin Gate</h2>
            <p className="text-xs text-surface-500 mt-1">
              Authorized administrator verification required
            </p>
          </div>

          {/* Auth Error alert */}
          {authError && (
            <div className="mb-5 p-3.5 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs font-semibold text-red-700 animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleAdminLogin} className="space-y-4.5">
            {/* Admin ID */}
            <div>
              <label className="block text-xs font-bold text-surface-800 uppercase tracking-wider mb-1.5">
                Admin ID
              </label>
              <div className="relative">
                <UserCheck className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                <input
                  type="text"
                  value={adminId}
                  onChange={(e) => {
                    setAdminId(e.target.value);
                    if (authError) setAuthError(null);
                  }}
                  placeholder="Enter Admin ID"
                  required
                  autoFocus
                  autoComplete="username"
                  className="w-full pl-10.5 pr-4 py-3 rounded-2xl border border-surface-200 bg-surface-50/70 text-sm font-semibold text-surface-900 focus:bg-white focus:border-primary-500 focus:outline-none focus:ring-3 focus:ring-primary-500/15 transition-all"
                />
              </div>
            </div>

            {/* Admin Password */}
            <div>
              <label className="block text-xs font-bold text-surface-800 uppercase tracking-wider mb-1.5">
                Admin Password
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={adminPassword}
                  onChange={(e) => {
                    setAdminPassword(e.target.value);
                    if (authError) setAuthError(null);
                  }}
                  placeholder="Enter password"
                  required
                  autoComplete="current-password"
                  className="w-full pl-10.5 pr-11 py-3 rounded-2xl border border-surface-200 bg-surface-50/70 text-sm font-semibold text-surface-900 focus:bg-white focus:border-primary-500 focus:outline-none focus:ring-3 focus:ring-primary-500/15 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600 cursor-pointer p-1"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Unlock Button */}
            <button
              type="submit"
              disabled={authLoading || !adminId.trim() || !adminPassword.trim()}
              className="w-full mt-2 py-3.5 rounded-2xl bg-gradient-to-r from-surface-900 via-surface-800 to-surface-950 text-white font-bold text-sm hover:from-black hover:to-surface-900 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-xl shadow-surface-900/20 transition-all cursor-pointer border border-surface-700"
            >
              {authLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Verifying Credentials...</span>
                </div>
              ) : (
                <>
                  <Lock className="w-4 h-4 text-emerald-400" />
                  <span>Unlock Admin Panel</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-surface-200/80 text-center">
            <p className="text-[11px] text-surface-400">
              Only authorized university administrators are permitted beyond this checkpoint.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 3. Full Admin Panel Dashboard (Authenticated)
  return (
    <div className="space-y-6 animate-fade-in pb-12 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="bg-gradient-to-r from-surface-900 via-primary-950 to-surface-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-primary-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-primary-200 text-xs font-semibold backdrop-blur-md mb-3 border border-white/10">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Admin Monitoring & Audit Portal (Authenticated: Guru)</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              User Login & Access Intelligence
            </h1>
            <p className="text-surface-300 text-xs sm:text-sm mt-1 flex items-center gap-2">
              <span>Restricted to</span>
              <span className="font-semibold text-white bg-white/10 px-2 py-0.5 rounded-md border border-white/10 inline-flex items-center gap-1">
                <Building2 className="w-3 h-3 text-primary-300" />
                @medhaviskillsuniversity.edu.in
              </span>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => fetchData(true)}
              disabled={refreshing || loading}
              className="px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold flex items-center gap-2 transition-all border border-white/10 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
              <span>{refreshing ? "Refreshing..." : "Refresh"}</span>
            </button>
            <button
              onClick={handleExportCSV}
              disabled={filteredStudents.length === 0}
              className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-primary-500/25 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={handleAdminLogout}
              className="px-4 py-2.5 rounded-2xl bg-rose-600/80 hover:bg-rose-600 text-white text-xs font-bold flex items-center gap-2 transition-all cursor-pointer border border-rose-500/40"
              title="Sign out of Admin Panel"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>

      {/* Error alert if any */}
      {error && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 flex items-center gap-3 text-red-700 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Registered Users */}
        <div className="bg-white rounded-2xl p-5 border border-surface-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-surface-500 uppercase tracking-wider">
              Total Users
            </span>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-black text-surface-900">
            {loading ? "..." : stats.totalUsers}
          </div>
          <p className="text-xs text-surface-500 mt-1 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span>Verified University Accounts</span>
          </p>
        </div>

        {/* Total Login Sessions */}
        <div className="bg-white rounded-2xl p-5 border border-surface-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-surface-500 uppercase tracking-wider">
              Profiles Filled
            </span>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <UserCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-black text-surface-900">
            {loading ? "..." : stats.withProfile}
          </div>
          <p className="text-xs text-surface-500 mt-1 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span>Students with a saved profile</span>
          </p>
        </div>

        {/* Logins Today */}
        <div className="bg-white rounded-2xl p-5 border border-surface-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-surface-500 uppercase tracking-wider">
              Signed In Today
            </span>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-black text-surface-900">
            {loading ? "..." : stats.todayLogins}
          </div>
          <p className="text-xs text-surface-500 mt-1 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-amber-500" />
            <span>Last sign-in was today</span>
          </p>
        </div>

        {/* Last Login Activity */}
        <div className="bg-white rounded-2xl p-5 border border-surface-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-surface-500 uppercase tracking-wider">
              Latest Sign-In
            </span>
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="text-sm font-bold text-surface-900 truncate">
            {loading
              ? "..."
              : stats.latestName || "No sign-ins yet"}
          </div>
          <p className="text-xs text-surface-500 mt-1 truncate">
            {loading ? "..." : formatDateTime(stats.lastLoginAt)}
          </p>
        </div>
      </div>

      {/* Control Tabs & Search */}
      <div className="bg-white rounded-3xl border border-surface-200 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-surface-200 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface-50/50">
          <h2 className="text-sm font-bold text-surface-900">Students ({filteredStudents.length})</h2>

          {/* Search Box */}
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search name, email, reg. no., program..."
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-surface-200 bg-white text-xs font-medium text-surface-900 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
            />
          </div>
        </div>

        {/* Tab 0: Student profiles (everything students saved) */}
        <AdminStudentProfiles students={filteredStudents} formatDateTime={formatDateTime} />

      </div>

      {/* Guests: used the no-login page with name + university email */}
      <div className="bg-white rounded-3xl border border-surface-200 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-surface-200 bg-surface-50/50">
          <h2 className="text-sm font-bold text-surface-900">Guest users ({filteredGuests.length})</h2>
          <p className="mt-0.5 text-xs text-surface-500">
            People who used the no-login page. Each keeps one PRD; everything is deleted 7 days after their last use.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-surface-200 bg-surface-50/60 text-[11px] font-bold uppercase tracking-wider text-surface-500">
                <th className="px-4 py-3">Guest</th>
                <th className="px-4 py-3">Registration no.</th>
                <th className="px-4 py-3">Program / partner</th>
                <th className="px-4 py-3">OJT period</th>
                <th className="px-4 py-3">PRD</th>
                <th className="px-4 py-3">Last active</th>
                <th className="px-4 py-3">Deleted on</th>
              </tr>
            </thead>
            <tbody className="text-xs text-surface-800">
              {filteredGuests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-surface-500">No guest users right now.</td>
                </tr>
              ) : (
                filteredGuests.map((g) => (
                  <tr key={g.email} className="border-b border-surface-100 align-top">
                    <td className="px-4 py-3.5">
                      <div className="font-bold text-surface-900">{g.name}</div>
                      <div className="font-mono text-[11px] text-primary-700">{g.email}</div>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-[11px]">{g.details.registration_number || "-"}</td>
                    <td className="px-4 py-3.5">
                      <div className="font-medium">{g.details.program_name || "-"}</div>
                      {g.details.industry_partner_name && <div className="text-[11px] text-surface-500">{g.details.industry_partner_name}</div>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-surface-600">
                      {g.details.ojt_start_date || g.details.ojt_end_date ? `${g.details.ojt_start_date || "?"} to ${g.details.ojt_end_date || "?"}` : "-"}
                    </td>
                    <td className="px-4 py-3.5">
                      {g.prd ? <PrdLinks id={g.prd.id} hasFile={g.prd.hasFile} label={g.prd.fileName} /> : <span className="text-surface-500">None</span>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-surface-600">{formatDateTime(g.lastActiveAt)}</td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-surface-600">{formatDateTime(g.expiresAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
