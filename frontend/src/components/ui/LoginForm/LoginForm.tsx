'use client';

import React, { useState } from 'react';
import Button from '../Button/Button';
import InputField from '../Inputfield/InputField';
import Logo from '../Logo';
import styles from './LoginForm.module.css';

export interface LoginFormProps {
  /** 폼 상단 타이틀 (예: Anook) */
  title?: string;
  /** 타이틀 하단 서브텍스트 */
  subtitle?: string;
  /** 상단에 표시될 아이콘 */
  icon?: React.ReactNode;
  /** 입력창 라벨 */
  inputLabel?: string;
  /** 입력창 플레이스홀더 */
  placeholder?: string;
  /** 최대 입력 길이 */
  maxLength?: number;
  /** 로그인 시도 콜백 */
  onLogin: (pin: string) => void;
  /** 로딩 상태 */
  isLoading?: boolean;
  /** 에러 메시지 */
  error?: string;
  /** 하단 카피라이트 등 추가 푸터 내용 */
  footerContent?: React.ReactNode;
}

/**
 * [공통 UI 컴포넌트] LoginForm
 * 프리미엄 다크 모드 스타일이 적용된 범용 로그인 폼입니다.
 */
export default function LoginForm({
  title = 'Anook',
  subtitle = 'Management System',
  icon,
  inputLabel = '접속 PIN 번호',
  placeholder = 'PIN 번호를 입력하세요',
  maxLength = 6,
  onLogin,
  isLoading = false,
  error,
  footerContent
}: LoginFormProps) {
  const [pin, setPin] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin && !isLoading) {
      onLogin(pin);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        {icon && <div className={styles.iconWrapper}>{icon}</div>}
        {title.toUpperCase() === 'ANOOK' ? (
          <div style={{ marginBottom: '4px' }}><Logo /></div>
        ) : (
          <h1 className={styles.title}>{title}</h1>
        )}
        <p className={styles.subtitle}>{subtitle}</p>
      </div>

      <form className={styles.form} onSubmit={handleSubmit}>
        <InputField
          label={inputLabel}
          type="password"
          placeholder={placeholder}
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          maxLength={maxLength}
          autoFocus
          className={styles.customInput}
          error={error}
        />

        <Button 
          type="submit" 
          variant="primary" 
          size="large"
          fullWidth 
          disabled={isLoading || !pin}
          className={styles.submitBtn}
        >
          {isLoading ? '인증 중...' : '로그인'}
        </Button>
      </form>

      {footerContent && (
        <div className={styles.footer}>
          {footerContent}
        </div>
      )}
    </div>
  );
}
