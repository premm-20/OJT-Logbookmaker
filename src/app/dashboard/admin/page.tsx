"use client";

import { useEffect, useState, useMemo } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  Users,
  LogIn,
  LogOut,
  Calendar,
  Clock,
  Search,
  Download,
  RefreshCw,
  Laptop,
  Smartphone,
  Globe,
  Mail,
  Phone,
  CheckCircle2,
  AlertCircle,
  Building2,
  Lock,
  UserCheck,
  Eye,
  EyeOff,
  KeyRound,
} from "lucide-react";
import { LoginSession, UserSummary } from "@/lib/login-tracker";

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
  const [sessions, setSessions] = useState<LoginSession[]>([]);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalLogins: 0,
    todayLogins: 0,
    lastLoginAt: null as string | null,
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"sessions" | "users">("sessions");

  // Fetch admin audit data
  async function fetchData(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/users");

      if (res.status === 401) {
        setIsAuthenticated(false);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to retrieve user logs.");
      }

      setIsAuthenticated(true);
      setSessions(data.sessions || []);
      setUsers(data.users || []);
      setStats(
        data.stats || {
          totalUsers: 0,
          totalLogins: 0,
          todayLogins: 0,
          lastLoginAt: null,
        }
      );
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
    setSessions([]);
    setUsers([]);
  }

  // Filtered lists based on search
  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions;
    const q = searchQuery.toLowerCase().trim();
    return sessions.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.mobile.includes(q) ||
        s.ipAddress.includes(q) ||
        s.device.toLowerCase().includes(q)
    );
  }, [sessions, searchQuery]);

  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;
    const q = searchQuery.toLowerCase().trim();
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.mobile.includes(q)
    );
  }, [users, searchQuery]);

  // Export login records to CSV
  function handleExportCSV() {
    if (sessions.length === 0) return;

    const headers = [
      "Session ID",
      "Student Name",
      "University Email",
      "Mobile Number",
      "Login Timestamp",
      "IP Address",
      "Device",
      "Browser",
      "Status",
    ];

    const rows = sessions.map((s) => [
      `"${s.id}"`,
      `"${s.name.replace(/"/g, '""')}"`,
      `"${s.email.replace(/"/g, '""')}"`,
      `"${s.mobile}"`,
      `"${formatDateTime(s.loginAt)}"`,
      `"${s.ipAddress}"`,
      `"${s.device}"`,
      `"${s.browser}"`,
      `"${s.status}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `user_login_audit_${new Date().toISOString().split("T")[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

  function getAvatarColor(name: string) {
    const colors = [
      "from-blue-500 to-indigo-600",
      "from-emerald-500 to-teal-600",
      "from-amber-500 to-orange-600",
      "from-purple-500 to-pink-600",
      "from-rose-500 to-red-600",
      "from-cyan-500 to-blue-600",
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash += name.charCodeAt(i);
    return colors[Math.abs(hash) % colors.length];
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
              disabled={sessions.length === 0}
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
              Total Logins
            </span>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <LogIn className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-black text-surface-900">
            {loading ? "..." : stats.totalLogins}
          </div>
          <p className="text-xs text-surface-500 mt-1 flex items-center gap-1">
            <Globe className="w-3.5 h-3.5 text-primary-500" />
            <span>All recorded sessions</span>
          </p>
        </div>

        {/* Logins Today */}
        <div className="bg-white rounded-2xl p-5 border border-surface-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-surface-500 uppercase tracking-wider">
              Logins Today
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
            <span>Active in last 24 hours</span>
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
              : sessions[0]?.name
              ? sessions[0].name
              : "No logins recorded"}
          </div>
          <p className="text-xs text-surface-500 mt-1 truncate">
            {loading ? "..." : formatDateTime(stats.lastLoginAt)}
          </p>
        </div>
      </div>

      {/* Control Tabs & Search */}
      <div className="bg-white rounded-3xl border border-surface-200 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-surface-200 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface-50/50">
          {/* Tabs */}
          <div className="flex items-center gap-2 bg-surface-200/70 p-1 rounded-2xl">
            <button
              onClick={() => setActiveTab("sessions")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "sessions"
                  ? "bg-white text-surface-900 shadow-sm"
                  : "text-surface-600 hover:text-surface-900"
              }`}
            >
              Login Activity Log ({filteredSessions.length})
            </button>
            <button
              onClick={() => setActiveTab("users")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "users"
                  ? "bg-white text-surface-900 shadow-sm"
                  : "text-surface-600 hover:text-surface-900"
              }`}
            >
              Users Directory ({filteredUsers.length})
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, email, mobile..."
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-surface-200 bg-white text-xs font-medium text-surface-900 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
            />
          </div>
        </div>

        {/* Tab 1: Login Activity Log */}
        {activeTab === "sessions" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-surface-200 bg-surface-50/60 text-[11px] font-bold text-surface-500 uppercase tracking-wider">
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">University Email</th>
                  <th className="py-3 px-4">Mobile</th>
                  <th className="py-3 px-4">Login Time</th>
                  <th className="py-3 px-4">Device & Browser</th>
                  <th className="py-3 px-4">IP Address</th>
                  <th className="py-3 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 text-xs">
                {filteredSessions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-surface-500">
                      <div className="max-w-sm mx-auto flex flex-col items-center">
                        <LogIn className="w-8 h-8 text-surface-300 mb-2" />
                        <p className="font-semibold text-surface-700">No login records found</p>
                        <p className="text-[11px] text-surface-400 mt-1">
                          {searchQuery
                            ? "Try matching another query or clear the search filter."
                            : "New student sign-ins with @medhaviskillsuniversity.edu.in will automatically be logged here."}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredSessions.map((s) => (
                    <tr
                      key={s.id}
                      className="hover:bg-surface-50/80 transition-colors group"
                    >
                      {/* Name with initials */}
                      <td className="py-3.5 px-4 font-semibold text-surface-900">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-7 h-7 rounded-lg bg-gradient-to-br ${getAvatarColor(
                              s.name
                            )} text-white flex items-center justify-center font-bold text-[11px] shrink-0 shadow-sm`}
                          >
                            {s.name.charAt(0).toUpperCase()}
                          </div>
                          <span>{s.name}</span>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="py-3.5 px-4 text-surface-600 font-mono text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <Mail className="w-3 h-3 text-surface-400 shrink-0" />
                          <span className="text-primary-700 font-medium">{s.email}</span>
                        </div>
                      </td>

                      {/* Mobile */}
                      <td className="py-3.5 px-4 text-surface-600 font-mono text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3 h-3 text-surface-400 shrink-0" />
                          <span>+91 {s.mobile}</span>
                        </div>
                      </td>

                      {/* Login Time */}
                      <td className="py-3.5 px-4 text-surface-700 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3 h-3 text-surface-400 shrink-0" />
                          <span>{formatDateTime(s.loginAt)}</span>
                        </div>
                      </td>

                      {/* Device & Browser */}
                      <td className="py-3.5 px-4 text-surface-600">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface-100 font-medium text-[11px] text-surface-700">
                            {s.device.toLowerCase().includes("mobile") ||
                            s.device.toLowerCase().includes("android") ||
                            s.device.toLowerCase().includes("ios") ? (
                              <Smartphone className="w-3 h-3 text-surface-500" />
                            ) : (
                              <Laptop className="w-3 h-3 text-surface-500" />
                            )}
                            {s.device}
                          </span>
                          <span className="text-[11px] text-surface-500">
                            {s.browser}
                          </span>
                        </div>
                      </td>

                      {/* IP */}
                      <td className="py-3.5 px-4 font-mono text-[11px] text-surface-500">
                        {s.ipAddress}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-right">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Success
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 2: Users Directory */}
        {activeTab === "users" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-surface-200 bg-surface-50/60 text-[11px] font-bold text-surface-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Learner Name</th>
                  <th className="py-3 px-4">University Email</th>
                  <th className="py-3 px-4">Mobile</th>
                  <th className="py-3 px-4">First Registered</th>
                  <th className="py-3 px-4">Last Active</th>
                  <th className="py-3 px-4">Total Logins</th>
                  <th className="py-3 px-4 text-right">Last Device</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 text-xs">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-surface-500">
                      <div className="max-w-sm mx-auto flex flex-col items-center">
                        <Users className="w-8 h-8 text-surface-300 mb-2" />
                        <p className="font-semibold text-surface-700">No users found</p>
                        <p className="text-[11px] text-surface-400 mt-1">
                          No unique students have signed in yet.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => (
                    <tr
                      key={`${u.userId}_${u.email}`}
                      className="hover:bg-surface-50/80 transition-colors group"
                    >
                      {/* Name */}
                      <td className="py-3.5 px-4 font-semibold text-surface-900">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-8 h-8 rounded-xl bg-gradient-to-br ${getAvatarColor(
                              u.name
                            )} text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm`}
                          >
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold">{u.name}</div>
                            <div className="text-[10px] text-surface-400 font-mono">
                              ID: {u.userId}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="py-3.5 px-4 font-mono text-[11px]">
                        <span className="text-primary-700 font-medium">{u.email}</span>
                      </td>

                      {/* Mobile */}
                      <td className="py-3.5 px-4 font-mono text-[11px] text-surface-600">
                        +91 {u.mobile}
                      </td>

                      {/* First Login */}
                      <td className="py-3.5 px-4 text-surface-600 whitespace-nowrap">
                        {formatDateTime(u.firstLogin)}
                      </td>

                      {/* Last Login */}
                      <td className="py-3.5 px-4 text-surface-900 font-medium whitespace-nowrap">
                        {formatDateTime(u.lastLogin)}
                      </td>

                      {/* Total Logins Badge */}
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-primary-50 text-primary-700 font-bold text-[11px] border border-primary-200">
                          {u.totalLogins} {u.totalLogins === 1 ? "login" : "logins"}
                        </span>
                      </td>

                      {/* Last Device */}
                      <td className="py-3.5 px-4 text-right text-surface-500 text-[11px]">
                        {u.lastDevice || "Desktop PC"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
