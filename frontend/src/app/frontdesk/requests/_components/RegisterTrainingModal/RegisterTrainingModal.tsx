'use client';

import React, { useState, useEffect } from 'react';
import KnowledgeEditModal from '@/components/ui/Knowledge/KnowledgeEditModal';
import { useRegisterTraining } from './useRegisterTraining';
import { ModalOverlay, ModalCard } from '@/components/ui/Modal';
import Button from '@/components/ui/Button/Button';

interface RegisterTrainingModalProps {
  isOpen: boolean;
  onClose: () => void;
  departmentId?: string;
  summary?: string;
  roomNo?: string;
}

export default function RegisterTrainingModal({
  isOpen,
  onClose,
  departmentId = '',
  summary = '',
  roomNo = '',
  requestId,
}: RegisterTrainingModalProps & { requestId?: number }) {
  const { registerTraining } = useRegisterTraining();
  
  const [step, setStep] = useState<'select' | 'edit'>('select');
  const [staffMessages, setStaffMessages] = useState<any[]>([]);
  const [selectedMsgIds, setSelectedMsgIds] = useState<Set<string>>(new Set());
  const [loadingMsgs, setLoadingMsgs] = useState(false);

  useEffect(() => {
    if (isOpen && roomNo) {
      setStep('select');
      setLoadingMsgs(true);
      fetch(`/api/frontdesk/messages/rooms/${roomNo}/messages`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            const msgs = data.filter((m: any) => m.senderType === 'STAFF');
            setStaffMessages(msgs);
            setSelectedMsgIds(new Set(msgs.map((m: any) => String(m.id))));
          } else {
            setStaffMessages([]);
          }
        })
        .catch(err => {
          console.error('Failed to fetch messages', err);
          setStaffMessages([]);
        })
        .finally(() => {
          setLoadingMsgs(false);
        });
    }
  }, [isOpen, roomNo]);

  const handleToggle = (id: string) => {
    const newSet = new Set(selectedMsgIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedMsgIds(newSet);
  };

  const handleNext = () => {
    setStep('edit');
  };

  const handleSave = async (data: { domainCode: string; question: string; answer: string }) => {
    const success = await registerTraining({
      question: data.question,
      answer: data.answer,
      domainCode: data.domainCode,
      roomNo,
    });

    if (success) {
      if (requestId) {
        const saved = localStorage.getItem('registeredRagIds');
        const set = saved ? new Set(JSON.parse(saved)) : new Set();
        set.add(requestId);
        localStorage.setItem('registeredRagIds', JSON.stringify(Array.from(set)));
        window.dispatchEvent(new CustomEvent('ragRegistered', { detail: requestId }));
      }
      onClose();
    }
  };

  if (!isOpen) return null;

  const initialAnswer = staffMessages
    .filter(m => selectedMsgIds.has(String(m.id)))
    .map(m => m.content)
    .join('\n');

  if (step === 'select') {
    return (
      <ModalOverlay isOpen={isOpen} onClose={onClose}>
        <ModalCard size="md" onClose={onClose}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold' }}>학습할 상담 내용 선택</h2>
            <p style={{ fontSize: '14px', color: 'var(--color-gray-500)' }}>
              지식 라이브러리에 등록할 상담사(직원)의 메시지를 선택해주세요. AI와 고객의 메시지는 제외되었습니다.
            </p>
            
            {loadingMsgs ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-gray-400)' }}>대화 내역을 불러오는 중...</div>
            ) : staffMessages.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-gray-400)' }}>선택할 수 있는 상담사 메시지가 없습니다.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto' }}>
                {staffMessages.map(msg => (
                  <label key={msg.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', padding: '8px', backgroundColor: 'var(--color-gray-50)', borderRadius: '4px' }}>
                    <input 
                      type="checkbox" 
                      checked={selectedMsgIds.has(String(msg.id))} 
                      onChange={() => handleToggle(String(msg.id))}
                      style={{ marginTop: '4px' }}
                    />
                    <span style={{ fontSize: '14px', lineHeight: '1.5', wordBreak: 'break-all' }}>{msg.content}</span>
                  </label>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
              <Button variant="secondary" onClick={onClose}>취소</Button>
              <Button variant="primary" onClick={handleNext}>다음 단계로</Button>
            </div>
          </div>
        </ModalCard>
      </ModalOverlay>
    );
  }

  return (
    <KnowledgeEditModal
      isOpen={isOpen}
      onClose={onClose}
      mode="register"
      initialDomainCode={departmentId}
      initialQuestion={summary}
      initialAnswer={initialAnswer}
      onSave={handleSave}
    />
  );
}
