import React from 'react';
import styles from './HandoverTable.module.css';
import { HandoverItem } from './HandoverRecord';

interface HandoverTableProps {
  items: HandoverItem[];
}

export default function HandoverTable({ items }: HandoverTableProps) {
  // 방 호수별로 데이터 그룹화 및 정렬
  const groupedTasks = items.reduce((acc, task) => {
    if (!acc[task.roomNumber]) {
      acc[task.roomNumber] = [];
    }
    acc[task.roomNumber].push(task);
    return acc;
  }, {} as Record<string, HandoverItem[]>);

  const groupedTasksArray = Object.values(groupedTasks).sort((a, b) => {
    const numA = parseInt(a[0].roomNumber);
    const numB = parseInt(b[0].roomNumber);
    if (!isNaN(numA) && !isNaN(numB)) {
      return numA - numB;
    }
    return a[0].roomNumber.localeCompare(b[0].roomNumber);
  });

  return (
    <div className={styles.tableContainer}>
      <table className={styles.table}>
        <colgroup>
          <col style={{ width: '20%' }} />
          <col style={{ width: '80%' }} />
        </colgroup>
        <thead>
          <tr>
            <th className={styles.th}>방 호수</th>
            <th className={styles.th}>요청 내용</th>
          </tr>
        </thead>
        <tbody>
          {groupedTasksArray.length === 0 ? (
            <tr>
              <td colSpan={2} className={styles.td} style={{ textAlign: 'center', padding: '32px' }}>
                해당 근무 시간에 발생한 요청이 없습니다.
              </td>
            </tr>
          ) : (
            groupedTasksArray.map((group, groupIdx) => (
              <React.Fragment key={groupIdx}>
                {group.map((item, itemIdx) => (
                  <tr key={`${groupIdx}-${itemIdx}`}>
                    {itemIdx === 0 && (
                      <td className={styles.td} rowSpan={group.length} style={{ verticalAlign: 'middle', fontWeight: 'bold' }}>
                        {group[0].roomNumber}
                      </td>
                    )}
                    <td className={styles.td}>{item.requestDetails}</td>
                  </tr>
                ))}
              </React.Fragment>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
