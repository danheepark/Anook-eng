'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import styles from './Sidebar.module.css';
import { useTranslation } from '@/app/useTranslation';

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
  role?: 'admin' | 'staff' | 'guest' | 'housekeeping' | 'facility' | 'fb' | 'concierge' | 'front-desk' | 'emergency';
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
  onClick?: (e: React.MouseEvent, href: string) => void;
}

function SidebarItem({ icon: Icon, label, href, isActive = false, isDanger = false, onClick }: SidebarItemProps) {
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
      className={`${styles.item} ${itemStyle}`}
      onClick={(e) => onClick && onClick(e, href)}
    >
      <Icon className={styles.icon} />
      <span className={styles.label}>{label}</span>
    </Link>
  );
}

export default function Sidebar({ role = 'admin', className = '', fakePathname, onMenuClick }: SidebarProps) {
  const actualPathname = usePathname() || '';
  const searchParams = useSearchParams();
  const searchString = searchParams?.toString();
  const fullPathname = searchString ? `${actualPathname}?${searchString}` : actualPathname;
  const pathname = fakePathname || fullPathname;
  const { t } = useTranslation();

  // 부서별 (하우스키핑, 식음료, 시설, 컨시어지) 메뉴 리스트
  const deptMenus = [
    {
      category: '',
      items: [
        { label: '내 작업 (My Tasks)', href: '/staff?view=my', icon: User },
        { label: '부서 전체 작업 (Dept Tasks)', href: '/staff', icon: Users }
      ]
    }
  ];

  const adminMenus = [
    {
      category: '',
      items: [
        { label: t.adminPage.sidebar.menus.dashboard, href: '/admin/dashboard', icon: LayoutDashboard },
        { label: t.adminPage.sidebar.menus.frontDesk, href: '/admin/front-desk', icon: Monitor },
        { label: t.adminPage.sidebar.menus.housekeeping, href: '/admin/housekeeping', icon: Home },
        { label: t.adminPage.sidebar.menus.fb, href: '/admin/fb', icon: Utensils },
        { label: t.adminPage.sidebar.menus.facility, href: '/admin/facility', icon: Wrench },
        { label: t.adminPage.sidebar.menus.concierge, href: '/admin/concierge', icon: MessageSquare },
      ]
    },
    {
      category: t.adminPage.sidebar.categories.requestManagement,
      items: [
        { label: t.adminPage.sidebar.menus.allRequests, href: '/admin/all-requests', icon: Layers },
        { label: t.adminPage.sidebar.menus.chatHistory, href: '/admin/chat-history', icon: History },
        { label: '고객 피드백', href: '/admin/voc', icon: MessageCircle },
      ]
    },
    {
      category: t.adminPage.sidebar.categories.aiSystem,
      items: [
        { label: t.adminPage.sidebar.menus.rag, href: '/admin/knowledge', icon: Database },
        { label: t.adminPage.sidebar.menus.aiRouting, href: '/admin/ai-routing', icon: FileSearch },
      ]
    },
    {
      category: t.adminPage.sidebar.categories.operations,
      items: [
        { label: t.adminPage.sidebar.menus.handover, href: '/admin/handover', icon: FileText },
        { label: t.adminPage.sidebar.menus.staffManagement, href: '/admin/staff-management', icon: Users },
      ]
    }
  ];

  const isDepartment = ['housekeeping', 'facility', 'fb', 'concierge', 'staff'].includes(role);
  const menus = isDepartment ? deptMenus : adminMenus;

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
      className={`${styles.sidebar} ${className}`.trim()}
      style={{ height: '100vh', overflowY: 'auto' }}
    >
      <div style={{ padding: 'var(--space-24) var(--space-24) var(--space-8)' }}>
        <Link href="/" style={{
          fontSize: '1.75rem',
          fontWeight: 900,
          letterSpacing: '-0.05em',
          color: 'var(--color-primary, #0f172a)',
          textDecoration: 'none'
        }}>
          Anook
        </Link>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', flex: 1, paddingTop: 'var(--space-8)' }}>
        {menus.map((group, groupIdx) => (
          <div key={groupIdx} style={{ marginBottom: group.category ? 'var(--space-8)' : '0' }}>
            {group.category && (
              <h4 style={{ 
                padding: 'var(--space-8) var(--space-24)', 
                fontSize: '0.75rem', 
                fontWeight: 600, 
                color: 'var(--color-gray-500)',
                marginTop: 'var(--space-8)',
                marginBottom: 'var(--space-4)'
              }}>
                {group.category}
              </h4>
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
          className={`${styles.item} ${styles.danger}`}
          style={{ width: '100%', border: 'none', cursor: 'pointer', justifyContent: 'flex-start' }}
        >
          <LogOut className={styles.icon} />
          <span className={styles.label}>로그아웃</span>
        </button>
      </div>
    </aside>
  );
}
