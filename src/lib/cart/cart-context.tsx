'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { CartItem } from './types';

const STORAGE_KEY = 'basa3d-cart';

type CartContextValue = {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  addItem: (item: Omit<CartItem, 'quantity'>, quantity: number) => void;
  updateQuantity: (variantId: string, quantity: number) => void;
  removeItem: (variantId: string) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

function readStoredCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // Corrupt JSON, private browsing, or storage disabled — fall back to an empty cart.
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  // Initial state is always [] on both server and first client render, matching Next.js SSR
  // output exactly — localStorage is only read after mount (useEffect), so there is no hydration
  // mismatch even without an isMounted flag (see phase-5.md decision #1).
  const [items, setItems] = useState<CartItem[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    setItems(readStoredCart());
    setIsInitialized(true);
  }, []);

  useEffect(() => {
    if (!isInitialized) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Storage disabled/full — cart just won't persist across reloads.
    }
  }, [items, isInitialized]);

  const addItem = useCallback((item: Omit<CartItem, 'quantity'>, quantity: number) => {
    setItems((current) => {
      const existing = current.find((row) => row.variantId === item.variantId);
      if (existing) {
        return current.map((row) => (row.variantId === item.variantId ? { ...row, quantity: row.quantity + quantity } : row));
      }
      return [...current, { ...item, quantity }];
    });
  }, []);

  const updateQuantity = useCallback((variantId: string, quantity: number) => {
    setItems((current) => {
      if (quantity <= 0) return current.filter((row) => row.variantId !== variantId);
      return current.map((row) => (row.variantId === variantId ? { ...row, quantity } : row));
    });
  }, []);

  const removeItem = useCallback((variantId: string) => {
    setItems((current) => current.filter((row) => row.variantId !== variantId));
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const itemCount = useMemo(() => items.reduce((sum, row) => sum + row.quantity, 0), [items]);
  const subtotal = useMemo(() => items.reduce((sum, row) => sum + row.price * row.quantity, 0), [items]);

  const value = useMemo(
    () => ({ items, itemCount, subtotal, addItem, updateQuantity, removeItem, clearCart }),
    [items, itemCount, subtotal, addItem, updateQuantity, removeItem, clearCart],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within a CartProvider.');
  return context;
}
