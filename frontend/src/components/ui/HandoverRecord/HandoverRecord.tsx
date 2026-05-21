import React from 'react';
import HandoverTable from './HandoverTable';
import styles from './HandoverRecord.module.css';

export interface HandoverItem {
  id: string | number;
  roomNumber: string;
  guestName: string;
  requestDetails: string;
}

export interface HandoverBriefing {
  id: string | number;
  shiftStart: string;
  shiftEnd: string;
  totalRequestCount: number;
  pendingCount: number;
  escalatedCount: number;
  summary: string;
  createdAt: string;
}

export interface HandoverRecordProps {
  managerName?: string;
  briefing?: HandoverBriefing;
  items: HandoverItem[];
}

export default function HandoverRecord({ managerName, briefing, items }: HandoverRecordProps) {
  return (
    <div className={styles.container}>

      {briefing && (
        <table className={styles.infoTable}>
          <tbody>
            <tr>
              <th className={styles.infoTh}>ID</th>
              <td className={styles.infoTd}>{briefing.id}</td>
              <th className={styles.infoTh}>담당자명</th>
              <td className={styles.infoTd}>{managerName || '-'}</td>
            </tr>
            <tr>
              <th className={styles.infoTh}>교대 시작</th>
              <td className={styles.infoTd}>{briefing.shiftStart}</td>
              <th className={styles.infoTh}>교대 종료</th>
              <td className={styles.infoTd}>{briefing.shiftEnd}</td>
            </tr>
            <tr>
              <th className={styles.infoTh}>총 요청 수</th>
              <td className={styles.infoTd}>{briefing.totalRequestCount}</td>
              <th className={styles.infoTh}>작성 일시</th>
              <td className={styles.infoTd}>{briefing.createdAt}</td>
            </tr>
            <tr>
              <th className={styles.infoTh}>미처리 수</th>
              <td className={styles.infoTd}>{briefing.pendingCount}</td>
              <th className={styles.infoTh}>에스컬레이션 수</th>
              <td className={styles.infoTd}>{briefing.escalatedCount}</td>
            </tr>
          </tbody>
        </table>
      )}

      <div className={styles.tableWrapper}>
        <HandoverTable items={items} />
      </div>
    </div>
  );
}
