import { NextRequest } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, SessionData } from "@/lib/session";
import { cookies } from "next/headers";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8080";

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ channel: string[] }> }
) {
  try {
    const { channel } = await params;
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

    if (!session.isLoggedIn) {
      return new Response("Unauthorized", { status: 401 });
    }

    const channelPath = channel.join("/");
    const targetUrl = `${BACKEND_URL}/events/subscribe/${channelPath}`;

    // 프론트엔드 BFF에서 백엔드로 SSE 스트림을 프록시
    const headers: Record<string, string> = {
      Accept: "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    };

    if (session.token) {
      headers["Authorization"] = `Bearer ${session.token}`;
    }

    const backendResponse = await fetch(targetUrl, {
      method: "GET",
      headers,
    });

    if (!backendResponse.ok) {
      return new Response(backendResponse.statusText, { status: backendResponse.status });
    }

    // 백엔드의 SSE 스트림(ReadableStream)을 그대로 클라이언트 브라우저로 반환
    return new Response(backendResponse.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("SSE Proxy Error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
