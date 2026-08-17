import React, { useState } from 'react';
import styles from './TaskColumn.module.css';

export interface TaskColumnProps {
  title: string;
  count?: number;
  children?: React.ReactNode;
  className?: string;
  status?: 'TODO' | 'IN_PROGRESS' | 'DONE';
  headerRight?: React.ReactNode;
  onDropTask?: (dragData: { id: number; version?: number; fromStatus: string; cancelRequested?: boolean }) => void;
}

export default function TaskColumn({ title, count = 0, children, className = '', status, headerRight, onDropTask }: TaskColumnProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  let statusClass = '';
  if (status === 'TODO') statusClass = styles.todo;
  else if (status === 'IN_PROGRESS') statusClass = styles.inProgress;
  else if (status === 'DONE') statusClass = styles.done;

  const handleDragOver = (e: React.DragEvent) => {
    if (!onDropTask) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!isDragOver) setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!onDropTask) return;
    e.preventDefault();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    if (!onDropTask) return;
    e.preventDefault();
    setIsDragOver(false);
    try {
      const rawData = e.dataTransfer.getData('application/json') || e.dataTransfer.getData('text/plain');
      if (!rawData) return;
      const data = JSON.parse(rawData);
      if (onDropTask) {
        onDropTask(data);
      }
    } catch (err) {
      console.error('Failed to parse drag data', err);
    }
  };

  return (
    <div
      className={`${styles.column} ${statusClass} ${className}`.trim()}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className={styles.header}>
        <h3 className={styles.title}>{title}</h3>
        <div className={styles.rightSection}>
          {count >= 0 && <span className={styles.count}>{count}</span>}
          {headerRight && <div className={styles.headerRight}>{headerRight}</div>}
        </div>
      </div>
      <div className={styles.content}>
        {isDragOver && <div className={styles.placeholderSlot} />}
        {children}
      </div>
    </div>
  );
}
