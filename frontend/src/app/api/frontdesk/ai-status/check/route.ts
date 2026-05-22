import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { sessionOptions, SessionData } from "@/lib/session";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8080";

export async function POST() {
  try {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

    if (!session.isLoggedIn || session.role !== "FRONTDESK") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const response = await fetch(`${BACKEND_URL}/frontdesk/ai-status/check`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.token}`,
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { message: "Failed to check AI status" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("AI Status Check API Error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
