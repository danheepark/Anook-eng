import React from 'react';
import styles from './Logo.module.css';

interface LogoProps {
  className?: string;
  color?: string;
}

export default function Logo({ className = '', color }: LogoProps) {
  return (
    <span 
      className={`${styles.logo} ${className}`.trim()}
      style={color ? { color } : undefined}
    >
      ANOOK
    </span>
  );
}
