import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
} from "react";
import { saveCart, loadCart } from "../utils/storage/cartStorage";

export interface CartItem {
  id: string | number;
  name: string;
  sku?: string;
  qtyunit?: string;
  MRP?: number;
  netPrice?: number;
  itemHSN?: string | number;
  quantity: number;
  
  // Additional required properties
  deptNmbr?: string;
  skucounter?: number;
  vatbit?: string;
  productgrpnmbr?: number;
  pluFlag?: string;
  qtyMux?: string;
  gstctype?: number;
  baseAmnt?: number;
  scflag?: number;
  status?: string;
  scantype?: string;
  
  // Index signature for any additional properties
  [key: string]: any;
}

interface CartContextType {
  cart: CartItem[];
  addToCart: (item: CartItem, quantity?: number) => void;
  removeFromCart: (id: string | number) => void;
  updateQuantity: (id: string | number, quantity: number) => void;
  clearCart: () => void;
  setCart: (items: CartItem[]) => void;
  cartLoaded: boolean;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCartState] = useState<CartItem[]>([]);
  const [cartLoaded, setCartLoaded] = useState(false);
  const isInitialLoadRef = useRef(true);
  const isSavingRef = useRef(false);
  const lastSavedCartRef = useRef<string>('');

  // Load cart from AsyncStorage on mount
  useEffect(() => {
    const load = async () => {
      try {
        const stored = await loadCart();
        if (Array.isArray(stored)) {
          setCartState(stored);
          // Store initial cart state for comparison
          lastSavedCartRef.current = JSON.stringify(stored);
        }
      } catch (err) {
        console.error("Failed to load cart from storage", err);
      } finally {
        setCartLoaded(true);
        isInitialLoadRef.current = false;
      }
    };
    load();
  }, []);

  // Save cart to AsyncStorage only after initial load is complete
  useEffect(() => {
    if (!cartLoaded || isInitialLoadRef.current || isSavingRef.current) return;

    // Compare current cart with last saved cart to prevent unnecessary saves
    const currentCartString = JSON.stringify(cart);
    if (currentCartString === lastSavedCartRef.current) {
      return; // Cart hasn't changed, skip save
    }

    const persistCart = async () => {
      if (isSavingRef.current) return; // Prevent concurrent saves
      isSavingRef.current = true;
      
      try {
        await saveCart(cart);
        lastSavedCartRef.current = currentCartString; // Update last saved state
      } catch (err) {
        console.error("Failed to save cart to storage:", err);
      } finally {
        isSavingRef.current = false;
      }
    };

    persistCart();
  }, [cart, cartLoaded]);

  const setCart = (items: CartItem[]) => {
    setCartState(items);
  };

  const addToCart = (item: CartItem, quantity: number = 1) => {
    setCartState(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i =>
          i.id === item.id
            ? { ...i, quantity: i.quantity + quantity }
            : i
        );
      }
      return [...prev, { ...item, quantity }];
    });
  };

  const removeFromCart = (id: string | number) => {
    setCartState(prev => prev.filter(i => i.id !== id));
  };

  const updateQuantity = (id: string | number, quantity: number) => {
    setCartState(prev =>
      prev.map(i =>
        i.id === id ? { ...i, quantity: Math.max(1, quantity) } : i
      )
    );
  };

  const clearCart = () => setCartState([]);

  return (
    <CartContext.Provider value={{ cart, addToCart, removeFromCart, updateQuantity, clearCart, setCart, cartLoaded }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}  