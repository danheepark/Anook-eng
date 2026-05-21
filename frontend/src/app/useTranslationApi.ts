import { useState, useEffect } from 'react';

export function useTranslationApi(text: string | null | undefined, targetLanguage: string) {
  const [translatedText, setTranslatedText] = useState<string | null>(text || null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!text || targetLanguage === 'ko') {
      setTranslatedText(text || null);
      return;
    }

    // Skip translation if target language is English and text contains no Korean characters (already in English)
    if (targetLanguage === 'en' && !/[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(text)) {
      setTranslatedText(text);
      return;
    }

    const cacheKey = `trans_${targetLanguage}_${text}`;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      setTranslatedText(cached);
      return;
    }

    let isMounted = true;

    const translate = async () => {
      setIsLoading(true);
      try {
        const res = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, target_language: targetLanguage }),
        });
        
        if (res.ok) {
          const data = await res.json();
          if (data.translated_text && isMounted) {
            setTranslatedText(data.translated_text);
            sessionStorage.setItem(cacheKey, data.translated_text);
          }
        }
      } catch (e) {
        console.error('Translation error:', e);
        if (isMounted) setTranslatedText(text); // fallback to original
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    
    translate();

    return () => {
      isMounted = false;
    };
  }, [text, targetLanguage]);

  return { translatedText, isLoading };
}
