'use client';

import React, { useState } from 'react';
import KnowledgeItem from '@/components/ui/Knowledge/KnowledgeItem';
import KnowledgeModal from '@/components/ui/Knowledge/KnowledgeModal';
import KnowledgeEditModal from '@/components/ui/Knowledge/KnowledgeEditModal';
import ConfirmModal from '@/components/ui/Modal/ConfirmModal';
import Button from '@/components/ui/Button/Button';
import { useKnowledge, KnowledgeEntry } from '../../useKnowledge';
import styles from './KnowledgeLibraryTab.module.css';
import { useTranslation } from '@/app/useTranslation';

interface KnowledgeLibraryTabProps {
  domainCode: string; // 'ALL' 또는 도메인 코드
  searchValue: string;
  filterValue: string;
}

export default function KnowledgeLibraryTab({ domainCode, searchValue, filterValue }: KnowledgeLibraryTabProps) {
  const { t } = useTranslation();
  const { data, loading, error, createEntry, updateEntry, deleteEntry } = useKnowledge(domainCode === 'ALL' ? undefined : domainCode);
  const [selectedKnowledge, setSelectedKnowledge] = useState<KnowledgeEntry | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);

  const ALL_OPTIONS = [
    { value: 'HK', label: t.adminPage.rag.tabs.HK },
    { value: 'FB', label: t.adminPage.rag.tabs.FB },
    { value: 'FACILITY', label: t.adminPage.rag.tabs.FACILITY },
    { value: 'CONCIERGE', label: t.adminPage.rag.tabs.CONCIERGE },
    { value: 'FRONT', label: t.adminPage.rag.tabs.FRONT },
    { value: 'EMERGENCY', label: t.adminPage.rag.tabs.EMERGENCY },
    { value: 'COMMON', label: t.adminPage.rag.tabs.COMMON }
  ];

  // 현재 탭의 특성에 따라 domainOptions 생성 (지식 추가 시 사용)
  const domainOptions = domainCode && domainCode !== 'ALL'
    ? ALL_OPTIONS.filter(opt => opt.value === domainCode)
    : ALL_OPTIONS;

  // 검색 필터 적용
  let filteredData = data.filter(item => 
    item.question.toLowerCase().includes(searchValue.toLowerCase()) ||
    item.answer.toLowerCase().includes(searchValue.toLowerCase())
  );

  // 정렬 적용 (최신순 등)
  if (filterValue === 'latest') {
    filteredData.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  } else {
    // 기본적으로 id 등 다른 기준으로 정렬할 수 있으나 생략
  }

  return (
    <div className={styles.container}>
      {/* Content Section */}
      <div className={styles.contentSection}>
        <div className={styles.buttonWrapper}>
          <Button 
            variant="primary" 
            onClick={() => {
              setIsCreatingNew(true);
              setIsEditModalOpen(true);
            }}
          >
            {t.adminPage.rag.addKnowledge}
          </Button>
        </div>

        {loading ? (
          <div className={styles.statusMessage}>{t.common.loading}</div>
        ) : error ? (
          <div className={styles.errorMessage}>{error}</div>
        ) : (
          <div className={styles.listContainer}>
            {filteredData.length === 0 ? (
              <div className={styles.emptyMessage}>{t.adminPage.rag.empty}</div>
            ) : (
              filteredData.map((item) => (
                <KnowledgeItem
                  key={item.id}
                  id={item.id}
                  domainCode={item.domainCode}
                  question={item.question}
                  answer={item.answer}
                  updatedAt={new Date(item.updatedAt).toLocaleDateString()}
                  onClick={() => setSelectedKnowledge(item)}
                  onEdit={() => {
                    setSelectedKnowledge(item);
                    setIsEditModalOpen(true);
                  }}
                  onDelete={() => {
                    setDeleteTargetId(item.id);
                  }}
                />
              ))
            )}
          </div>
        )}
      </div>

      {/* View Modal */}
      {selectedKnowledge && !isEditModalOpen && (
        <KnowledgeModal
          isOpen={!!selectedKnowledge}
          onClose={() => setSelectedKnowledge(null)}
          domainCode={selectedKnowledge.domainCode}
          question={selectedKnowledge.question}
          answer={selectedKnowledge.answer}
          updatedAt={new Date(selectedKnowledge.updatedAt).toLocaleDateString()}
          onEdit={() => setIsEditModalOpen(true)}
          onDelete={() => {
            setDeleteTargetId(selectedKnowledge.id);
          }}
        />
      )}

      {/* Edit / Create Modal */}
      {isEditModalOpen && (
        <KnowledgeEditModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setSelectedKnowledge(null);
            if (isCreatingNew) {
              setIsCreatingNew(false);
            }
          }}
          domainOptions={domainOptions}
          initialDomainCode={isCreatingNew ? (domainCode === 'ALL' ? 'HK' : domainCode) : selectedKnowledge?.domainCode}
          initialQuestion={isCreatingNew ? '' : selectedKnowledge?.question}
          initialAnswer={isCreatingNew ? '' : selectedKnowledge?.answer}
          onSave={async (formData) => {
            if (isCreatingNew) {
              await createEntry(formData);
            } else if (selectedKnowledge) {
              await updateEntry(selectedKnowledge.id, formData);
            }
            setIsEditModalOpen(false);
            setIsCreatingNew(false);
            setSelectedKnowledge(null);
          }}
        />
      )}

      {/* Delete Confirm Modal */}
      <ConfirmModal
        isOpen={deleteTargetId !== null}
        onClose={() => setDeleteTargetId(null)}
        onConfirm={async () => {
          if (deleteTargetId !== null) {
            await deleteEntry(deleteTargetId);
            setDeleteTargetId(null);
            if (selectedKnowledge && selectedKnowledge.id === deleteTargetId) {
              setSelectedKnowledge(null);
            }
          }
        }}
        title="삭제 확인"
        subtitle={t.adminPage.rag.deleteConfirm}
        status="danger"
        confirmText="삭제"
      />
    </div>
  );
}
