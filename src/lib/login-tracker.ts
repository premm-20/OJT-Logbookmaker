import fs from "fs";
import path from "path";
import { getDb } from "@/lib/db";

export interface LoginSession {
  id: string;
  userId: string;
  name: string;
  email: string;
  mobile: string;
  loginAt: string; // ISO string
  ipAddress: string;
  userAgent: string;
  device: string;
  browser: string;
  status: "Active" | "Success";
}

export interface UserSummary {
  userId: string;
  name: string;
  email: string;
  mobile: string;
  firstLogin: string;
  lastLogin: string;
  totalLogins: number;
  lastIp: string;
  lastDevice: string;
}

const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "user_logins.json");

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2), "utf8");
  }
}

function parseUserAgent(ua: string): { device: string; browser: string } {
  if (!ua) return { device: "Unknown Device", browser: "Unknown Browser" };

  let browser = "Web Browser";
  if (ua.includes("Firefox/")) browser = "Firefox";
  else if (ua.includes("Edg/")) browser = "Microsoft Edge";
  else if (ua.includes("Chrome/")) browser = "Chrome";
  else if (ua.includes("Safari/")) browser = "Safari";
  else if (ua.includes("Opera/") || ua.includes("OPR/")) browser = "Opera";

  let device = "Desktop (PC)";
  if (/android/i.test(ua)) device = "Android Mobile";
  else if (/iphone|ipad|ipod/i.test(ua)) device = "Apple iOS";
  else if (/macintosh|mac os x/i.test(ua)) device = "Apple macOS";
  else if (/windows/i.test(ua)) device = "Windows PC";
  else if (/linux/i.test(ua)) device = "Linux PC";

  return { device, browser };
}

export async function recordUserLogin(params: {
  name: string;
  email: string;
  mobile: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<LoginSession> {
  const cleanMobile = (params.mobile || "").replace(/\D/g, "");
  const userId = `usr_${cleanMobile || Date.now()}`;
  const ua = params.userAgent || "";
  const { device, browser } = parseUserAgent(ua);
  const now = new Date().toISOString();

  const session: LoginSession = {
    id: `sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    userId,
    name: params.name.trim(),
    email: params.email.trim().toLowerCase(),
    mobile: cleanMobile,
    loginAt: now,
    ipAddress: params.ipAddress || "127.0.0.1",
    userAgent: ua,
    device,
    browser,
    status: "Success",
  };

  // 1. Write to reliable local file store
  try {
    ensureDataFile();
    const content = fs.readFileSync(DATA_FILE, "utf8");
    const sessions: LoginSession[] = JSON.parse(content || "[]");
    sessions.unshift(session);
    // Keep last 1000 login records
    if (sessions.length > 1000) {
      sessions.length = 1000;
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(sessions, null, 2), "utf8");
  } catch (err) {
    console.error("Failed to write to local login store:", err);
  }

  // 2. Write to Neon PostgreSQL database
  try {
    const sql = getDb();
    await sql`
      INSERT INTO user_logins (
        id, user_id, name, email, mobile, login_at, ip_address, user_agent, device, browser, status
      ) VALUES (
        ${session.id}, ${session.userId}, ${session.name}, ${session.email},
        ${session.mobile}, ${session.loginAt}, ${session.ipAddress},
        ${session.userAgent}, ${session.device}, ${session.browser}, ${session.status}
      )
      ON CONFLICT (id) DO NOTHING;
    `;
  } catch (err) {
    // Non-blocking fallback
    console.warn("Neon user_logins insert note:", err);
  }

  return session;
}

export async function getAllUserLogins(): Promise<{
  sessions: LoginSession[];
  users: UserSummary[];
}> {
  let sessions: LoginSession[] = [];

  // Try local file first (fast and guaranteed)
  try {
    ensureDataFile();
    const content = fs.readFileSync(DATA_FILE, "utf8");
    sessions = JSON.parse(content || "[]");
  } catch (err) {
    console.warn("Could not read local login sessions:", err);
  }

  // Also query Neon PostgreSQL
  try {
    const sql = getDb();
    const rows = await sql`
      SELECT id, user_id, name, email, mobile, login_at, ip_address, user_agent, device, browser, status
      FROM user_logins
      ORDER BY login_at DESC
      LIMIT 500;
    `;

    if (rows && rows.length > 0) {
      const remoteSessions: LoginSession[] = rows.map((d: any) => ({
        id: d.id,
        userId: d.user_id,
        name: d.name,
        email: d.email,
        mobile: d.mobile,
        loginAt: d.login_at instanceof Date ? d.login_at.toISOString() : String(d.login_at),
        ipAddress: d.ip_address || "127.0.0.1",
        userAgent: d.user_agent || "",
        device: d.device || "Unknown Device",
        browser: d.browser || "Unknown Browser",
        status: (d.status || "Success") as "Active" | "Success",
      }));

      // Merge by session ID
      const existingIds = new Set(sessions.map((s) => s.id));
      for (const rs of remoteSessions) {
        if (!existingIds.has(rs.id)) {
          sessions.push(rs);
        }
      }
      sessions.sort(
        (a, b) => new Date(b.loginAt).getTime() - new Date(a.loginAt).getTime()
      );
    }
  } catch (err) {
    console.warn("Neon user_logins query note:", err);
  }

  // Aggregate user summaries
  const userMap = new Map<string, UserSummary>();
  for (const sess of sessions) {
    const key = sess.email || sess.userId;
    if (!userMap.has(key)) {
      userMap.set(key, {
        userId: sess.userId,
        name: sess.name,
        email: sess.email,
        mobile: sess.mobile,
        firstLogin: sess.loginAt,
        lastLogin: sess.loginAt,
        totalLogins: 1,
        lastIp: sess.ipAddress,
        lastDevice: `${sess.device} • ${sess.browser}`,
      });
    } else {
      const existing = userMap.get(key)!;
      existing.totalLogins += 1;
      if (new Date(sess.loginAt) < new Date(existing.firstLogin)) {
        existing.firstLogin = sess.loginAt;
      }
      if (new Date(sess.loginAt) > new Date(existing.lastLogin)) {
        existing.lastLogin = sess.loginAt;
        existing.lastIp = sess.ipAddress;
        existing.lastDevice = `${sess.device} • ${sess.browser}`;
      }
    }
  }

  const users = Array.from(userMap.values()).sort(
    (a, b) => new Date(b.lastLogin).getTime() - new Date(a.lastLogin).getTime()
  );

  return { sessions, users };
}

export async function getRegisteredUser(email: string): Promise<UserSummary | null> {
  const cleanEmail = (email || "").trim().toLowerCase();
  if (!cleanEmail) return null;

  const { users } = await getAllUserLogins();
  const match = users.find((u) => u.email.toLowerCase() === cleanEmail);
  return match || null;
}

export async function isUserRegistered(email: string): Promise<boolean> {
  const user = await getRegisteredUser(email);
  return !!user;
}

