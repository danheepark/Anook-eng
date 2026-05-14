'use client';

import React, { useEffect, Suspense } from 'react';
import Header from './Header';
import Sidebar, { SidebarProps } from './Sidebar';
import GlobalEmergencyListener from './GlobalEmergencyListener';
import { useUiStore } from '@/stores/useUiStore';
import styles from './DashboardLayout.module.css';

interface DashboardLayoutProps {
  children: React.ReactNode;
  role?: SidebarProps['role'];
}

export default function DashboardLayout({ children, role = 'admin' }: DashboardLayoutProps) {
  const { isSidebarOpen, toggleSidebar } = useUiStore();

  return (
    <div className={styles.layout}>
      <GlobalEmergencyListener />
      {isSidebarOpen && (
        <div className={styles.backdrop} onClick={toggleSidebar} />
      )}
      <div className={`${styles.sidebarWrapper} ${isSidebarOpen ? styles.open : ''}`}>
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
    </div>
  );
}
