'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import styles from './Sidebar.module.css';
import { useTranslation } from '@/app/useTranslation';
import { useUiStore } from '@/stores/useUiStore';
import { useSSE } from '@/app/useSSE';
import { ChevronsLeft, ChevronsRight } from 'lucide-react';
import Logo from '@/components/ui/Logo';
import { DashboardIcon } from '@/components/icons';

import {
  LayoutDashboard,
  Inbox,

  Wrench,
  Home,
  Utensils,
  ConciergeBell,
  List,
  Database,
  Target,
  User,
  History,
  MessageSquare,
  Users,
  Monitor,
  Layers,
  FileSearch,
  FileText,
  LogOut,
  MessageCircle
} from 'lucide-react';

export interface SidebarProps {
  role?: 'frontdesk' | 'staff' | 'guest' | 'housekeeping' | 'facility' | 'fb' | 'concierge' | 'emergency';
  className?: string;
  fakePathname?: string;
  onMenuClick?: (e: React.MouseEvent, href: string) => void;
}

interface SidebarItemProps {
  icon: React.ElementType;
  label: string;
  href: string;
  isActive?: boolean;
  isDanger?: boolean;
  isCollapsed?: boolean;
  hasBadge?: boolean;
  onClick?: (e: React.MouseEvent, href: string) => void;
}

function SidebarItem({ icon: Icon, label, href, isActive = false, isDanger = false, isCollapsed = false, hasBadge = false, onClick }: SidebarItemProps) {
  let itemStyle = styles.default;
  if (isActive) {
    itemStyle = styles.selected;
  }
  if (isDanger) {
    itemStyle = styles.danger;
  }

  return (
    <Link
      href={href}
      className={`${styles.item} ${itemStyle} ${isCollapsed ? styles.itemCollapsed : ''}`}
      onClick={(e) => onClick && onClick(e, href)}
      onMouseEnter={(e) => {
        if (isCollapsed && typeof window !== 'undefined' && window.innerWidth > 768) {
          const rect = e.currentTarget.getBoundingClientRect();
          // window.dispatchEvent to notify Sidebar of hover
          window.dispatchEvent(new CustomEvent('sidebar-hover', { detail: { label, top: rect.top + rect.height / 2, left: rect.right + 8 } }));
        }
      }}
      onMouseLeave={() => {
        if (isCollapsed) {
          window.dispatchEvent(new CustomEvent('sidebar-hover', { detail: null }));
        }
      }}
    >
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <Icon className={styles.icon} />
        {hasBadge && (
          <div style={{ position: 'absolute', top: '-2px', right: '-2px', width: '8px', height: '8px', backgroundColor: 'var(--color-error)', borderRadius: '50%' }} />
        )}
      </div>
      <span className={styles.label}>
        {label}
      </span>
    </Link>
  );
}

export default function Sidebar({ role = 'frontdesk', className = '', fakePathname, onMenuClick }: SidebarProps) {
  const actualPathname = usePathname() || '';
  const searchParams = useSearchParams();
  const searchString = searchParams?.toString();
  const fullPathname = searchString ? `${actualPathname}?${searchString}` : actualPathname;
  const pathname = fakePathname || fullPathname;
  const { t } = useTranslation();
  const { isSidebarCollapsed, toggleCollapse, hasNewFrontdeskMessage, setHasNewFrontdeskMessage } = useUiStore();
  const [tooltip, setTooltip] = React.useState<{ label: string; top: number; left: number } | null>(null);
  const { subscribe } = useSSE();

  // Clear red dot if on the requests page
  React.useEffect(() => {
    if (pathname === '/frontdesk/requests' && hasNewFrontdeskMessage) {
      setHasNewFrontdeskMessage(false);
    }
  }, [pathname, hasNewFrontdeskMessage, setHasNewFrontdeskMessage]);

  React.useEffect(() => {
    const handleHover = (e: any) => setTooltip(e.detail);
    window.addEventListener('sidebar-hover', handleHover);
    return () => window.removeEventListener('sidebar-hover', handleHover);
  }, []);

  // Global listener for new messages
  React.useEffect(() => {
    if (role !== 'frontdesk') return;

    const unsubscribe = subscribe('/topic/frontdesk', (data: any) => {
      // If we receive a new guest message and we're not on the requests page
      if (data?.type === 'GUEST_MESSAGE' || data?.type === 'NEW_REQUEST') {
        if (pathname !== '/frontdesk/requests') {
          setHasNewFrontdeskMessage(true);
        }
      }
    });

    return () => unsubscribe();
  }, [subscribe, role, pathname, setHasNewFrontdeskMessage]);

  // 부서별 (하우스키핑, 식음료, 시설, 컨시어지) 메뉴 리스트
  const deptMenus = [
    {
      category: '',
      items: [
        { label: '내 작업', href: '/staff?view=my', icon: User },
        { label: '부서 전체 작업', href: '/staff', icon: Users }
      ]
    }
  ];

  const frontdeskMenus = [
    {
      category: '',
      items: [
        { label: t.frontdeskPage.sidebar.menus.frontDesk, href: '/frontdesk/requests', icon: Monitor },
        { label: t.frontdeskPage.sidebar.menus.housekeeping, href: '/frontdesk/housekeeping', icon: Home },
        { label: t.frontdeskPage.sidebar.menus.fb, href: '/frontdesk/fb', icon: Utensils },
        { label: t.frontdeskPage.sidebar.menus.facility, href: '/frontdesk/facility', icon: Wrench },
        { label: t.frontdeskPage.sidebar.menus.concierge, href: '/frontdesk/concierge', icon: MessageSquare },
      ]
    },
    {
      category: t.frontdeskPage.sidebar.categories.requestManagement,
      items: [
        { label: t.frontdeskPage.sidebar.menus.allRequests, href: '/frontdesk/all-requests', icon: Layers },
        { label: t.frontdeskPage.sidebar.menus.chatHistory, href: '/frontdesk/chat-history', icon: History },
        { label: t.frontdeskPage.sidebar.menus.voc, href: '/frontdesk/voc', icon: MessageCircle },
      ]
    },
    {
      category: t.frontdeskPage.sidebar.categories.aiSystem,
      items: [
        { label: t.frontdeskPage.sidebar.menus.rag, href: '/frontdesk/knowledge', icon: Database },
        { label: t.frontdeskPage.sidebar.menus.aiRouting, href: '/frontdesk/ai-routing', icon: FileSearch },
      ]
    },
    {
      category: t.frontdeskPage.sidebar.categories.operations,
      items: [
        { label: t.frontdeskPage.sidebar.menus.dashboard, href: '/frontdesk/dashboard', icon: DashboardIcon },
        { label: t.frontdeskPage.sidebar.menus.handover, href: '/frontdesk/handover', icon: FileText },
        { label: t.frontdeskPage.sidebar.menus.staffManagement, href: '/frontdesk/staff-management', icon: Users },
      ]
    }
  ];

  const isDepartment = ['housekeeping', 'facility', 'fb', 'concierge', 'staff'].includes(role);
  const menus = isDepartment ? deptMenus : frontdeskMenus;

  const flatMenus = menus.flatMap(g => g.items);
  const activeMenu = flatMenus.reduce((bestMatch, menu) => {
    if (pathname === menu.href || pathname.startsWith(`${menu.href}/`)) {
      if (!bestMatch || menu.href.length > bestMatch.href.length) {
        return menu;
      }
    }
    return bestMatch;
  }, null as any);

  return (
    <aside
      className={`${styles.sidebar} ${isSidebarCollapsed ? styles.sidebarCollapsed : ''} ${className}`.trim()}
      style={{ height: '100vh', overflowY: 'auto' }}
    >
      {/* Logo + Collapse Toggle */}
      <div className={styles.logoRow}>
        <Link href="/" className={`${styles.logoLink} ${isSidebarCollapsed ? styles.logoCollapsed : ''}`}>
          <img src="/icon.png" alt="Anook Logo" style={{ width: '24px', height: '24px', objectFit: 'contain' }} />
        </Link>
        <button
          className={styles.collapseBtn}
          onClick={toggleCollapse}
          aria-label={isSidebarCollapsed ? '사이드바 펼치기' : '사이드바 접기'}
        >
          {isSidebarCollapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', flex: 1, paddingTop: 'var(--space-8)' }}>
        {menus.map((group, groupIdx) => (
          <div key={groupIdx} style={{ marginBottom: group.category ? 'var(--space-8)' : '0' }}>
            {group.category && (
              <h4 className={`${styles.categoryHeader} ${isSidebarCollapsed ? styles.categoryCollapsed : ''}`}>
                {group.category}
              </h4>
            )}
            {group.category && (
              <div className={`${styles.collapsedDivider} ${isSidebarCollapsed ? '' : styles.dividerHidden}`} />
            )}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {group.items.map((menu) => {
                const isActive = activeMenu?.href === menu.href;
                return (
                  <SidebarItem
                    key={menu.href}
                    icon={menu.icon}
                    label={menu.label}
                    href={menu.href}
                    isActive={isActive}
                    isCollapsed={isSidebarCollapsed}
                    hasBadge={menu.href === '/frontdesk/requests' ? hasNewFrontdeskMessage : false}
                    onClick={onMenuClick}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div style={{ width: '100%', paddingBottom: 'var(--space-24)', marginTop: 'auto' }}>
        <button
          onClick={async () => {
            await fetch('/api/auth/session', { method: 'DELETE' });
            window.location.href = '/login';
          }}
          className={`${styles.item} ${styles.danger} ${isSidebarCollapsed ? styles.itemCollapsed : ''}`}
          style={{ width: '100%', border: 'none', cursor: 'pointer', justifyContent: isSidebarCollapsed ? 'center' : 'flex-start' }}
          onMouseEnter={(e) => {
            if (isSidebarCollapsed && typeof window !== 'undefined' && window.innerWidth > 768) {
              const rect = e.currentTarget.getBoundingClientRect();
              setTooltip({ label: t.common.logout, top: rect.top + rect.height / 2, left: rect.right + 8 });
            }
          }}
          onMouseLeave={() => {
            if (isSidebarCollapsed) setTooltip(null);
          }}
        >
          <LogOut className={styles.icon} />
          <span className={styles.label}>{t.common.logout}</span>
        </button>
      </div>

      {/* Fixed Tooltip */}
      {tooltip && (
        <div style={{
          position: 'fixed',
          top: tooltip.top,
          left: tooltip.left,
          transform: 'translateY(-50%)',
          backgroundColor: 'var(--color-gray-900)',
          color: 'var(--color-white)',
          padding: '4px 8px',
          borderRadius: '4px',
          fontSize: '0.75rem',
          fontWeight: 500,
          whiteSpace: 'nowrap',
          zIndex: 9999,
          pointerEvents: 'none',
          boxShadow: 'var(--shadow-md)',
        }}>
          {tooltip.label}
        </div>
      )}
    </aside>
  );
}
