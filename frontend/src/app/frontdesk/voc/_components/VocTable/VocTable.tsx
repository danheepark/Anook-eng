import React from 'react';
import styles from './VocTable.module.css';
import { VocItem } from '../../useVocList';
import { useTranslation } from '@/app/useTranslation';
import { Table, TableHeader, TableRow, TableCell } from '@/components/ui/Table/Table';

interface VocTableProps {
  vocs: VocItem[];
  loading: boolean;
}

export default function VocTable({ vocs, loading }: VocTableProps) {
  const { t } = useTranslation();

  if (loading) {
    return <div className={styles.emptyState}>{t.common.loading}</div>;
  }

  if (vocs.length === 0) {
    return <div className={styles.emptyState}>{t.frontdeskPage.voc.empty}</div>;
  }

  const formatDate = (dateString: string) => {
    const d = new Date(dateString);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  return (
    <Table columns="160px 80px 140px 1fr">
      <TableHeader>
        <TableCell>{t.frontdeskPage.voc.columns.date}</TableCell>
        <TableCell>{t.frontdeskPage.voc.columns.room}</TableCell>
        <TableCell>{t.frontdeskPage.voc.columns.sentiment}</TableCell>
        <TableCell className={styles.leftAlign}>{t.frontdeskPage.voc.columns.content}</TableCell>
      </TableHeader>
      {vocs.map((voc) => (
        <TableRow key={voc.id}>
          <TableCell label={t.frontdeskPage.voc.columns.date}>{formatDate(voc.createdAt)}</TableCell>
          <TableCell label={t.frontdeskPage.voc.columns.room}>{voc.roomNo}</TableCell>
          <TableCell label={t.frontdeskPage.voc.columns.sentiment}>
            <span className={`${styles.badge} ${voc.sentiment === 'POSITIVE' ? styles.positive : styles.negative}`}>
              {voc.sentiment === 'POSITIVE' ? t.frontdeskPage.voc.sentiments.positive : t.frontdeskPage.voc.sentiments.negative}
            </span>
          </TableCell>
          <TableCell label={t.frontdeskPage.voc.columns.content} className={styles.leftAlign}>
            <div className={styles.plainContent}>{voc.content}</div>
          </TableCell>
        </TableRow>
      ))}
    </Table>
  );
}
