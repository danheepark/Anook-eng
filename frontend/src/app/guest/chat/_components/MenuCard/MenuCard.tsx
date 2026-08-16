import React, { useState, useEffect } from 'react';
import styles from './MenuCard.module.css';
import { ArrowRightIcon, PlusIcon } from '@/components/icons';
import { useTranslation } from '@/app/useTranslation';
import { useUiStore } from '@/stores/useUiStore';

export interface MenuItem {
  id: number;
  name: string;
  price: number;
  priceUsd: number;
  category: 'MAIN' | 'SIDE' | 'DESSERT' | 'DRINK';
  allergens?: string | null;
  options?: any;
  available?: boolean;
}

// Complete fallback menu matching PMS database
const DEFAULT_MENU_ITEMS: MenuItem[] = [
  // MAIN (6)
  { id: 1, name: 'Beef Bulgogi Rice Bowl', price: 22000, priceUsd: 22.0, category: 'MAIN', allergens: 'Soy, Wheat' },
  { id: 2, name: 'Classic Cheeseburger', price: 15000, priceUsd: 15.0, category: 'MAIN', allergens: 'Wheat, Dairy' },
  { id: 3, name: 'Seafood Pasta', price: 25000, priceUsd: 25.0, category: 'MAIN', allergens: 'Wheat, Crustacean, Mollusk' },
  { id: 4, name: 'Steak Sandwich', price: 20000, priceUsd: 20.0, category: 'MAIN', allergens: 'Wheat, Dairy' },
  { id: 5, name: 'Truffle Mushroom Risotto', price: 28000, priceUsd: 28.0, category: 'MAIN', allergens: 'Dairy' },
  { id: 6, name: 'Caesar Salad', price: 14000, priceUsd: 14.0, category: 'MAIN', allergens: 'Dairy, Egg' },

  // SIDE (3)
  { id: 7, name: 'French Fries', price: 8000, priceUsd: 8.0, category: 'SIDE', allergens: null },
  { id: 8, name: 'Mozzarella Sticks', price: 10000, priceUsd: 10.0, category: 'SIDE', allergens: 'Wheat, Dairy' },
  { id: 9, name: 'Seasonal Fruit Plate', price: 12000, priceUsd: 12.0, category: 'SIDE', allergens: null },

  // DESSERT (3)
  { id: 10, name: 'New York Cheesecake', price: 12000, priceUsd: 12.0, category: 'DESSERT', allergens: 'Wheat, Dairy, Egg' },
  { id: 11, name: 'Chocolate Brownie', price: 10000, priceUsd: 10.0, category: 'DESSERT', allergens: 'Wheat, Dairy, Egg, Nuts' },
  { id: 12, name: 'Vanilla Ice Cream', price: 8000, priceUsd: 8.0, category: 'DESSERT', allergens: 'Dairy' },

  // DRINK (4)
  { id: 13, name: 'Coke', price: 4000, priceUsd: 4.0, category: 'DRINK', allergens: null },
  { id: 14, name: 'Americano', price: 5000, priceUsd: 5.0, category: 'DRINK', allergens: null },
  { id: 15, name: 'Orange Juice', price: 6000, priceUsd: 6.0, category: 'DRINK', allergens: null },
  { id: 16, name: 'Chamomile Tea', price: 5000, priceUsd: 5.0, category: 'DRINK', allergens: null },
];

interface CategoryMeta {
  key: 'MAIN' | 'SIDE' | 'DESSERT' | 'DRINK';
  labelEn: string;
  labelKo: string;
}

const CATEGORIES: CategoryMeta[] = [
  { key: 'MAIN', labelEn: 'MAINS & SPECIALS', labelKo: '메인 요리' },
  { key: 'SIDE', labelEn: 'APPETIZERS & SIDES', labelKo: '사이드 메뉴' },
  { key: 'DESSERT', labelEn: 'DESSERTS & SWEETS', labelKo: '디저트' },
  { key: 'DRINK', labelEn: 'BEVERAGES & COFFEE', labelKo: '음료 및 커피' },
];

export interface MenuCardProps {
  onAddItem?: (itemName: string) => void;
}

export default function MenuCard({ onAddItem }: MenuCardProps) {
  const { language } = useTranslation();
  const showToast = useUiStore((state) => state.showToast);
  const [menuItems, setMenuItems] = useState<MenuItem[]>(DEFAULT_MENU_ITEMS);
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({
    MAIN: true, // Default open first category
  });
  const [addedItemIds, setAddedItemIds] = useState<Record<number, boolean>>({});

  // Fetch live menu if available
  useEffect(() => {
    fetch('/api/pms/menus')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          const valid = data.filter((m: any) => m.category && ['MAIN', 'SIDE', 'DESSERT', 'DRINK'].includes(m.category));
          if (valid.length > 0) {
            setMenuItems(valid);
          }
        }
      })
      .catch(() => {
        // Fallback already set
      });
  }, []);

  const toggleCategory = (catKey: string) => {
    setOpenCategories((prev) => ({
      ...prev,
      [catKey]: !prev[catKey],
    }));
  };

  const handleToggleAll = () => {
    const areAllOpen = CATEGORIES.every((c) => openCategories[c.key]);
    const nextState: Record<string, boolean> = {};
    CATEGORIES.forEach((c) => {
      nextState[c.key] = !areAllOpen;
    });
    setOpenCategories(nextState);
  };

  const handleAdd = (item: MenuItem) => {
    if (onAddItem) {
      onAddItem(item.name);
    }
    setAddedItemIds((prev) => ({ ...prev, [item.id]: true }));
    setTimeout(() => {
      setAddedItemIds((prev) => ({ ...prev, [item.id]: false }));
    }, 900);

    const toastMsg = language === 'ko'
      ? `"${item.name}" 항목이 메시지에 추가되었습니다.`
      : `Added "${item.name}" to message.`;
    showToast(toastMsg, 'success');
  };

  const formatPrice = (item: MenuItem) => {
    if (language === 'ko') {
      return `${item.price.toLocaleString()}원`;
    }
    const usd = item.priceUsd || item.price / 1000;
    return `$${usd.toFixed(2)}`;
  };

  return (
    <div className={styles.menuCard}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerTitleRow}>
          <h3 className={styles.title}>MENU</h3>
          <span className={styles.headerIcon}>🍸</span>
        </div>
        <p className={styles.subtitle}>
          {language === 'ko' ? '24시간 룸서비스 다이닝' : '24/7 In-Room Dining & Bar'}
        </p>
      </div>

      {/* Categories Accordion */}
      <div className={styles.categoryList}>
        {CATEGORIES.map((cat) => {
          const items = menuItems.filter((m) => m.category === cat.key);
          const isOpen = !!openCategories[cat.key];
          const catTitle = language === 'ko' ? cat.labelKo : cat.labelEn;

          return (
            <div key={cat.key} className={styles.categoryGroup}>
              <button
                type="button"
                className={`${styles.categoryHeader} ${isOpen ? styles.categoryHeaderActive : ''}`}
                onClick={() => toggleCategory(cat.key)}
                aria-expanded={isOpen}
              >
                <div className={styles.categoryLeft}>
                  <span className={styles.countBadge}>[{items.length}]</span>
                  <span className={styles.categoryName}>{catTitle}</span>
                </div>
                <span className={`${styles.arrowIcon} ${isOpen ? styles.arrowIconOpen : ''}`}>
                  <ArrowRightIcon width={14} height={14} />
                </span>
              </button>

              {isOpen && (
                <div className={styles.itemsContainer}>
                  {items.map((item) => {
                    const isAdded = !!addedItemIds[item.id];
                    return (
                      <div key={item.id} className={styles.itemRow}>
                        <div className={styles.itemInfo}>
                          <div className={styles.itemName}>{item.name}</div>
                          <div className={styles.itemMeta}>
                            <span className={styles.itemPrice}>{formatPrice(item)}</span>
                            {item.allergens && (
                              <span className={styles.allergenBadge}>
                                {language === 'ko' ? `알러지: ${item.allergens}` : item.allergens}
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          className={`${styles.addButton} ${isAdded ? styles.addButtonAdded : ''}`}
                          onClick={() => handleAdd(item)}
                          title={language === 'ko' ? '주문에 추가' : 'Add to order'}
                          aria-label={`Add ${item.name} to message`}
                        >
                          {isAdded ? '✓' : <PlusIcon size={14} color="currentColor" />}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer Discover Button */}
      <div className={styles.footer}>
        <button type="button" className={styles.discoverButton} onClick={handleToggleAll}>
          {CATEGORIES.every((c) => openCategories[c.key])
            ? (language === 'ko' ? '카테고리 접기' : 'COLLAPSE MENU')
            : (language === 'ko' ? '전체 메뉴 보기' : 'DISCOVER OUR MENU')}
        </button>
      </div>
    </div>
  );
}
