'use client';

import React, { useState } from 'react';
import InputField from '@/components/ui/Inputfield/InputField';
import { HandoverRecord } from '@/components/ui/HandoverRecord';
import styles from './page.module.css';
import { useTranslation } from '@/app/useTranslation';
import { useHandover } from './useHandover';

const sampleHandoverItems = [
  { id: 1, status: 'PENDING', category: '컴플레인', roomNumber: '812', summary: '에어컨 소음 발생 ➡️ 시설팀 조치 완료했으나 Evening조에서 18시경 객실로 사과 음료 서비스하며 재확인(Follow-up) 요망.', author: '김모닝 (Morning)', time: '10:15' },
  { id: 2, status: 'DONE', category: '고객요청', roomNumber: '503', summary: '20:00 셔틀버스 예약 승객 명단 등록 완료.', author: '이모닝 (Morning)', time: '9:40' },
  { id: 3, status: 'DONE', category: '시설정비', roomNumber: '1205', summary: '화장실 배수구 막힘 현상 ➡️ 시설팀 방문하여 뚫음. 정상 작동 확인.', author: '김모닝 (Morning)', time: '8:20' }
];

export default function HandoverPage() {
  const { t } = useTranslation();
  const [searchValue, setSearchValue] = useState('');
  
  const {
    targetDate,
    setTargetDate,
    shiftType,
    setShiftType,
    managerName,
    loading,
    error,
    briefingData,
    itemsData,
  } = useHandover();

  const filteredItems = itemsData.filter(item => {
    const search = searchValue.toLowerCase();
    if (!search) return true;
    return (
      (item.roomNumber && item.roomNumber.toLowerCase().includes(search)) ||
      (item.category && item.category.toLowerCase().includes(search)) ||
      (item.summary && item.summary.toLowerCase().includes(search)) ||
      (item.author && item.author.toLowerCase().includes(search))
    );
  });

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <h1 className={styles.title}>{t.frontdeskPage.taskBoard.titles.handover}</h1>
          <div className={styles.pickerActions}>
            <input 
              type="date" 
              className={styles.datePicker}
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
            />
            <select 
              className={styles.shiftSelect}
              value={shiftType}
              onChange={(e) => setShiftType(e.target.value)}
            >
              <option value="DAY">주간 (07:00 - 15:00)</option>
              <option value="EVENING">야간 (15:00 - 23:00)</option>
              <option value="NIGHT">심야 (23:00 - 07:00)</option>
            </select>
          </div>
        </div>
        <div className={styles.searchBarRow}>
          <InputField 
            variant="search" 
            placeholder={t.frontdeskPage.taskBoard.searchPlaceholder} 
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center' }}>데이터를 불러오는 중입니다...</div>
      ) : error ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'red' }}>{error}</div>
      ) : (
        <HandoverRecord
          managerName={managerName}
          briefing={briefingData || undefined}
          items={filteredItems}
        />
      )}
    </div>
  );
}
