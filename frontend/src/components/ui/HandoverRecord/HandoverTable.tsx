import React from 'react';
import styles from './HandoverTable.module.css';
import { HandoverItem } from './HandoverRecord';

interface HandoverTableProps {
  items: HandoverItem[];
}

export default function HandoverTable({ items }: HandoverTableProps) {
  return (
    <div className={styles.tableContainer}>
      <table className={styles.table}>
        <colgroup>
          <col style={{ width: '12%' }} />
          <col style={{ width: '12%' }} />
          <col style={{ width: '10%' }} />
          <col style={{ width: '56%' }} />
          <col style={{ width: '10%' }} />
        </colgroup>
        <thead>
          <tr>
            <th className={styles.th}>상태</th>
            <th className={styles.th}>카테고리</th>
            <th className={styles.th}>객실</th>
            <th className={styles.th}>제목/내용 요약</th>
            <th className={styles.th}>시간</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={5} className={styles.td} style={{ textAlign: 'center', padding: '32px' }}>
                해당 근무 시간에 발생한 요청이 없습니다.
              </td>
            </tr>
          ) : (
            items.map((item) => {
              const isDone = item.status === 'DONE';
              const isPending = item.status === 'PENDING';
              
              return (
                <tr key={item.id} className={styles.tr}>
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
                      <span className={styles.statusText}>{item.status}</span>
                    </div>
                  </td>
                  <td className={`${styles.td} ${styles.center}`}>{item.category}</td>
                  <td className={`${styles.td} ${styles.center} ${styles.roomNo}`}>{item.roomNumber}</td>
                  <td className={styles.td}>{item.summary}</td>
                  <td className={`${styles.td} ${styles.center} ${styles.time}`}>{item.time}</td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

