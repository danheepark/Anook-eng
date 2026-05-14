'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { Menu } from 'lucide-react';
import { useUiStore } from '@/stores/useUiStore';
import styles from './Header.module.css';
import HeaderNotification from './HeaderNotification/HeaderNotification';
import Button from '@/components/ui/Button/Button';

interface HeaderProps {
  className?: string;
  role?: string;
}

export default function Header({ className = '', role = 'admin' }: HeaderProps) {
  const { toggleSidebar, openModal } = useUiStore();

  return (
    <header className={`${styles.header} ${className}`.trim()}>
      <div className={styles.left}>
        <button className={styles.hamburgerBtn} onClick={toggleSidebar} aria-label="메뉴 열기">
          <Menu size={24} />
        </button>
      </div>

      <div className={styles.right} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-16)' }}>
        {role === 'admin' && (
          <>
            <Button variant="primary" onClick={() => openModal('createRequest')} style={{ padding: '6px 12px', fontSize: '13px' }}>
              + 요청 생성
            </Button>
            <Suspense fallback={<div style={{ width: 24, height: 24 }}></div>}>
              <HeaderNotification />
            </Suspense>
          </>
        )}
        <LanguageToggle />
      </div>
    </header>
  );
}

function LanguageToggle() {
  const { language, setLanguage } = useUiStore();

  return (
    <div style={{ 
      display: 'inline-flex', 
      alignItems: 'center', 
      background: 'var(--color-gray-100, #f3f4f6)',
      borderRadius: '20px',
      padding: '2px',
      border: '1px solid var(--color-gray-200, #e5e7eb)'
    }}>
      <button
        onClick={() => setLanguage('ko')}
        style={{
          background: language === 'ko' ? 'var(--color-gray-500)' : 'transparent',
          color: language === 'ko' ? '#ffffff' : 'var(--color-gray-500)',
          border: 'none',
          padding: '4px 12px',
          borderRadius: '18px',
          cursor: 'pointer',
          fontWeight: language === 'ko' ? 600 : 500,
          fontSize: '0.875rem',
          transition: 'all 0.2s ease-in-out'
        }}
      >
        KO
      </button>
      <button
        onClick={() => setLanguage('en')}
        style={{
          background: language === 'en' ? 'var(--color-gray-500)' : 'transparent',
          color: language === 'en' ? '#ffffff' : 'var(--color-gray-500)',
          border: 'none',
          padding: '4px 12px',
          borderRadius: '18px',
          cursor: 'pointer',
          fontWeight: language === 'en' ? 600 : 500,
          fontSize: '0.875rem',
          transition: 'all 0.2s ease-in-out'
        }}
      >
        EN
      </button>
    </div>
  );
}
