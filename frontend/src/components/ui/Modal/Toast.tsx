"use client";

import { useUiStore } from "@/stores/useUiStore";
import styles from "./Toast.module.css";
import { Check, X } from "lucide-react";

export default function Toast() {
  const { isToastOpen, toastMessage, toastSubtitle, toastType, hideToast } = useUiStore();
  if (!isToastOpen) return null;

  return (
    <div className={`${styles.toast} ${toastType === 'success' ? styles.success : styles.error}`} onClick={hideToast}>
      <div 
        className={styles.iconContainer} 
        style={{ 
          backgroundColor: toastType === 'success' 
            ? 'color-mix(in srgb, var(--color-success, #10B981) 15%, #fff)' 
            : 'color-mix(in srgb, var(--color-error, #EF4444) 15%, #fff)' 
        }}
      >
        {toastType === 'success' ? (
          <Check size={20} color="var(--color-success, #10B981)" strokeWidth={3} />
        ) : (
          <X size={20} color="var(--color-error, #EF4444)" strokeWidth={3} />
        )}
      </div>
      
      <div className={styles.textGroup}>
        <h2 className={styles.title}>{toastMessage}</h2>
        {toastSubtitle && <p className={styles.subtitle}>{toastSubtitle}</p>}
      </div>
    </div>
  );
}
