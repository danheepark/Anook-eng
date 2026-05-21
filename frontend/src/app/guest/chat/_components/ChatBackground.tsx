import React from 'react';
import styles from './ChatBackground.module.css';

interface ChatBackgroundProps {
  isAiTyping: boolean;
  isUserTyping: boolean;
  isInitial?: boolean;
}

function ChatBackground({ isAiTyping, isUserTyping, isInitial }: ChatBackgroundProps) {
  const getClass = (active: string, idle: string) => {
    if (isAiTyping) return active;
    if (isInitial) return idle;
    return '';
  };

  return (
    <div className={`${styles.backgroundContainer} ${isUserTyping ? styles.userTyping : ''}`}>
      <div className={`${styles.blob} ${styles.blob1} ${getClass(styles.active1, styles.idle1)}`} />
      <div className={`${styles.blob} ${styles.blob4} ${getClass(styles.active4, styles.idle4)}`} />
      <div className={`${styles.blob} ${styles.blob2} ${getClass(styles.active2, styles.idle2)}`} />
      <div className={`${styles.blob} ${styles.blob5} ${getClass(styles.active5, styles.idle5)}`} />
      <div className={`${styles.blob} ${styles.blob3} ${getClass(styles.active3, styles.idle3)}`} />
    </div>
  );
}

export default React.memo(ChatBackground);
