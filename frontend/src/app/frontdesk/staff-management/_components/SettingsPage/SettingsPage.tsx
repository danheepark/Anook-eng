import React, { useState } from 'react';
import Tabs from '@/components/ui/Tab/Tabs';
import StaffTab from '../StaffTab/StaffTab';
import RoleTab from '../RoleTab/RoleTab';
import { useTranslation } from '@/app/useTranslation';

import styles from './SettingsPage.module.css';

export default function SettingsPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('staff');

  const tabsOptions = [
    { label: t.frontdeskPage.staffManagement.tabs.staff, value: 'staff' },
    { label: t.frontdeskPage.staffManagement.tabs.role, value: 'role' },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>{t.frontdeskPage.staffManagement.title}</h1>
      </div>

      <div className={styles.tabSection}>
        <Tabs
          options={tabsOptions}
          activeValue={activeTab}
          onChange={setActiveTab}
        />
      </div>

      <div className={styles.contentContainer}>
        {activeTab === 'staff' && <StaffTab />}
        {activeTab === 'role' && <RoleTab />}
      </div>
    </div>
  );
}
