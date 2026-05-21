import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UiState {
  isSidebarOpen: boolean;
  isSidebarCollapsed: boolean;
  activeModal: string | null;
  activeTab: string;

  // Notification badge
  hasNewFrontdeskMessage: boolean;
  setHasNewFrontdeskMessage: (val: boolean) => void;

  // Toast properties
  isToastOpen: boolean;
  toastMessage: string;
  toastSubtitle?: string;
  toastType: 'success' | 'error';

  toggleSidebar: () => void;
  toggleCollapse: () => void;
  openModal: (modalId: string) => void;
  closeModal: () => void;
  setActiveTab: (tab: string) => void;

  // Toast actions
  showToast: (message: string, type?: 'success' | 'error', subtitle?: string) => void;
  hideToast: () => void;

  // i18n
  language: 'ko' | 'en' | 'zh' | 'ja';
  setLanguage: (lang: 'ko' | 'en' | 'zh' | 'ja') => void;
  chatLanguage: string;
  setChatLanguage: (lang: string) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      isSidebarOpen: false,
      isSidebarCollapsed: true,
      activeModal: null,
      activeTab: 'all',

      hasNewFrontdeskMessage: false,
      setHasNewFrontdeskMessage: (val) => set({ hasNewFrontdeskMessage: val }),

      isToastOpen: false,
      toastMessage: '',
      toastSubtitle: undefined,
      toastType: 'success',

      toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
      toggleCollapse: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
      openModal: (modalId) => set({ activeModal: modalId }),
      closeModal: () => set({ activeModal: null }),
      setActiveTab: (tab) => set({ activeTab: tab }),

      showToast: (message, type = 'success', subtitle) => {
        set({ isToastOpen: true, toastMessage: message, toastType: type, toastSubtitle: subtitle });
        setTimeout(() => {
          set({ isToastOpen: false });
        }, 3000); // 3초 뒤 자동 닫힘
      },
      hideToast: () => set({ isToastOpen: false }),

      language: 'ko',
      setLanguage: (lang) => set({ language: lang }),
      chatLanguage: 'ko',
      setChatLanguage: (lang) => set({ chatLanguage: lang }),
    }),
    {
      name: 'ui-storage',
      // 로컬스토리지에 저장할 상태 항목만 선택 (language, chatLanguage 저장)
      partialize: (state) => ({ language: state.language, chatLanguage: state.chatLanguage }),
    }
  )
);
