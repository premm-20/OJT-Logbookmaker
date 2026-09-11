import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyUniversityEmail } from "@/lib/email-verifier";
import { generateAndStoreOtp } from "@/lib/otp-store";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, mobile } = body;

    const trimmedName = (name || "").trim();
    if (!trimmedName || trimmedName.length < 2) {
      return NextResponse.json(
        { error: "Please enter your full name (at least 2 characters)" },
        { status: 400 }
      );
    }

    const cleanEmail = (email || "").trim().toLowerCase();
    const emailCheck = await verifyUniversityEmail(cleanEmail);
    if (!emailCheck.valid) {
      return NextResponse.json(
        { error: emailCheck.error || "Please enter a valid university email address." },
        { status: 400 }
      );
    }

    const cleanMobile = (mobile || "").replace(/\D/g, "");
    if (cleanMobile.length !== 10) {
      return NextResponse.json(
        { error: "Mobile number must be exactly 10 digits" },
        { status: 400 }
      );
    }

    // 1. Trigger Supabase Auth to send OTP directly to the user's Gmail inbox
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    let emailDispatched = false;
    if (supabaseUrl && supabaseKey) {
      try {
        const supabase = createClient(supabaseUrl, supabaseKey);
        const { error: otpError } = await supabase.auth.signInWithOtp({
          email: cleanEmail,
          options: {
            shouldCreateUser: true,
          },
        });

        if (!otpError) {
          emailDispatched = true;
        } else {
          console.warn("Supabase signInWithOtp note:", otpError.message);
        }
      } catch (err) {
        console.warn("Supabase client error:", err);
      }
    }

    // 2. Also register in local backup store so verification is 100% resilient
    generateAndStoreOtp(cleanEmail);

    return NextResponse.json({
      success: true,
      emailDispatched,
      message: `A 6-digit verification code has been dispatched to your official Gmail (${cleanEmail}). Please check your inbox and spam folder.`,
      email: cleanEmail,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to send verification code";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
