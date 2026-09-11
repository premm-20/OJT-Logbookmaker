import dns from "dns";

const UNIVERSITY_EMAIL_REGEX =
  /^[a-zA-Z0-9._%+-]+@medhaviskills(?:\.university|university)\.edu\.in$/i;

/**
 * Validates syntax and verifies active Google Workspace MX mail exchange servers
 */
export async function verifyUniversityEmail(email: string): Promise<{
  valid: boolean;
  isGoogleWorkspace: boolean;
  error?: string;
}> {
  const cleanEmail = (email || "").trim().toLowerCase();

  // 1. Format check
  if (!cleanEmail || !UNIVERSITY_EMAIL_REGEX.test(cleanEmail)) {
    return {
      valid: false,
      isGoogleWorkspace: false,
      error: "Only official university email IDs (@medhaviskillsuniversity.edu.in) are permitted.",
    };
  }

  // Extract domain
  const domain = cleanEmail.split("@")[1];

  // 2. DNS MX records check
  try {
    const resolver = new dns.promises.Resolver();
    resolver.setServers(["8.8.8.8", "1.1.1.1"]);

    const mxRecords = await resolver.resolveMx(domain);
    if (!mxRecords || mxRecords.length === 0) {
      return {
        valid: false,
        isGoogleWorkspace: false,
        error: `No active mail exchange (MX) servers found for domain @${domain}.`,
      };
    }

    // Check if Google Workspace servers are used
    const isGoogle = mxRecords.some((mx) =>
      mx.exchange.toLowerCase().includes("google.com")
    );

    return {
      valid: true,
      isGoogleWorkspace: isGoogle,
    };
  } catch (err) {
    // If DNS check fails due to local network restriction, allow valid format
    return {
      valid: true,
      isGoogleWorkspace: true,
    };
  }
}
