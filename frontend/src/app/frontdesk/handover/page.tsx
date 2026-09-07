'use client';

import React, { useState, useEffect } from 'react';
// xlsx-js-style, not xlsx: the community build of SheetJS reads cell styles
// but drops them when writing, so wrapText never reached the file and every
// summary was cut off at the column edge. Same API, styles included.
import * as XLSX from 'xlsx-js-style';
import { HandoverRecord } from '@/components/ui/HandoverRecord';
import SmartSearchBar from '@/components/ui/SmartSearchBar/SmartSearchBar';
import Button from '@/components/ui/Button/Button';
import styles from './page.module.css';
import { useTranslation } from '@/app/useTranslation';
import { useHandover } from './useHandover';
import HeaderSearchSlot from '@/components/layout/HeaderSearchSlot';

const sampleHandoverItems = [
  { id: 1, status: 'PENDING', category: '컴플레인', roomNumber: '812', summary: '에어컨 소음 발생 ➡️ 시설팀 조치 완료했으나 Evening조에서 18시경 객실로 사과 음료 서비스하며 재확인(Follow-up) 요망.', author: '김모닝 (Morning)', time: '10:15' },
  { id: 2, status: 'DONE', category: '고객요청', roomNumber: '503', summary: '20:00 셔틀버스 예약 승객 명단 등록 완료.', author: '이모닝 (Morning)', time: '9:40' },
  { id: 3, status: 'DONE', category: '시설정비', roomNumber: '1205', summary: '화장실 배수구 막힘 현상 ➡️ 시설팀 방문하여 뚫음. 정상 작동 확인.', author: '김모닝 (Morning)', time: '8:20' }
];

export default function HandoverPage() {
  const { t } = useTranslation();
  const [searchValue, setSearchValue] = useState('');
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
          `${(liveBriefing?.totalRequestCount || 0) - (liveBriefing?.pendingCount || 0)} / ${liveBriefing?.totalRequestCount || 0}`, 
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

      const SUMMARY_WIDTH = 60;   // characters, matches the column width below
      const SUMMARY_COL = 3;      // Summary / Details

      worksheet['!cols'] = [
        { wch: 10 },             // Room
        { wch: 12 },             // Status
        { wch: 18 },             // Category
        { wch: SUMMARY_WIDTH },  // Summary
        { wch: 12 }              // Time
      ];

      // A handover note is a paragraph, so the cell has to hold a paragraph:
      // wrap it, top align it, and give the row enough height for the lines it
      // takes. Excel auto-fits a wrapped row only when no height is set, but
      // other viewers do not, so the height is written out.
      const rows: { hpt: number }[] = [];
      dataRows.forEach((row, i) => {
        const rowIndex = headerRows.length + i;
        const ref = XLSX.utils.encode_cell({ r: rowIndex, c: SUMMARY_COL });
        const cell = worksheet[ref];
        if (!cell) return;
        cell.s = { alignment: { wrapText: true, vertical: 'top' } };
        const lines = Math.max(1, Math.ceil(String(row[SUMMARY_COL] ?? '').length / (SUMMARY_WIDTH - 2)));
        rows[rowIndex] = { hpt: lines * 15 + 4 };
      });
      worksheet['!rows'] = rows;

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Handover');
      
      // Matches the file name the backend export endpoint produces, so the two
      // routes to the same document do not hand back differently named files.
      const fileName = `handover_${targetDate.replace(/-/g, '')}_${shiftType.toUpperCase()}.xlsx`;
      XLSX.writeFile(workbook, fileName);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not export the handover to Excel.');
    } finally {
      setDownloading(false);
    }
  };

  /* The resolution count follows the table rather than the API response. It
     used to come straight from the briefing payload, so marking an item DONE
     changed the row and left the header saying the same thing it said before
     the edit, which is the one number a shift lead reads first.

     Resolved means DONE. The payload counted anything that was not PENDING,
     which quietly treated an item still being worked on as finished. */
  const liveBriefing = briefingData
    ? {
        ...briefingData,
        totalRequestCount: editableItems.length,
        pendingCount: editableItems.filter((item) => item.status !== 'DONE').length,
      }
    : undefined;

  const filteredItems = editableItems.filter(item => {
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
      </div>

      <HeaderSearchSlot>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <SmartSearchBar
            inputWrapperStyle={{ width: 240 }}
            value={searchValue}
            onChange={(val) => setSearchValue(val)}
          />
        </div>
      </HeaderSearchSlot>

      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center' }}>{t.frontdeskPage?.handover?.loading || "데이터를 불러오는 중입니다..."}</div>
      ) : error ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'red' }}>{error}</div>
      ) : (
        <HandoverRecord
          managerName={managerName}
          briefing={liveBriefing}
          items={filteredItems}
          onItemUpdate={handleItemUpdate}
        />
      )}
    </div>
  );
}
