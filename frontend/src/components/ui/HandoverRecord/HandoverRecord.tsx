import React from 'react';
import HandoverTable from './HandoverTable';
import styles from './HandoverRecord.module.css';
import { useTranslation } from '@/app/useTranslation';

export interface HandoverItem {
  id: string | number;
  status: string;
  category: string;
  roomNumber: string;
  summary: string;
  author: string;
  time: string;
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
  const { t } = useTranslation();

  return (
    <div className={styles.container}>

      {briefing && (
        <table className={styles.infoTable}>
          <tbody>
            <tr>
              <th className={styles.infoTh}>{t.frontdeskPage?.handover?.briefing?.shiftTime || '근무시간'}</th>
              <td className={styles.infoTd}>{briefing.shiftStart} ~ {briefing.shiftEnd}</td>
              <th className={styles.infoTh}>{t.frontdeskPage?.handover?.briefing?.manager || '담당자명'}</th>
              <td className={styles.infoTd}>{managerName || '-'}</td>
            </tr>
            <tr>
              <th className={styles.infoTh}>{t.frontdeskPage?.handover?.briefing?.resolutionStatus || '처리 현황'}</th>
              <td className={styles.infoTd}>{briefing.totalRequestCount - briefing.pendingCount} / {briefing.totalRequestCount}</td>
              <th className={styles.infoTh}>{t.frontdeskPage?.handover?.briefing?.createdAt || '작성 일시'}</th>
              <td className={styles.infoTd}>{briefing.createdAt}</td>
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
