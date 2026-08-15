import React from 'react';
import styles from './Pill.module.css';

export interface PillProps {
  options: string[];
  selectedOption?: string;
  onSelect: (option: string) => void;
  align?: 'center' | 'flex-start' | 'flex-end';
  disabled?: boolean;
  scrollable?: boolean;
  columns?: number;
}

export default function Pill({ 
  options, 
  selectedOption, 
  onSelect, 
  align = 'center', 
  disabled = false, 
  scrollable = false,
  columns 
}: PillProps) {
  if (!options || options.length === 0) return null;

  const containerClass = columns === 3 
    ? styles.grid3 
    : `${styles.container} ${scrollable ? styles.scrollContainer : ''}`;

  return (
    <div 
      className={containerClass} 
      style={{ justifyContent: (scrollable || columns) ? undefined : align }}
    >
      {options.map((option, index) => (
        <button 
          key={index} 
          className={`${styles.button} ${selectedOption === option ? styles.buttonSelected : ''}`}
          onClick={() => onSelect(option)}
          role="tab"
          aria-selected={selectedOption === option}
          disabled={disabled}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
