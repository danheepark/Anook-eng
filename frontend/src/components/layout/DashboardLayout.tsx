'use client';

import React, { useEffect, Suspense } from 'react';
import Header from './Header';
import Sidebar, { SidebarProps } from './Sidebar';
import GlobalEmergencyListener from './GlobalEmergencyListener';
import { useUiStore } from '@/stores/useUiStore';
import styles from './DashboardLayout.module.css';
import CreateRequestModal from '@/app/frontdesk/requests/_components/CreateRequestModal/CreateRequestModal';

interface DashboardLayoutProps {
  children: React.ReactNode;
  role?: SidebarProps['role'];
}

export default function DashboardLayout({ children, role = 'frontdesk' }: DashboardLayoutProps) {
  const { isSidebarOpen, toggleSidebar, activeModal, closeModal, isSidebarCollapsed } = useUiStore();

  return (
    <div className={styles.layout}>
      <GlobalEmergencyListener />
      {isSidebarOpen && (
        <div className={styles.backdrop} onClick={toggleSidebar} />
      )}
      <div className={`${styles.sidebarWrapper} ${isSidebarOpen ? styles.open : ''} ${isSidebarCollapsed ? styles.collapsed : ''}`}>
        <Suspense fallback={<div className={styles.sidebar} />}>
          <Sidebar className={styles.sidebar} role={role} />
        </Suspense>
      </div>
      
      <div className={styles.contentWrapper}>
        <Header className={styles.header} role={role} />
        <main className={styles.main}>
          {children}
        </main>
      </div>

      {/* 전역 요청 생성 모달 — 모든 frontdesk 페이지에서 헤더 버튼으로 접근 가능 */}
      {role === 'frontdesk' && (
        <CreateRequestModal
          isOpen={activeModal === 'createRequest'}
          onClose={closeModal}
        />
      )}
    </div>
  );
}
