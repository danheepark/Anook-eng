"use client";

import { useUiStore } from "@/stores/useUiStore";
import styles from "./Toast.module.css";
import { Check, X, Info } from "lucide-react";

export default function Toast() {
  const { isToastOpen, toastMessage, toastSubtitle, toastType, hideToast } = useUiStore();
  if (!isToastOpen) return null;

  // Compute Title & Description
  let title = '';
  let description = '';

  if (toastSubtitle) {
    title = toastMessage;
    description = toastSubtitle;
  } else {
    if (toastType === 'success') title = 'Success';
    else if (toastType === 'warning') title = 'Warning';
    else if (toastType === 'error') title = 'Error';
    else title = 'Notice';
    description = toastMessage;
  }

  const renderIcon = () => {
    switch (toastType) {
      case 'warning':
        return (
          <div className={`${styles.iconBadge} ${styles.warningIcon}`}>
            <span className={styles.exclamationMark}>!</span>
          </div>
        );
      case 'error':
        return (
          <div className={`${styles.iconBadge} ${styles.errorIcon}`}>
            <X size={12} color="#ffffff" strokeWidth={3} />
          </div>
        );
      case 'info':
        return (
          <div className={`${styles.iconBadge} ${styles.infoIcon}`}>
            <Info size={12} color="#ffffff" strokeWidth={3} />
          </div>
        );
      case 'success':
      default:
        return (
          <div className={`${styles.iconBadge} ${styles.successIcon}`}>
            <Check size={12} color="#ffffff" strokeWidth={3} />
          </div>
        );
    }
  };

  return (
    <div className={styles.toast} onClick={hideToast} role="alert">
      {renderIcon()}
      <div className={styles.textGroup}>
        <div className={styles.title}>{title}</div>
        {description && <div className={styles.description}>{description}</div>}
      </div>
    </div>
  );
}
