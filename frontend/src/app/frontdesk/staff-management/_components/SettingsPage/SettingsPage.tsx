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
      <div className={styles.tabRow}>
        <div className={styles.subTabs}>
          <Tabs
            options={tabsOptions}
            activeValue={activeTab}
            onChange={setActiveTab}
          />
        </div>
        <div id="staff-tab-actions" className={styles.tabActions} />
      </div>

      <div className={styles.contentContainer}>
        {activeTab === 'staff' && <StaffTab />}
        {activeTab === 'role' && <RoleTab />}
      </div>
    </div>
  );
}
