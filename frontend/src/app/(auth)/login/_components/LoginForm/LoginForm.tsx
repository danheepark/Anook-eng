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
      showToast('Session ended due to login detected on another device.', 'error');
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
        subtitle="AI-Powered Hotel Management System"
        icon={<SecurityIcon width={32} height={32} />}
        inputLabel="Access PIN"
        placeholder="Enter PIN or Access Code"
        buttonText="Log In"
        onLogin={handleLogin}
        isLoading={isLoading}
        error={error || ''}
        maxLength={20}
        footerContent={
          <>
            <p>© 2026 Team Anook. All rights reserved.</p>
            <p>Admin Support: 02-1234-5678</p>
          </>
        }
      />
    </div>
  );
}
