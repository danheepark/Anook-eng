import React, { useState, useRef, useEffect } from 'react';
import styles from './ChatInput.module.css';
import { SendIcon, MicIcon, StopIcon, PlusIcon, CancelIcon, CameraIcon, ImageIcon } from '@/components/icons';
import { useUiStore } from '@/stores/useUiStore';

const MAX_IMAGE_SIZE_MB = 5;
const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;

const LABELS = {
  ko: {
    placeholder: '무엇이든 물어보세요...',
    listening: '듣고 있습니다...',
    camera: '사진 찍기',
    gallery: '보관함',
    imageTooLarge: `이미지 크기가 ${MAX_IMAGE_SIZE_MB}MB를 초과합니다. 더 작은 이미지를 선택해 주세요.`,
    speechUnsupported: '현재 브라우저에서는 음성 인식을 지원하지 않습니다.',
  },
  en: {
    placeholder: 'Ask me anything...',
    listening: 'Listening...',
    camera: 'Take Photo',
    gallery: 'Gallery',
    imageTooLarge: `Image exceeds ${MAX_IMAGE_SIZE_MB}MB. Please select a smaller image.`,
    speechUnsupported: 'Speech recognition is not supported in this browser.',
  },
};

export interface ChatInputProps {
  placeholder?: string;
  onSend?: (text: string, imageFile?: File) => void;
  isTyping?: boolean;
  onStop?: () => void;
  onUserTyping?: (isTyping: boolean) => void;
  isStaff?: boolean;
}

export default function ChatInput({ onSend, isTyping, onStop, onUserTyping, isStaff }: ChatInputProps) {
  const [value, setValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [sizeError, setSizeError] = useState(false);
  const [shouldAutoSend, setShouldAutoSend] = useState(false);
  
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const language = useUiStore((state) => state.language) as 'ko' | 'en';
  const l = LABELS[language] || LABELS.ko;

  React.useEffect(() => {
    if (onUserTyping) {
      onUserTyping(isFocused || value.trim().length > 0 || imageFile !== null);
    }
  }, [isFocused, value, imageFile, onUserTyping]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = false;
        recognitionRef.current.interimResults = true;
        
        recognitionRef.current.onresult = (event: any) => {
          let finalTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            }
          }
          if (finalTranscript) {
            setValue(prev => (prev ? prev + ' ' : '') + finalTranscript);
          }
        };

        recognitionRef.current.onerror = (event: any) => {
          console.error('Speech recognition error', event.error);
          setIsRecording(false);
        };

        recognitionRef.current.onend = () => {
          setIsRecording(false);
          setShouldAutoSend(true);
        };
      }
    }
  }, []);

  const toggleRecording = () => {
    if (!recognitionRef.current) {
      alert(l.speechUnsupported);
      return;
    }
    
    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      recognitionRef.current.lang = language === 'ko' ? 'ko-KR' : 'en-US';
      recognitionRef.current.start();
      setIsRecording(true);
    }
  };

  const handleSend = () => {
    if ((value.trim() || imageFile) && onSend && !isTyping) {
      onSend(value, imageFile || undefined);
      setValue('');
      handleRemoveImage();
      if (isRecording && recognitionRef.current) {
        recognitionRef.current.stop();
        setIsRecording(false);
      }
    }
  };

  useEffect(() => {
    if (shouldAutoSend) {
      if (value.trim()) {
        handleSend();
      }
      setShouldAutoSend(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldAutoSend, value]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === 'Enter') {
      handleSend();
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // 파일 크기 검증
      if (file.size > MAX_IMAGE_SIZE_BYTES) {
        setSizeError(true);
        setTimeout(() => setSizeError(false), 4000);
        if (cameraInputRef.current) cameraInputRef.current.value = '';
        if (galleryInputRef.current) galleryInputRef.current.value = '';
        setIsMenuOpen(false);
        return;
      }
      setSizeError(false);
      setImageFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    if (galleryInputRef.current) galleryInputRef.current.value = '';
    setIsMenuOpen(false);
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setSizeError(false);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  return (
    <div className={styles.container}>
      {/* 용량 초과 에러 토스트 */}
      {sizeError && (
        <div className={styles.sizeErrorToast}>
          {l.imageTooLarge}
        </div>
      )}

      {/* 이미지 미리보기 (첨부 성공 시) */}
      {previewUrl && (
        <div className={styles.previewContainer}>
          <img src={previewUrl} alt="Preview" className={styles.previewImage} />
          <button className={styles.removeImageButton} onClick={handleRemoveImage} aria-label="이미지 삭제">
            <CancelIcon width={12} height={12} color="#fff" />
          </button>
          {imageFile && (
            <span className={styles.previewFileSize}>{formatFileSize(imageFile.size)}</span>
          )}
        </div>
      )}

      <div className={`${styles.wrapper} ${isStaff ? styles.staffWrapper : ''}`} ref={menuRef}>
        {!isStaff && (
          <button 
            className={`${styles.attachButton} ${isMenuOpen ? styles.attachButtonActive : ''}`}
            onClick={() => setIsMenuOpen(prev => !prev)}
            aria-label="첨부 메뉴 열기"
          >
            <PlusIcon size={24} color="#b4a8c9" />
          </button>
        )}

        {!isStaff && isMenuOpen && (
          <div className={styles.attachMenu}>
            <button className={styles.menuItem} onClick={() => cameraInputRef.current?.click()}>
              <CameraIcon size={20} color="#b4a8c9" />
              <span>{l.camera}</span>
            </button>
            <button className={styles.menuItem} onClick={() => galleryInputRef.current?.click()}>
              <ImageIcon size={20} color="#b4a8c9" />
              <span>{l.gallery}</span>
            </button>
          </div>
        )}

        <input 
          type="file" 
          accept="image/*" 
          capture="environment"
          ref={cameraInputRef} 
          style={{ display: 'none' }} 
          onChange={handleImageSelect}
        />
        <input 
          type="file" 
          accept="image/*" 
          ref={galleryInputRef} 
          style={{ display: 'none' }} 
          onChange={handleImageSelect}
        />
        <input 
          className={styles.input} 
          placeholder={isRecording ? l.listening : l.placeholder} 
          value={value} 
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        />
        <div className={styles.actionGroup}>
          {isStaff ? (
            <button className={`${isStaff ? styles.staffIconButton : styles.iconButton} ${styles.sendButton}`} onClick={handleSend} aria-label="메시지 전송" style={{ opacity: value.trim() ? 1 : 0.5, cursor: value.trim() ? 'pointer' : 'default' }}>
              <SendIcon size={24} color="#b4a8c9" />
            </button>
          ) : isTyping ? (
            <button className={`${styles.iconButton} ${styles.stopButton}`} onClick={onStop} aria-label="답변 멈추기">
              <StopIcon size={24} color="#EF4444" />
            </button>
          ) : (value.trim() === '' && !imageFile && !isRecording) ? (
            <button className={`${styles.iconButton} ${styles.micButton}`} onClick={toggleRecording} aria-label="음성 입력 시작">
              <MicIcon size={24} color="#b4a8c9" />
            </button>
          ) : isRecording ? (
             <button className={`${styles.iconButton} ${styles.micRecordingButton}`} onClick={toggleRecording} aria-label="음성 입력 중지">
              <div className={styles.recordingDot} />
            </button>
          ) : (
            <button className={`${styles.iconButton} ${styles.sendButton}`} onClick={handleSend} aria-label="메시지 전송">
              <SendIcon size={24} color="#b4a8c9" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
