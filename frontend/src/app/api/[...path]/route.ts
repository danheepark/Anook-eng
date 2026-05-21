import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions, SessionData } from '@/lib/session';

/**
 * BFF Catch-all Proxy
 *
 * /api/* 요청을 백엔드(Spring Boot :8080)로 프록시합니다.
 * 프론트에서 /api/pms/guests → 백엔드 http://localhost:8080/pms/guests
 * 세션에 저장된 JWT를 Authorization 헤더로 전달합니다.
 */

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';
const AI_SERVER_URL = process.env.AI_SERVER_URL || 'http://localhost:8000';

async function handleProxy(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const targetPath = '/' + path.join('/');
  const url = new URL(req.url);
  const queryString = url.search;
  
  let backendUrl = `${BACKEND_URL}${targetPath}${queryString}`;
  if (targetPath === '/translate') {
    backendUrl = `${AI_SERVER_URL}${targetPath}${queryString}`;
  }

  // 세션에서 JWT 토큰 추출
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

  const headers: Record<string, string> = {};
  const contentType = req.headers.get('content-type');
  if (contentType) {
    headers['Content-Type'] = contentType;
  }

  // JWT가 있으면 Authorization 헤더로 전달
  if (session.token) {
    headers['Authorization'] = `Bearer ${session.token}`;
  }

  const fetchOptions: RequestInit = {
    method: req.method,
    headers,
    cache: 'no-store',
  };

  // Body 전달 (GET, HEAD 제외)
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    if (contentType && contentType.includes('multipart/form-data')) {
      // 프론트에서 FormData로 넘긴 것을 백엔드 호환 JSON으로 변환
      const formData = await req.formData();
      const content = formData.get('content') as string || '';
      const language = formData.get('language') as string || 'ko';

      const images: string[] = [];
      for (const [key, value] of formData.entries()) {
        if (key === 'images' && typeof value === 'string') {
          images.push(value);
        } else if (key === 'images' && value instanceof Blob) {
          // 파일 객체인 경우 (원칙적으로 프론트에서 Base64 변환 후 string으로 넘기길 권장)
          const arrayBuffer = await value.arrayBuffer();
          const base64 = Buffer.from(arrayBuffer).toString('base64');
          images.push(base64);
        }
      }

      const payload = { content, language, images: images.length > 0 ? images : undefined };
      fetchOptions.body = JSON.stringify(payload);
      headers['Content-Type'] = 'application/json';
    } else {
      const bodyText = await req.text();
      if (bodyText) {
        fetchOptions.body = bodyText;
      }
    }
  }

  try {
    const backendRes = await fetch(backendUrl, fetchOptions);

    // 204 No Content 등 body 없는 응답
    if (backendRes.status === 204) {
      return new NextResponse(null, { status: 204 });
    }

    const data = await backendRes.text();

    // 기본 응답 객체 생성
    const res = new NextResponse(data, {
      status: backendRes.status,
      headers: { 'Content-Type': backendRes.headers.get('content-type') || 'application/json' },
    });

    // ★ 중복 로그인(DUPLICATE_LOGIN) 감지 시 세션 파기 및 에러 마커 쿠키 설정
    if (backendRes.status === 401) {
      try {
        const errorData = JSON.parse(data);
        if (errorData.code === 'DUPLICATE_LOGIN') {
          // 1. 현재 세션 쿠키 삭제 (설정된 이름 및 이전 이름 모두 정리)
          res.cookies.delete(sessionOptions.cookieName);
          res.cookies.delete('aneuk_session'); // 과도기 대비 이전 이름 삭제 추가

          // 2. 미들웨어에서 인지할 수 있도록 임시 에러 마커 쿠키 설정 (10초 유효)
          res.cookies.set('duplicate_login_error', 'true', {
            maxAge: 10,
            path: '/', // 모든 경로에서 보이도록 명시
          });
        }
      } catch (e) {
        // 일반적인 401 혹은 JSON이 아닌 응답은 무시
      }
    }

    return res;
  } catch {
    return NextResponse.json(
      { message: '백엔드 서버에 연결할 수 없습니다.' },
      { status: 502 }
    );
  }
}

export const GET = handleProxy;
export const POST = handleProxy;
export const PUT = handleProxy;
export const PATCH = handleProxy;
export const DELETE = handleProxy;
