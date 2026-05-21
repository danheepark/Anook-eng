import React, { useState, useEffect } from 'react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import styles from './ProgressIndicator.module.css';
import { useTranslation } from '@/app/useTranslation';

// 리렌더링 방지: 텍스트 업데이트와 완전 독립적으로 재생
const MoonAnimation = React.memo(() => (
  <div className={styles.lottieAvatar}>
    <DotLottieReact
      src="/moon_animation.lottie"
      loop={true}
      autoplay={false}
      dotLottieRefCallback={(instance) => {
        if (!instance) return;
        const startFrom100 = () => {
          try {
            instance.setFrame(100);
            instance.play();
          } catch (e) { /* not ready */ }
        };
        if (instance.addEventListener) {
          instance.addEventListener('load', startFrom100);
        }
      }}
    />
  </div>
));
MoonAnimation.displayName = 'MoonAnimation';

const BreathingText = ({ text }: { text: string }) => {
  const [displayedText, setDisplayedText] = useState(text);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    if (text !== displayedText) {
      setIsTransitioning(true);
      const timer = setTimeout(() => {
        setDisplayedText(text);
        setIsTransitioning(false);
      }, 500); // 부드러운 전환을 위해 500ms로 늘림
      return () => clearTimeout(timer);
    }
  }, [text, displayedText]);

  return (
    <span className={isTransitioning ? styles.fadeOut : styles.fadeIn}>
      <span className={styles.breathingText}>
        {displayedText}
      </span>
    </span>
  );
};

interface ProgressIndicatorProps {
  domains?: string[];
}

function ProgressIndicator({ domains = [] }: ProgressIndicatorProps) {
  const { t } = useTranslation();

  const getLabelText = () => {
    if (!domains || domains.length === 0) {
      return t.guestChat.progress.checking;
    }
    
    const domainDict = t.guestChat.progress.domains as Record<string, string>;
    const labels = domains
      .map(code => domainDict[code] || code)
      .filter(Boolean);
      
    if (labels.length === 0) {
      return t.guestChat.progress.checking;
    }

    const domainText = labels.join(', ');
    return `${t.guestChat.progress.forwardingPrefix}${domainText}${t.guestChat.progress.forwardingSuffix}`;
  };

  return (
    <div className={styles.wrapper}>
      <MoonAnimation />
      <span className={styles.description}>
        <BreathingText text={getLabelText()} />
      </span>
    </div>
  );
}

export default React.memo(ProgressIndicator);
