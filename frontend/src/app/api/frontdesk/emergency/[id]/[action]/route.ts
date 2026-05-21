import { NextRequest, NextResponse } from 'next/server';
import { handleResponse } from '@/lib/api';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions, SessionData } from '@/lib/session';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string, action: string }> }) {
  try {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

    if (!session.isLoggedIn || session.role !== "FRONTDESK") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const resolvedParams = await params;
    const { id, action } = resolvedParams;
    
    let url = '';
    if (action === 'start') {
      url = `${BACKEND_URL}/frontdesk/emergency/${id}/start`;
    } else if (action === 'call-engineer') {
      url = `${BACKEND_URL}/frontdesk/emergency/${id}/call-engineer`;
    } else if (action === 'complete') {
      url = `${BACKEND_URL}/frontdesk/emergency/${id}/complete`;
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.token}`,
      },
    });

    const data = await handleResponse(res);
    return NextResponse.json(data);
  } catch (error) {
    const resolvedParams = await params;
    console.error(`BFF /api/frontdesk/emergency/${resolvedParams.id}/${resolvedParams.action} POST Error:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
