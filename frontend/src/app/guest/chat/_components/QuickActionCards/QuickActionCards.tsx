import React from 'react';
import styles from './QuickActionCards.module.css';
import { Home, Utensils } from 'lucide-react';
import { TaxiIcon } from '@/components/icons';
import { useTranslation } from '@/app/useTranslation';
import QuickActionCard from './QuickActionCard';

export interface QuickActionCardsProps {
  onSelect: (query: string) => void;
  disabled?: boolean;
}

export default function QuickActionCards({ onSelect, disabled = false }: QuickActionCardsProps) {
  const { t } = useTranslation();
  const cardsData = (t.guestChat as any)?.quickCards || {
    hk: { line1: 'Request', line2: 'extra towels', query: 'Request extra towels' },
    fb: { line1: 'Order', line2: 'room service', query: 'Order room service' },
    concierge: { line1: 'Book', line2: 'a taxi', query: 'Book a taxi' }
  };

  const cards: Array<{
    id: string;
    domain: 'HK' | 'FB' | 'CONCIERGE';
    icon: React.ElementType;
    line1: string;
    line2: string;
    query: string;
  }> = [
    {
      id: 'hk',
      domain: 'HK',
      icon: Home,
      line1: cardsData.hk?.line1 || 'Request',
      line2: cardsData.hk?.line2 || 'extra towels',
      query: cardsData.hk?.query || 'Request extra towels'
    },
    {
      id: 'fb',
      domain: 'FB',
      icon: Utensils,
      line1: cardsData.fb?.line1 || 'Order',
      line2: cardsData.fb?.line2 || 'room service',
      query: cardsData.fb?.query || 'Order room service'
    },
    {
      id: 'concierge',
      domain: 'CONCIERGE',
      icon: TaxiIcon,
      line1: cardsData.concierge?.line1 || 'Book',
      line2: cardsData.concierge?.line2 || 'a taxi',
      query: cardsData.concierge?.query || 'Book a taxi'
    }
  ];

  return (
    <div className={styles.container}>
      {cards.map((card) => (
        <QuickActionCard
          key={card.id}
          domain={card.domain}
          icon={card.icon}
          line1={card.line1}
          line2={card.line2}
          onClick={() => onSelect(card.query)}
          disabled={disabled}
        />
      ))}
    </div>
  );
}
