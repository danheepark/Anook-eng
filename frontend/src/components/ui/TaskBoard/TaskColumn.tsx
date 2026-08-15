import React from 'react';
import styles from './TaskColumn.module.css';

export interface TaskColumnProps {
  title: string;
  count?: number;
  children?: React.ReactNode;
  className?: string;
  status?: 'TODO' | 'IN_PROGRESS' | 'DONE';
  headerRight?: React.ReactNode;
}

export default function TaskColumn({ title, count = 0, children, className = '', status, headerRight }: TaskColumnProps) {
  let statusClass = '';
  if (status === 'TODO') statusClass = styles.todo;
  else if (status === 'IN_PROGRESS') statusClass = styles.inProgress;
  else if (status === 'DONE') statusClass = styles.done;

  return (
    <div className={`${styles.column} ${statusClass} ${className}`.trim()}>
      <div className={styles.header}>
        <h3 className={styles.title}>
          {title}
          {count >= 0 && <span className={styles.count}>{count}</span>}
        </h3>
        {headerRight && <div className={styles.headerRight}>{headerRight}</div>}
      </div>
      <div className={styles.content}>
        {children}
      </div>
    </div>
  );
}
