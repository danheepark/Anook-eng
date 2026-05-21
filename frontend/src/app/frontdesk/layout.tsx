import React from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';

export default function FrontdeskLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardLayout role="frontdesk">
      {children}
    </DashboardLayout>
  );
}
