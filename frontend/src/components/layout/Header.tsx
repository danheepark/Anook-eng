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

export default function Header({ className = '', role = 'frontdesk' }: HeaderProps) {
  const { toggleSidebar, openModal } = useUiStore();

  return (
    <header className={`${styles.header} ${className}`.trim()}>
      <div className={styles.left}>
        <button className={styles.hamburgerBtn} onClick={toggleSidebar} aria-label="메뉴 열기">
          <Menu size={24} />
        </button>
      </div>

      <div className={styles.right} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-16)' }}>
        {role === 'frontdesk' && (
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
  const [isOpen, setIsOpen] = React.useState(false);
  const wrapperRef = React.useRef<HTMLDivElement>(null);

  const options = [
    { value: 'ko', label: 'KO' },
    { value: 'en', label: 'EN' },
    { value: 'zh', label: 'ZH' },
    { value: 'ja', label: 'JA' },
  ];

  const currentLabel = options.find((o) => o.value === language)?.label || 'KO';

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          background: 'var(--color-gray-100, #f3f4f6)',
          color: 'var(--color-gray-700)',
          border: '1px solid var(--color-gray-200, #e5e7eb)',
          padding: '4px 12px',
          borderRadius: '18px',
          cursor: 'pointer',
          fontWeight: 600,
          fontSize: '0.875rem',
          transition: 'all 0.2s ease-in-out',
          height: '32px'
        }}
      >
        {currentLabel}
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease-in-out'
          }}
        >
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: '4px',
            background: 'white',
            border: '1px solid var(--color-gray-200, #e5e7eb)',
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            overflow: 'hidden',
            zIndex: 50,
            width: '80px',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                setLanguage(opt.value as 'ko' | 'en' | 'zh' | 'ja');
                setIsOpen(false);
              }}
              style={{
                padding: '8px 12px',
                background: language === opt.value ? 'var(--color-gray-100)' : 'transparent',
                border: 'none',
                textAlign: 'left',
                cursor: 'pointer',
                fontSize: '0.875rem',
                color: 'var(--color-gray-700)',
                fontWeight: language === opt.value ? 600 : 400,
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
