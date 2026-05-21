"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";

export const useLoginForm = () => {
  const [pin, setPin] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  /**
   * 실제 로그인 처리 핵심 로직
   */
  const performLogin = useCallback(async (code: string) => {
    setIsLoading(true);
    setError(null);

    // 1단계: 직원 로그인 시도 (6자리 숫자일 경우 우선 시도)
    if (/^\d{6}$/.test(code)) {
      try {
        const staffResponse = await fetch("/api/auth/staff", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pin: code }),
        });

        if (staffResponse.ok) {
          const data = await staffResponse.json();
          if (data.role === "FRONTDESK") {
            router.push("/frontdesk/requests");
          } else {
            router.push("/staff");
          }
          setIsLoading(false);
          return; // 직원 로그인 성공 시 종료
        }
      } catch {
        console.log("Staff auth failed, trying guest auth...");
      }
    }

    // 2단계: 게스트 로그인 시도 (직원 로그인이 아니거나 실패한 경우)
    try {
      const guestResponse = await fetch("/api/auth/guest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessCode: code }),
      });

      const data = await guestResponse.json();

      if (!guestResponse.ok) throw new Error(data.message || "인증에 실패했습니다.");

      // 게스트 리다이렉트
      if (data.role === "GUEST") {
        router.push("/guest/chat");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin) {
      setError("PIN 번호 또는 접속 코드를 입력해주세요.");
      return;
    }
    await performLogin(pin);
  };

  return { pin, setPin, isLoading, error, handleLogin, performLogin };
};
