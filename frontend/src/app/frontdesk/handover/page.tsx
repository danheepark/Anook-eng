'use client';

import React, { useState } from 'react';
import InputField from '@/components/ui/Inputfield/InputField';
import { HandoverRecord } from '@/components/ui/HandoverRecord';
import styles from './page.module.css';
import { useTranslation } from '@/app/useTranslation';

const sampleHandoverItems = [
  { id: 1, roomNumber: '1204', guestName: '김민수', requestDetails: '[에어컨 수리] 에어컨 작동 안 됨' },
  { id: 2, roomNumber: '1204', guestName: '김민수', requestDetails: '[수건 교체] 새 수건 3장 추가 요청' },
  { id: 3, roomNumber: '805', guestName: '박지원', requestDetails: '[룸서비스] 치즈버거 1세트 주문' },
  { id: 4, roomNumber: '502', guestName: '이지현', requestDetails: '[침구류 정리] 엑스트라 베드 설치 요청' },
  { id: 5, roomNumber: '302', guestName: '최승우', requestDetails: '[샤워기 헤드 교체] 수압 약함' },
  { id: 6, roomNumber: '2105', guestName: '홍길동', requestDetails: '[레스토랑 예약] 오늘 저녁 7시 미슐랭 레스토랑 2명 예약 요청' },
  { id: 7, roomNumber: '1001', guestName: '홍길동', requestDetails: '[객실 내 응급 환자] 심한 복통 호소, 의료진 지원 필요' },
];

const sampleHandoverBriefing = {
  id: 1,
  shiftStart: '2026-04-30 09:00',
  shiftEnd: '2026-04-30 18:00',
  totalRequestCount: 45,
  pendingCount: 2,
  escalatedCount: 1,
  summary: '대부분의 요청이 원활하게 처리되었으나, 1204호 에어컨 수리 건이 부품 문제로 지연 중. 야간 근무 시 진행 상황 팔로업 요망.',
  createdAt: '2026-04-30 17:55'
};

export default function HandoverPage() {
  const { t } = useTranslation();
  const [searchValue, setSearchValue] = useState('');
  const [targetDate, setTargetDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [shiftType, setShiftType] = useState<string>('DAY');
  const [managerName, setManagerName] = useState<string>('관리자');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  const [briefingData, setBriefingData] = useState<any>(null);
  const [itemsData, setItemsData] = useState<any[]>([]);

  // 세션 정보 확인
  React.useEffect(() => {
    fetch('/api/auth/session')
      .then(res => res.json())
      .then(data => {
        if (data.isLoggedIn && data.name) {
          setManagerName(data.name);
        }
      })
      .catch(console.error);
  }, []);

  // 백엔드 API 연동
  React.useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/frontdesk/handover?date=${targetDate}&shiftType=${shiftType}`)
      .then(async (res) => {
        if (!res.ok) throw new Error('데이터를 불러오지 못했습니다.');
        return res.json();
      })
      .then((data) => {
        const [start, end] = data.shiftTimeLabel ? data.shiftTimeLabel.split(' - ') : ['-', '-'];
        
        setBriefingData({
          id: '-',
          shiftStart: start,
          shiftEnd: end,
          totalRequestCount: data.totalRequestCount,
          pendingCount: data.pendingCount,
          escalatedCount: 0,
          summary: '자동 생성된 인수인계 브리핑입니다.',
          createdAt: (() => {
            const d = new Date();
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            const hh = String(d.getHours()).padStart(2, '0');
            const min = String(d.getMinutes()).padStart(2, '0');
            return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
          })()
        });

        const mappedItems = data.tasks.map((task: any, index: number) => ({
          id: index + 1,
          roomNumber: task.roomNo,
          guestName: task.guestName || '-',
          requestDetails: `[${task.category}] ${task.summary}`
        }));
        setItemsData(mappedItems);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [targetDate, shiftType]);

  const filteredItems = itemsData.filter(item => {
    const search = searchValue.toLowerCase();
    if (!search) return true;
    return item.roomNumber.toLowerCase().includes(search) || 
           item.guestName.toLowerCase().includes(search) || 
           item.requestDetails.toLowerCase().includes(search);
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
          briefing={briefingData}
          items={filteredItems}
        />
      )}
    </div>
  );
}
