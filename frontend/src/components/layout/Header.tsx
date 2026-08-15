'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, Plus } from 'lucide-react';
import { useUiStore } from '@/stores/useUiStore';
import styles from './Header.module.css';
import HeaderNotification from './HeaderNotification/HeaderNotification';
import StaffNotification from './StaffNotification/StaffNotification';
import { useTranslation } from '@/app/useTranslation';

interface HeaderProps {
  className?: string;
  role?: string;
}

export default function Header({ className = '', role = 'frontdesk' }: HeaderProps) {
  const { toggleSidebar, openModal } = useUiStore();
  const { t } = useTranslation();
  const pathname = usePathname();

  // Dynamic Page Title
  const getPageTitle = () => {
    if (pathname === '/frontdesk/requests') return t.frontdeskPage?.sidebar?.menus?.frontDesk || 'Live Chat';
    if (pathname === '/frontdesk/housekeeping') return t.frontdeskPage?.taskBoard?.titles?.housekeeping || 'Housekeeping';
    if (pathname === '/frontdesk/fb') return t.frontdeskPage?.taskBoard?.titles?.fb || 'F&B';
    if (pathname === '/frontdesk/facility') return t.frontdeskPage?.taskBoard?.titles?.facility || 'Facility';
    if (pathname === '/frontdesk/concierge') return t.frontdeskPage?.taskBoard?.titles?.concierge || 'Concierge';
    if (pathname === '/frontdesk/all-requests') return t.frontdeskPage?.taskBoard?.titles?.allRequests || 'All Requests';
    if (pathname === '/frontdesk/chat-history') return t.frontdeskPage?.sidebar?.menus?.chatHistory || 'Chat History';
    return null;
  };

  const title = getPageTitle();

  return (
    <header className={`${styles.header} ${className}`.trim()}>
      <div className={styles.left}>
        <button className={styles.hamburgerBtn} onClick={toggleSidebar} aria-label="메뉴 열기">
          <Menu size={24} />
        </button>
        {title && <h1 className={styles.pageTitle}>{title}</h1>}
      </div>

      <div className={styles.right}>
        {/* Slot for page-specific search bar or actions */}
        <div id="header-search-slot" className={styles.searchSlot} />

        {role === 'frontdesk' && (
          <>
            <button
              type="button"
              className={styles.headerIconBtn}
              onClick={() => openModal('createRequest')}
              aria-label={t.frontdeskPage?.frontDesk?.createRequest || '새 요청 등록'}
              title={t.frontdeskPage?.frontDesk?.createRequest || '새 요청 등록'}
            >
              <Plus size={18} />
            </button>
            <Suspense fallback={<div style={{ width: 36, height: 36 }}></div>}>
              <HeaderNotification />
            </Suspense>
          </>
        )}
        {role === 'staff' && (
          <Suspense fallback={<div style={{ width: 36, height: 36 }}></div>}>
            <StaffNotification />
          </Suspense>
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
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={styles.languageBtn}
        aria-label="언어 변경"
      >
        <span>{currentLabel}</span>
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
            top: 'calc(100% + 4px)',
            right: 0,
            background: 'white',
            border: '1px solid var(--color-gray-200, #e5e7eb)',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
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
