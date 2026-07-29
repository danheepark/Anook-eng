'use client';

import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { HandoverRecord } from '@/components/ui/HandoverRecord';
import SmartSearchBar from '@/components/ui/SmartSearchBar/SmartSearchBar';
import Button from '@/components/ui/Button/Button';
import styles from './page.module.css';
import { useTranslation } from '@/app/useTranslation';
import { useHandover } from './useHandover';
import FilterButton from '@/components/ui/FilterButton/FilterButton';

const sampleHandoverItems = [
  { id: 1, status: 'PENDING', category: '컴플레인', roomNumber: '812', summary: '에어컨 소음 발생 ➡️ 시설팀 조치 완료했으나 Evening조에서 18시경 객실로 사과 음료 서비스하며 재확인(Follow-up) 요망.', author: '김모닝 (Morning)', time: '10:15' },
  { id: 2, status: 'DONE', category: '고객요청', roomNumber: '503', summary: '20:00 셔틀버스 예약 승객 명단 등록 완료.', author: '이모닝 (Morning)', time: '9:40' },
  { id: 3, status: 'DONE', category: '시설정비', roomNumber: '1205', summary: '화장실 배수구 막힘 현상 ➡️ 시설팀 방문하여 뚫음. 정상 작동 확인.', author: '김모닝 (Morning)', time: '8:20' }
];

export default function HandoverPage() {
  const { t } = useTranslation();
  const [searchValue, setSearchValue] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [downloading, setDownloading] = useState(false);

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

  const [editableItems, setEditableItems] = useState([...itemsData]);

  useEffect(() => {
    setEditableItems([...itemsData]);
  }, [itemsData]);

  const handleItemUpdate = (id: string | number, field: string, value: string) => {
    setEditableItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleExcelDownload = async () => {
    setDownloading(true);
    try {
      const shiftLabel = shiftType === 'DAY'
        ? t.frontdeskPage?.handover?.shift?.label?.DAY || '주간'
        : shiftType === 'EVENING'
          ? t.frontdeskPage?.handover?.shift?.label?.EVENING || '야간'
          : t.frontdeskPage?.handover?.shift?.label?.NIGHT || '심야';

      // Excel content formatting
      const headerRows = [
        [t.frontdeskPage?.handover?.title || "인수인계 문서"],
        [],
        [
          t.frontdeskPage?.handover?.briefing?.shiftTime || '근무시간', 
          `${briefingData?.shiftStart || '-'} ~ ${briefingData?.shiftEnd || '-'}`, 
          t.frontdeskPage?.handover?.briefing?.manager || '담당자명', 
          managerName
        ],
        [
          t.frontdeskPage?.handover?.briefing?.resolutionStatus || '처리 현황', 
          `${(briefingData?.totalRequestCount || 0) - (briefingData?.pendingCount || 0)} / ${briefingData?.totalRequestCount || 0}`, 
          t.frontdeskPage?.handover?.briefing?.createdAt || '작성 일시', 
          briefingData?.createdAt || '-'
        ],
        [],
        [
          t.frontdeskPage?.handover?.tableColumns?.room || '객실', 
          t.frontdeskPage?.handover?.tableColumns?.status || '상태', 
          t.frontdeskPage?.handover?.tableColumns?.category || '카테고리', 
          t.frontdeskPage?.handover?.tableColumns?.summary || '제목/내용 요약', 
          t.frontdeskPage?.handover?.tableColumns?.time || '시간'
        ]
      ];

      const dataRows = editableItems.map(item => [
        item.roomNumber || '-',
        item.status || '',
        item.category || '',
        item.summary || '',
        item.time || ''
      ]);

      const worksheet = XLSX.utils.aoa_to_sheet([...headerRows, ...dataRows]);
      
      // Styling and column widths
      worksheet['!cols'] = [
        { wch: 10 }, // Room
        { wch: 12 }, // Status
        { wch: 15 }, // Category
        { wch: 60 }, // Summary
        { wch: 12 }  // Time
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Handover');
      
      const fileName = `인수인계_${targetDate}_${shiftLabel}.xlsx`;
      XLSX.writeFile(workbook, fileName);
    } catch (err) {
      alert(err instanceof Error ? err.message : '엑셀 다운로드 중 오류가 발생했습니다.');
    } finally {
      setDownloading(false);
    }
  };

  const filteredItems = editableItems.filter(item => {
    if (statusFilter !== 'ALL' && item.status !== statusFilter) {
      return false;
    }
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
          <h1 className={styles.title}>{t.frontdeskPage?.handover?.title || "인수인계 문서"}</h1>
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
              <option value="DAY">{t.frontdeskPage?.handover?.shift?.DAY || "주간 (07:00 - 15:00)"}</option>
              <option value="EVENING">{t.frontdeskPage?.handover?.shift?.EVENING || "야간 (15:00 - 23:00)"}</option>
              <option value="NIGHT">{t.frontdeskPage?.handover?.shift?.NIGHT || "심야 (23:00 - 07:00)"}</option>
            </select>
            <Button
              variant="primary"
              onClick={handleExcelDownload}
              disabled={downloading || loading}
            >
              {downloading ? (t.frontdeskPage?.handover?.downloading || '다운로드 중...') : (t.frontdeskPage?.handover?.downloadButton || '엑셀 다운로드')}
            </Button>
          </div>
        </div>
        <div className={styles.searchBarRow}>
          <div style={{ flex: 1 }}>
            <SmartSearchBar
              inputWrapperStyle={{ flex: 1 }}
              value={searchValue}
              onChange={(val) => setSearchValue(val)}
            />
          </div>
          <FilterButton
            filterOptions={[
              { value: 'ALL', label: t.frontdeskPage?.handover?.filterOptions?.ALL || '전체 상태' },
              { value: 'PENDING', label: t.frontdeskPage?.handover?.filterOptions?.PENDING || '대기중' },
              { value: 'IN_PROGRESS', label: t.frontdeskPage?.handover?.filterOptions?.IN_PROGRESS || '진행중' },
              { value: 'DONE', label: t.frontdeskPage?.handover?.filterOptions?.DONE || '처리 완료' }
            ]}
            selectedFilter={statusFilter}
            onFilterSelect={setStatusFilter}
          />
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center' }}>{t.frontdeskPage?.handover?.loading || "데이터를 불러오는 중입니다..."}</div>
      ) : error ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'red' }}>{error}</div>
      ) : (
        <HandoverRecord
          managerName={managerName}
          briefing={briefingData || undefined}
          items={filteredItems}
          onItemUpdate={handleItemUpdate}
        />
      )}
    </div>
  );
}
