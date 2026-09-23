import { NextResponse } from "next/server";

/**
 * Next.js API route to dispatch transactional emails via Resend.
 * Called by backend services or directly with RESEND_API_KEY.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { to, subject, title, message, link } = body;

    if (!to || !subject || !message) {
      return NextResponse.json(
        { error: "Missing required fields: to, subject, message" },
        { status: 400 }
      );
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.log(`[Email Simulation Log] To: ${to} | Subject: ${subject} | Message: ${message}`);
      return NextResponse.json({
        success: true,
        simulated: true,
        note: "RESEND_API_KEY not configured. Set RESEND_API_KEY in environment variables to deliver live transactional emails.",
      });
    }

    const targetUrl = link
      ? link.startsWith("http")
        ? link
        : `https://chess-game-beta-mocha.vercel.app${link}`
      : "";

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Castle Chess <onboarding@resend.dev>",
        to,
        subject,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 28px; background: #0f172a; color: #f8fafc; border-radius: 16px; border: 1px solid #334155;">
            <h2 style="color: #10b981; margin-top: 0; font-size: 20px;">${title || subject}</h2>
            <p style="font-size: 15px; line-height: 1.6; color: #cbd5e1; margin-bottom: 24px;">${message}</p>
            ${targetUrl ? `<a href="${targetUrl}" style="display: inline-block; background: #10b981; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; font-size: 14px;">View Details</a>` : ""}
            <hr style="border: 0; border-top: 1px solid #334155; margin: 28px 0;" />
            <p style="font-size: 12px; color: #64748b; margin: 0;">Castle 3D Chess Platform · Fair play, instant Ethiopian escrow</p>
          </div>
        `,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      console.error("[Resend API Error]", data);
      return NextResponse.json({ error: data }, { status: res.status });
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error("[Email API Handler Error]", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
