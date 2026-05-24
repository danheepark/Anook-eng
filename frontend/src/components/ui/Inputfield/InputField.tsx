'use client';

import React from 'react';
import styles from './InputField.module.css';
import { SearchIcon, CancelIcon } from '@/components/icons';

export interface InputFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** 라벨 텍스트. 검색바 형태일 경우 표시되지 않습니다. */
  label?: string;
  /** 에러 메시지. 값이 들어오면 에러 UI로 변경되며 텍스트가 노출됩니다. */
  error?: string;
  /** 화면 밀림(Layout Shift) 방지를 위해 하단에 빈 20px 영역을 항상 확보할지 여부 */
  reserveError?: boolean;
  /** X 아이콘을 누를 때 추가로 호출할 콜백 */
  onClear?: () => void;
  /** textarea 렌더링 여부 */
  as?: 'input' | 'textarea';
  /** textarea 줄 수 */
  rows?: number;
}

export default function InputField({
  label,
  error,
  reserveError = false,
  disabled,
  className = '',
  onClear,
  as = 'input',
  rows,
  ...props
}: InputFieldProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [hasContent, setHasContent] = React.useState(!!props.value || !!props.defaultValue);

  React.useEffect(() => {
    if (props.value !== undefined) {
      setHasContent(!!props.value);
    }
  }, [props.value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setHasContent(!!e.target.value);
    if (props.onChange) {
      props.onChange(e);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (inputRef.current) {
      inputRef.current.value = '';
    }
    setHasContent(false);

    if (props.onChange) {
      // Create a mock event to trigger standard onChange with empty value
      const mockEvent = {
        target: {
          value: '',
          name: props.name || '',
        },
        currentTarget: {
          value: '',
          name: props.name || '',
        }
      } as React.ChangeEvent<HTMLInputElement>;
      props.onChange(mockEvent);
    }

    if (onClear) {
      onClear();
    }
  };

  // Default Input Field 렌더링
  const isError = !!error;
  
  const containerClasses = [
    styles.inputContainer,
    isError ? styles.inputContainerError : '',
    disabled ? styles.inputContainerDisabled : ''
  ].filter(Boolean).join(' ');

  const wrapperClasses = [
    styles.wrapper,
    reserveError ? styles.reserveError : '',
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={wrapperClasses}>
      <div className={styles.inputGroup}>
        {label && (
          <div className={styles.labelWrapper}>
            <label className={styles.label}>{label}</label>
          </div>
        )}
        
        <div className={`${containerClasses} ${as === 'textarea' ? styles.textareaContainer : ''}`}>
          {as === 'textarea' ? (
            <textarea 
              className={`${styles.inputElement} ${styles.textareaElement}`}
              disabled={disabled}
              rows={rows}
              {...(props as any)}
            />
          ) : (
            <input 
              className={styles.inputElement}
              disabled={disabled}
              {...props} 
            />
          )}
        </div>
      </div>
      
      {/* 에러 메시지 렌더링 (또는 reserveError일 때의 투명 공간) */}
      {(isError || reserveError) && (
        <div className={styles.errorWrapper}>
          {isError && <span className={styles.errorText}>{error}</span>}
        </div>
      )}
    </div>
  );
}
