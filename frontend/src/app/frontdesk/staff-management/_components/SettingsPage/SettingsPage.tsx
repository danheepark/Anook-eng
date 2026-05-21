import React, { useState } from 'react';
import Tabs from '@/components/ui/Tab/Tabs';
import StaffTab from '../StaffTab/StaffTab';
import RoleTab from '../RoleTab/RoleTab';

import styles from './SettingsPage.module.css';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('staff');

  const tabsOptions = [
    { label: '직원 관리', value: 'staff' },
    { label: '역할 관리', value: 'role' },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>직원 관리</h1>
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
