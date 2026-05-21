'use client';

import { useEffect, useRef } from 'react';
import { useTranslation } from '@/app/useTranslation';
import { useUiStore } from '@/stores/useUiStore';

export default function TitleUpdater() {
  const { language } = useTranslation();
  const setLanguage = useUiStore((state) => state.setLanguage);
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      // Auto-detect browser language on first load
      if (typeof window !== 'undefined' && window.navigator && window.navigator.language) {
        const browserLang = window.navigator.language.toLowerCase();
        // If the browser language is not Korean, default to English
        if (!browserLang.startsWith('ko')) {
          setLanguage('en');
        }
      }
    }
  }, [setLanguage]);

  useEffect(() => {
    document.title = language === 'ko' 
      ? '아늑 - AI 호텔 관리 시스템' 
      : 'Anook - AI Hotel Management System';
  }, [language]);

  return null;
}
