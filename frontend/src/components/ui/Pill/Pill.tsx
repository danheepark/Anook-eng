import React from 'react';
import styles from './Pill.module.css';

export interface PillProps {
  options: string[];
  selectedOption?: string;
  onSelect: (option: string) => void;
  align?: 'center' | 'flex-start' | 'flex-end';
  disabled?: boolean;
}

export default function Pill({ options, selectedOption, onSelect, align = 'center', disabled = false }: PillProps) {
  if (!options || options.length === 0) return null;

  return (
    <div className={styles.container} style={{ justifyContent: align }}>
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
