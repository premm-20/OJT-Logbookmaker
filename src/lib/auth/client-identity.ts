/**
 * The dashboard pages read the student's identity from localStorage. The
 * server session is the source of truth; these helpers keep localStorage in
 * step with it and stop one student's cached data showing for another.
 */

export interface ClientUser {
  id: string;
  name: string;
  email: string;
  mobile: string;
  avatarUrl: string | null;
}

// Keys that are not scoped by user id and must not survive an account switch.
const UNSCOPED_KEYS = ["ojt_user_profile", "ojt_saved_entries", "ojt_session"];
const IDENTITY_KEYS = ["ojt_user_id", "ojt_user_name", "ojt_user_mobile", "ojt_user_login_email"];

export function syncClientIdentity(user: ClientUser): void {
  try {
    const previousId = localStorage.getItem("ojt_user_id");
    if (previousId && previousId !== user.id) {
      UNSCOPED_KEYS.forEach((key) => localStorage.removeItem(key));
    }

    localStorage.setItem("ojt_user_id", user.id);
    // Keep a name the student edited on their profile page.
    if (previousId !== user.id || !localStorage.getItem("ojt_user_name")) {
      localStorage.setItem("ojt_user_name", user.name);
    }
    localStorage.setItem("ojt_user_mobile", user.mobile);
    localStorage.setItem("ojt_user_login_email", user.email);

    const scopedKey = `ojt_user_profile_${user.id}`;
    const stored = localStorage.getItem(scopedKey) || localStorage.getItem("ojt_user_profile");
    const profile = stored ? JSON.parse(stored) : {};
    const merged = {
      ...profile,
      learner_name: profile.learner_name || user.name,
      phone_number: profile.phone_number || user.mobile,
      email_id: user.email,
    };
    const serialized = JSON.stringify(merged);
    localStorage.setItem(scopedKey, serialized);
    localStorage.setItem("ojt_user_profile", serialized);
  } catch {
    // Storage can be unavailable (private mode). The server session still works.
  }
}

export function clearClientIdentity(): void {
  try {
    [...IDENTITY_KEYS, ...UNSCOPED_KEYS].forEach((key) => localStorage.removeItem(key));
  } catch {
    // ignore
  }
}
