import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions, SessionData } from "@/lib/session";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8080";

export const dynamic = 'force-dynamic';

/**
 * BFF Proxy for Staff Domain
 * staff 도메인 전용 API 핸들러입니다.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

    if (!session.isLoggedIn || !session.token) {
      return NextResponse.json({ message: "인증되지 않은 사용자입니다." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");
    const departmentId = searchParams.get("departmentId");

    if (action === "requests") {
      let role = session.role;
      let staffId: number | null = null;
      if (session.token) {
        try {
          const payloadBase64 = session.token.split('.')[1];
          const decodedJson = Buffer.from(payloadBase64, 'base64').toString();
          const parsed = JSON.parse(decodedJson);
          if (!role) role = parsed.role;
          staffId = Number(parsed.sub);
        } catch (e) {
          console.error("Token decode error:", e);
        }
      }

      const view = searchParams.get("view");
      // FRONTDESK은 전체 부서를 조회해야 하므로, 명시적 파라미터만 사용
      // STAFF는 자기 부서만 봐야 하므로 session.departmentId로 fallback
      const targetDeptId = role === "FRONTDESK"
        ? departmentId
        : (departmentId || session.departmentId);

      const backendEndpoint = role === "FRONTDESK"
        ? (targetDeptId ? `${BACKEND_URL}/frontdesk/requests?dept=${targetDeptId}` : `${BACKEND_URL}/frontdesk/requests`)
        : (targetDeptId ? `${BACKEND_URL}/staff/requests?departmentId=${targetDeptId}` : `${BACKEND_URL}/staff/requests`);

      const response = await fetch(backendEndpoint, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.token}`,
        },
        cache: "no-store",
      });

      if (response.status === 401 || response.status === 403) {
        session.destroy();
        return NextResponse.json(
          { message: "세션이 만료되었거나 권한이 없습니다. 다시 로그인해주세요." },
          { status: 401 }
        );
      }

      if (!response.ok) {
        return NextResponse.json(
          { message: "백엔드 서버에서 데이터를 가져오지 못했습니다." },
          { status: response.status }
        );
      }

      const data = await response.json();
      
      if (role === "FRONTDESK") {
        const mappedData = data.map((item: any) => ({
          id: item.id,
          status: item.status,
          priority: item.priority,
          departmentId: item.departmentId,
          summary: item.summary,
          rawText: item.rawText || '',
          roomNumber: item.roomNo,
          assignedStaffName: item.assignedStaffName,
          confidence: item.confidence ?? null,
          createdAt: item.createdAt,
          version: item.version,
          cancelRequested: item.cancelRequested ?? false,
          cancelRequestedAt: item.cancelRequestedAt ?? null,
          entities: item.entities ?? null,
          imageUrl: item.imageUrl ?? null,
          reasoning: item.reasoning ?? null,
        }));
        return NextResponse.json(mappedData);
      }

      let finalData = data;
      if (role !== "FRONTDESK" && view === "my" && staffId) {
        finalData = finalData.filter((item: any) => {
          return item.status === "PENDING" || item.status === "ESCALATED" || item.assignedStaffId === staffId;
        });
      }

      return NextResponse.json(finalData);
    }

    return NextResponse.json({ message: "잘못된 요청입니다." }, { status: 400 });

  } catch (error) {
    console.error("Staff API error:", error);
    return NextResponse.json(
      { message: "서버 내부 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

    if (!session.isLoggedIn || !session.token) {
      return NextResponse.json({ message: "인증되지 않은 사용자입니다." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ message: "요청 ID가 누락되었습니다." }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));

    if (action === "accept" || action === "complete" || action === "transfer" || action === "approveCancellation" || action === "rejectCancellation") {
      let staffId = null;
      try {
        const payloadBase64 = session.token.split('.')[1];
        const decodedJson = Buffer.from(payloadBase64, 'base64').toString();
        staffId = JSON.parse(decodedJson).sub;
      } catch (e) {
        console.error("Token decode error:", e);
        return NextResponse.json({ message: "토큰 해독에 실패했습니다." }, { status: 401 });
      }

      let backendActionPath = action;
      if (action === "approveCancellation") backendActionPath = "cancellation/approve";
      if (action === "rejectCancellation") backendActionPath = "cancellation/reject";

      const backendEndpoint = `${BACKEND_URL}/staff/requests/${id}/${backendActionPath}`;
      
      const payload: any = { staffId: Number(staffId) };
      if (body.version !== undefined) payload.version = body.version;
      if (action === "transfer") {
        if (!body.toDepartmentId || !body.reason) {
          return NextResponse.json({ message: "부서 전달 파라미터가 누락되었습니다." }, { status: 400 });
        }
        payload.toDepartmentId = body.toDepartmentId;
        payload.reason = body.reason;
      }

      const response = await fetch(backendEndpoint, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.token}`,
        },
        body: JSON.stringify(payload),
        cache: "no-store",
      });

      if (response.status === 401 || response.status === 403) {
        session.destroy();
        return NextResponse.json(
          { message: "세션이 만료되었거나 권한이 없습니다. 다시 로그인해주세요." },
          { status: 401 }
        );
      }

      if (!response.ok) {
        const errText = await response.text();
        return NextResponse.json(
          { message: errText || "상태 변경에 실패했습니다." },
          { status: response.status }
        );
      }

      return NextResponse.json({ message: "상태 변경 성공" });
    }

    return NextResponse.json({ message: "잘못된 액션입니다." }, { status: 400 });

  } catch (error) {
    console.error("Staff API PATCH error:", error);
    return NextResponse.json(
      { message: "서버 내부 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}


