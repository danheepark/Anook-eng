import React from 'react';
import styles from './VocTable.module.css';
import { VocItem } from '../../useVocList';

interface VocTableProps {
  vocs: VocItem[];
  loading: boolean;
}

export default function VocTable({ vocs, loading }: VocTableProps) {
  if (loading) {
    return <div className={styles.emptyState}>데이터를 불러오는 중입니다...</div>;
  }

  if (vocs.length === 0) {
    return <div className={styles.emptyState}>조건에 맞는 피드백이 없습니다.</div>;
  }

  const formatDate = (dateString: string) => {
    const d = new Date(dateString);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  return (
    <div className={styles.tableContainer}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.dateCol}>수신 일시</th>
            <th className={styles.roomCol}>객실</th>
            <th className={styles.sentimentCol}>구분</th>
            <th className={styles.contentCol}>고객 피드백 내용</th>
            <th className={styles.replyCol}>AI 자동 답변</th>
          </tr>
        </thead>
        <tbody>
          {vocs.map((voc) => (
            <tr key={voc.id}>
              <td className={styles.centerAlign}>{formatDate(voc.createdAt)}</td>
              <td className={styles.centerAlign}>{voc.roomNo}</td>
              <td className={styles.centerAlign}>
                <span className={`${styles.badge} ${voc.sentiment === 'POSITIVE' ? styles.positive : styles.negative}`}>
                  {voc.sentiment === 'POSITIVE' ? '칭찬' : '불만/의견'}
                </span>
              </td>
              <td>
                <div className={styles.contentBox}>{voc.content}</div>
              </td>
              <td>
                <div className={styles.replyBox}>{voc.aiReply}</div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
