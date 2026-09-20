import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) {
      return NextResponse.json(
        { enabled: false, message: "Supabase URL is not configured." },
        { status: 500 }
      );
    }

    const host = request.headers.get("host") || "localhost:3000";
    const protocol = host.includes("localhost") ? "http" : "https";
    const redirectTo = `${protocol}://${host}/auth/callback`;

    const authorizeUrl = `${supabaseUrl}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectTo)}&hd=medhaviskillsuniversity.edu.in&prompt=select_account`;

    // Pre-flight check to see if Google provider is enabled in Supabase
    const checkRes = await fetch(authorizeUrl, {
      method: "GET",
      redirect: "manual",
    });

    if (checkRes.status >= 300 && checkRes.status < 400) {
      const googleLocation = checkRes.headers.get("location");
      return NextResponse.json({
        enabled: true,
        url: googleLocation || authorizeUrl,
      });
    }

    // Provider not enabled or invalid
    const errorBody = await checkRes.json().catch(() => ({}));
    return NextResponse.json({
      enabled: false,
      error: errorBody?.msg || "Google provider is not enabled in Supabase Auth yet.",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to verify Google provider.";
    return NextResponse.json({ enabled: false, error: msg }, { status: 500 });
  }
}
