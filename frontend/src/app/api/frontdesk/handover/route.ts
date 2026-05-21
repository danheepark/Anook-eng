import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { sessionOptions, SessionData } from "@/lib/session";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8080";

export async function GET(request: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

    if (!session.isLoggedIn || session.role !== "FRONTDESK") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");
    const shiftType = searchParams.get("shiftType");

    if (!date || !shiftType) {
      return NextResponse.json({ message: "Missing required parameters" }, { status: 400 });
    }

    const response = await fetch(`${BACKEND_URL}/frontdesk/handover?date=${date}&shiftType=${shiftType}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.token}`,
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { message: "Failed to fetch handover briefing from backend" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Handover API Error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
