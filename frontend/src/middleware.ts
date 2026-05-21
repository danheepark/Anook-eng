import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions, SessionData } from "@/lib/session";

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';

/**
 * Next.js Middleware
 * 특정 경로에 대한 접근 권한을 서버 사이드에서 사전에 검사합니다.
 */
export async function middleware(request: NextRequest) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  const { pathname } = request.nextUrl;

  // 1. 이미 로그인한 사용자가 로그인 페이지에 접근할 때
  if (pathname === "/login") {
    if (session.isLoggedIn) {
      let redirectUrl = "/staff";
      if (session.role === "FRONTDESK") redirectUrl = "/frontdesk/requests";
      if (session.role === "GUEST") redirectUrl = "/guest/chat";

      return NextResponse.redirect(new URL(redirectUrl, request.url));
    }
    return NextResponse.next();
  }

  // 2. 보호된 경로 정의
  const isProtectedPath =
    pathname.startsWith("/frontdesk") ||
    pathname.startsWith("/staff") ||
    pathname.startsWith("/guest");

  // 3. 비로그인 상태로 보호된 경로 접근 시
  if (isProtectedPath && !session.isLoggedIn) {
    const hasDuplicateLoginError = request.cookies.get('duplicate_login_error');
    if (hasDuplicateLoginError) {
      const response = NextResponse.redirect(new URL("/login?error=DUPLICATE_LOGIN", request.url));
      response.cookies.delete('duplicate_login_error');
      return response;
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // 4. 로그인 상태일 때 세션 유효성 서버 사이드 검증 (중복 로그인 즉시 감지)
  if (isProtectedPath && session.isLoggedIn && session.token) {
    const verifyPath = session.role === 'GUEST' ? '/auth/guest/verify' : '/auth/staff/verify';

    try {
      const verifyRes = await fetch(`${BACKEND_URL}${verifyPath}`, {
        headers: { 'Authorization': `Bearer ${session.token}` },
        cache: 'no-store',
      });

      if (verifyRes.status === 401) {
        const errorData = await verifyRes.json().catch(() => ({}));
        if (errorData.code === 'DUPLICATE_LOGIN') {
          const response = NextResponse.redirect(new URL("/login?error=DUPLICATE_LOGIN", request.url));
          // 쿠키 삭제 (이름 변경 고려하여 둘 다 정리)
          response.cookies.delete(sessionOptions.cookieName);
          response.cookies.delete('aneuk_session');
          return response;
        }
      }
    } catch {
      // 백엔드 연결 실패 시에는 서비스 가용성을 위해 통과시킴
    }
  }

  // 5. 권한별 세부 통제
  if (pathname.startsWith("/frontdesk") && session.role !== "FRONTDESK") {
    return NextResponse.redirect(new URL("/staff", request.url));
  }

  if (pathname.startsWith("/staff") && (session.role !== "STAFF" && session.role !== "FRONTDESK")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (pathname.startsWith("/guest") && session.role !== "GUEST") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/login",
    "/frontdesk/:path*",
    "/staff/:path*",
    "/guest/:path*",
  ],
};
