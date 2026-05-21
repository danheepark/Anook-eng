import { useUiStore } from '@/stores/useUiStore';
import ko from '@/locales/ko.json';
import en from '@/locales/en.json';
import zh from '@/locales/zh.json';
import ja from '@/locales/ja.json';

const dictionaries = {
  ko,
  en,
  zh,
  ja,
};

type Language = keyof typeof dictionaries;
type Dictionary = typeof ko;

export function useTranslation() {
  const language = useUiStore((state) => state.language) as Language;
  
  // Safe fallback to 'ko'
  const t = dictionaries[language] || dictionaries['ko'];

  return { t, language };
}

// Force reload comment
