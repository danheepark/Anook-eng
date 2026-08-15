'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export default function HeaderSearchSlot({ children }: { children: React.ReactNode }) {
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setTarget(document.getElementById('header-search-slot'));
  }, []);

  if (!target) return null;
  return createPortal(children, target);
}
