// src/stores/cartStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type CartItem = {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  type: string;
  billing_cycle: string;
  category?: string;
  configuration?: {
    domain?: string;
    email_address?: string;
    [key: string]: any;
  };
};

type CartStore = {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  getTotal: () => number;
  getItemCount: () => number;
};

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (item) => {
        set((state) => {
          const existingItem = state.items.find((i) => i.productId === item.productId);
          
          if (existingItem) {
            // Update quantity if item already exists
            return {
              items: state.items.map((i) =>
                i.productId === item.productId
                  ? { ...i, quantity: i.quantity + (item.quantity || 1) }
                  : i
              ),
            };
          } else {
            // Add new item
            return {
              items: [...state.items, { ...item, quantity: item.quantity || 1 }],
            };
          }
        });
      },

      removeItem: (productId) => {
        set((state) => ({
          items: state.items.filter((item) => item.productId !== productId),
        }));
      },

      updateQuantity: (productId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(productId);
          return;
        }
        
        set((state) => ({
          items: state.items.map((item) =>
            item.productId === productId ? { ...item, quantity } : item
          ),
        }));
      },

      clearCart: () => {
        set({ items: [] });
      },

      getTotal: () => {
        const items = get().items;
        return items.reduce((total, item) => total + item.price * item.quantity, 0);
      },

      getItemCount: () => {
        const items = get().items;
        return items.reduce((count, item) => count + item.quantity, 0);
      },
    }),
    {
      name: 'cart-storage', // LocalStorage key
    }
  )
);
