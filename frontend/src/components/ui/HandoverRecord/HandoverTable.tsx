import React from 'react';
import styles from './HandoverTable.module.css';
import { HandoverItem } from './HandoverRecord';
import { useTranslation } from '@/app/useTranslation';

interface HandoverTableProps {
  items: HandoverItem[];
  onItemUpdate?: (id: string | number, field: keyof HandoverItem, value: string) => void;
}

interface GroupedRow extends HandoverItem {
  isFirstInGroup: boolean;
  groupSize: number;
}

function groupAndSortItems(items: HandoverItem[]): GroupedRow[] {
  // 객실별 그룹핑
  const grouped: Record<string, HandoverItem[]> = {};
  for (const item of items) {
    const key = item.roomNumber ?? '-';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(item);
  }

  // 객실번호 내림차순 정렬 (숫자면 숫자 기준, 아니면 문자 역순)
  const sortedRooms = Object.keys(grouped).sort((a, b) => {
    const numA = parseInt(a, 10);
    const numB = parseInt(b, 10);
    if (!isNaN(numA) && !isNaN(numB)) return numB - numA;
    return b.localeCompare(a);
  });

  // 그룹 내 시간순 정렬 후 평탄화
  return sortedRooms.flatMap((room) => {
    const roomItems = [...grouped[room]].sort((a, b) =>
      (a.time ?? '').localeCompare(b.time ?? '')
    );
    return roomItems.map((item, idx) => ({
      ...item,
      isFirstInGroup: idx === 0,
      groupSize: roomItems.length,
    }));
  });
}

export default function HandoverTable({ items, onItemUpdate }: HandoverTableProps) {
  const rows = groupAndSortItems(items);
  const { t } = useTranslation();
  const [editingCell, setEditingCell] = React.useState<{ id: string | number; field: keyof HandoverItem } | null>(null);
  const [editValue, setEditValue] = React.useState('');

  const handleEditStart = (id: string | number, field: keyof HandoverItem, value: string) => {
    setEditingCell({ id, field });
    setEditValue(value);
  };

  const handleEditCommit = () => {
    if (editingCell && onItemUpdate) {
      onItemUpdate(editingCell.id, editingCell.field, editValue);
    }
    setEditingCell(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleEditCommit();
    } else if (e.key === 'Escape') {
      setEditingCell(null);
    }
  };

  return (
    <div className={styles.tableContainer}>
      <table className={styles.table}>
        <colgroup>
          <col style={{ width: '10%' }} />
          <col style={{ width: '12%' }} />
          <col style={{ width: '12%' }} />
          <col style={{ width: '56%' }} />
          <col style={{ width: '10%' }} />
        </colgroup>
        <thead>
          <tr>
            <th className={styles.th}>{t.frontdeskPage?.handover?.tableColumns?.room || '객실'}</th>
            <th className={styles.th}>{t.frontdeskPage?.handover?.tableColumns?.status || '상태'}</th>
            <th className={styles.th}>{t.frontdeskPage?.handover?.tableColumns?.category || '카테고리'}</th>
            <th className={styles.th}>{t.frontdeskPage?.handover?.tableColumns?.summary || '제목/내용 요약'}</th>
            <th className={styles.th}>{t.frontdeskPage?.handover?.tableColumns?.time || '시간'}</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={5} className={styles.td} style={{ textAlign: 'center', padding: '32px' }}>
                {t.frontdeskPage?.handover?.empty || '해당 근무 시간에 발생한 요청이 없습니다.'}
              </td>
            </tr>
          ) : (
            rows.map((row) => {
              const isDone = row.status === 'DONE';
              const isPending = row.status === 'PENDING';

              return (
                <tr key={row.id} className={styles.tr}>
                  {row.isFirstInGroup && (
                    <td
                      rowSpan={row.groupSize}
                      className={`${styles.td} ${styles.center} ${styles.roomNo} ${row.groupSize > 1 ? styles.roomNoGrouped : ''}`}
                    >
                      {row.roomNumber}
                    </td>
                  )}
                  <td 
                    className={`${styles.td} ${styles.center} ${styles.editableCell}`}
                    onClick={() => handleEditStart(row.id, 'status', row.status)}
                  >
                    {editingCell?.id === row.id && editingCell?.field === 'status' ? (
                      <select
                        className={styles.editInput}
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={handleEditCommit}
                        onKeyDown={handleKeyDown}
                        autoFocus
                      >
                        <option value="PENDING">PENDING</option>
                        <option value="IN_PROGRESS">IN_PROGRESS</option>
                        <option value="DONE">DONE</option>
                      </select>
                    ) : (
                      <div className={styles.statusWrapper}>
                        <span
                          className={`${styles.statusDot} ${
                            isDone
                              ? styles.statusDone
                              : isPending
                                ? styles.statusPending
                                : styles.statusInProgress
                          }`}
                        />
                        <span className={styles.statusText}>{row.status}</span>
                      </div>
                    )}
                  </td>
                  <td 
                    className={`${styles.td} ${styles.center} ${styles.editableCell}`}
                    onClick={() => handleEditStart(row.id, 'category', row.category)}
                  >
                    {editingCell?.id === row.id && editingCell?.field === 'category' ? (
                      <input
                        className={styles.editInput}
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={handleEditCommit}
                        onKeyDown={handleKeyDown}
                        autoFocus
                      />
                    ) : (
                      row.category
                    )}
                  </td>
                  <td 
                    className={`${styles.td} ${styles.editableCell}`}
                    onClick={() => handleEditStart(row.id, 'summary', row.summary)}
                  >
                    {editingCell?.id === row.id && editingCell?.field === 'summary' ? (
                      <input
                        className={styles.editInput}
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={handleEditCommit}
                        onKeyDown={handleKeyDown}
                        autoFocus
                      />
                    ) : (
                      row.summary
                    )}
                  </td>
                  <td className={`${styles.td} ${styles.center} ${styles.time}`}>{row.time}</td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
