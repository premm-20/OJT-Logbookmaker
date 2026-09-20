import { NextResponse } from "next/server";
import { isUserRegistered, getRegisteredUser, recordUserLogin } from "@/lib/login-tracker";
import { verifyUniversityEmail } from "@/lib/email-verifier";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, credential, name: passedName } = body;

    let cleanEmail = (email || "").trim().toLowerCase();
    let detectedName = (passedName || "").trim();

    // If Google GIS JWT credential token was passed, decode payload
    if (credential && typeof credential === "string") {
      try {
        const parts = credential.split(".");
        if (parts.length === 3) {
          const payloadJson = Buffer.from(parts[1], "base64").toString("utf8");
          const payload = JSON.parse(payloadJson);
          if (payload.email) {
            cleanEmail = payload.email.trim().toLowerCase();
          }
          if (payload.name && !detectedName) {
            detectedName = payload.name;
          }
        }
      } catch (err) {
        console.warn("Could not decode Google credential JWT:", err);
      }
    }

    if (!cleanEmail) {
      return NextResponse.json(
        { error: "Please provide a valid university email address." },
        { status: 400 }
      );
    }

    // Strict domain check: only university emails allowed
    const emailCheck = await verifyUniversityEmail(cleanEmail);
    if (!emailCheck.valid) {
      return NextResponse.json(
        {
          error:
            "Access Restricted: Only official university Google accounts (@medhaviskillsuniversity.edu.in) can sign in to this logbook.",
        },
        { status: 403 }
      );
    }

    // Check if user has already registered on this platform
    const registered = await isUserRegistered(cleanEmail);

    if (!registered) {
      return NextResponse.json({
        success: false,
        registered: false,
        error: "not_registered",
        email: cleanEmail,
        name: detectedName,
        message:
          "This university account has not been registered on this portal yet. Please complete the quick one-time registration below to verify your details.",
      });
    }

    // User is already registered! Log them in directly
    const registeredUser = await getRegisteredUser(cleanEmail);
    const finalName = detectedName || registeredUser?.name || "Student";
    const finalMobile = registeredUser?.mobile || "0000000000";

    const session = await recordUserLogin({
      name: finalName,
      email: cleanEmail,
      mobile: finalMobile,
      ipAddress: request.headers.get("x-forwarded-for") || "127.0.0.1",
      userAgent: request.headers.get("user-agent") || "Google Sign-In",
    });

    return NextResponse.json({
      success: true,
      registered: true,
      user: {
        id: session.userId,
        name: finalName,
        email: cleanEmail,
        mobile: finalMobile,
      },
      message: `Welcome back, ${finalName}! Logged in with Google.`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Google authentication failed.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
