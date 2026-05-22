import React from 'react';
import styles from './HandoverTable.module.css';
import { HandoverItem } from './HandoverRecord';

interface HandoverTableProps {
  items: HandoverItem[];
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

export default function HandoverTable({ items }: HandoverTableProps) {
  const rows = groupAndSortItems(items);

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
            <th className={styles.th}>객실</th>
            <th className={styles.th}>상태</th>
            <th className={styles.th}>카테고리</th>
            <th className={styles.th}>제목/내용 요약</th>
            <th className={styles.th}>시간</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={5} className={styles.td} style={{ textAlign: 'center', padding: '32px' }}>
                해당 근무 시간에 발생한 요청이 없습니다.
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
                  <td className={`${styles.td} ${styles.center}`}>
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
                  </td>
                  <td className={`${styles.td} ${styles.center}`}>{row.category}</td>
                  <td className={styles.td}>{row.summary}</td>
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
