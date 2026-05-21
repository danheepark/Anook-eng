import React from 'react';
import styles from './Table.module.css';

interface TableProps {
  columns: string; // e.g. "1fr 120px 120px 88px 88px"
  responsiveVariant?: 'inline' | 'stacked';
  children: React.ReactNode;
}

export const Table = ({ columns, responsiveVariant = 'inline', children }: TableProps) => {
  const responsiveColumns = React.useMemo(() => {
    return columns
      .split(/\s+/)
      .map((col) => {
        const matchPx = col.match(/^(\d+)px$/);
        if (matchPx) {
          const pxVal = parseInt(matchPx[1], 10);
          const minVal = Math.max(50, Math.floor(pxVal * 0.5));
          return `minmax(${minVal}px, ${pxVal}px)`;
        }
        const matchFr = col.match(/^([\d.]+)fr$/);
        if (matchFr) {
          const frVal = parseFloat(matchFr[1]);
          return `minmax(0px, ${frVal}fr)`;
        }
        return col;
      })
      .join(' ');
  }, [columns]);

  return (
    <div
      className={`${styles.tableContainer} ${styles[responsiveVariant]}`}
      style={{ '--table-columns': responsiveColumns } as React.CSSProperties}
    >
      {children}
    </div>
  );
};

export const TableHeader = ({ children }: { children: React.ReactNode }) => {
  return <div className={styles.tableHeader}>{children}</div>;
};

export const TableRow = ({ 
  children, 
  className,
  ...props 
}: { 
  children: React.ReactNode; 
  className?: string; 
  [key: string]: any;
}) => {
  return <div className={`${styles.tableRow} ${className || ''}`} {...props}>{children}</div>;
};

export const TableCell = ({
  children,
  header = false,
  className,
  label,
}: {
  children?: React.ReactNode;
  header?: boolean;
  className?: string;
  label?: string;
}) => {
  return (
    <div
      className={`${header ? styles.headerItem : styles.rowItem} ${className || ''}`}
      data-label={label ? `${label}:` : undefined}
    >
      {children}
    </div>
  );
};
