'use client';

import React, { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUiStore } from '@/stores/useUiStore';
import { SecurityIcon } from '@/components/icons';
import { useLoginForm } from '../useLoginForm';
import CommonLoginForm from '@/components/ui/LoginForm/LoginForm';
import styles from '../../login.module.css';

/**
 * 서비스 로그인 페이지 컴포넌트
 * 공통 UI 컴포넌트인 LoginForm을 사용하여 구성되었습니다.
 */
export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { pin, setPin, isLoading, error, performLogin } = useLoginForm();
  const { showToast } = useUiStore();

  // URL 파라미터에서 에러 확인 (중복 로그인 등)
  useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam === 'DUPLICATE_LOGIN') {
      showToast('다른 기기에서 로그인이 감지되어 세션이 종료되었습니다.', 'error');
      router.replace('/login');
    }
  }, [searchParams, showToast, router]);

  const handleLogin = (code: string) => {
    performLogin(code);
  };

  return (
    <div className={styles.container}>
      <CommonLoginForm
        title="ANOOK"
        subtitle="AI 기반 호텔 통합 관리 시스템"
        icon={<SecurityIcon width={32} height={32} />}
        placeholder="PIN 번호 또는 접속 코드 입력"
        onLogin={handleLogin}
        isLoading={isLoading}
        error={error || ''}
        maxLength={20} // ★ 길이를 20자리로 확장
        footerContent={
          <>
            <p>© 2026 Team Anook. All rights reserved.</p>
            <p>관리자 문의: 02-1234-5678</p>
          </>
        }
      />
    </div>
  );
}
