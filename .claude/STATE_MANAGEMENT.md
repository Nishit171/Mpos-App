# STATE_MANAGEMENT.md — State Management

## 1. Philosophy

This app uses **React Context API only**. No Redux. No Zustand. No MobX.

**Rationale:** The POS app has two truly global state concerns — authentication and the active cart. Everything else is either local component state or server state (fetched on demand). Introducing a global state library for two contexts adds tooling overhead, boilerplate, and complexity with no benefit.

**When to reconsider:** If the number of global state slices grows beyond 4–5, or if cross-context state synchronization becomes complex, migrate to Zustand (not Redux — Zustand has lower API surface and no boilerplate).

---

## 2. State Domains and Ownership

| State Domain | Owner | Storage |
|---|---|---|
| Authentication (user, token) | `AuthContext` | AsyncStorage |
| Active cart items | `CartContext` | AsyncStorage |
| Order tabs (multiple carts) | `QuickBillingHomePage` local state | AsyncStorage |
| Customer info (name, phone) | `QuickBillingHomePage` local state | None (session only) |
| Bill type preference | `QuickBillingHomePage` local state | AsyncStorage |
| Checkout UI state (open/closed) | `QuickBillingHomePage` local state | None |
| Product search results | `QuickBillingSearchBar` local state | None |
| Barcode dialog state | `BarcodeDialog` local state | None |
| Payment form state | `QuickBillingCheckout` local state | None |
| UPI config | `QuickBillingCheckout` local state | Backend |

---

## 3. AuthContext

**File:** `src/context/auth-context.tsx`

### Interface

```typescript
interface AuthUser {
  token: string;
  orgName?: string;
  storeName?: string;
  tenantId?: string;
  [key: string]: any;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (token: string, userData: object) => Promise<void>;
  logout: () => Promise<void>;
}
```

### Initialization Sequence

```typescript
// On AuthProvider mount
useEffect(() => {
  const initAuth = async () => {
    try {
      const token = await getToken();
      if (!token) {
        setIsLoading(false);
        return;
      }

      // Validate token with backend
      await AuthApi.verifyAuth();
      const orgName = await AsyncStorage.getItem('orgName');
      const storeName = await AsyncStorage.getItem('storeName');
      const tenantId = await AsyncStorage.getItem('tenantId');

      setUser({ token, orgName, storeName, tenantId });
    } catch (error) {
      // Token invalid or expired
      await removeToken();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  initAuth();
}, []);
```

### Login

```typescript
const login = async (token: string, userData: object) => {
  await setToken(token);
  await AsyncStorage.multiSet([
    ['orgName', userData.orgName ?? ''],
    ['storeName', userData.storeName ?? ''],
    ['tenantId', userData.tenantId ?? ''],
  ]);
  setUser({ token, ...userData });
};
```

### Logout

```typescript
const logout = async () => {
  await removeToken();
  await AsyncStorage.multiRemove(['orgName', 'storeName', 'tenantId', 'cart', 'pos_orders']);
  setUser(null);
};
```

**Logout clears cart and orders.** This is intentional — a new cashier session should start clean.

### Consuming AuthContext

```typescript
const { user, login, logout, isLoading } = useAuth();

// useAuth hook (in auth-context.tsx)
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
```

---

## 4. CartContext

**File:** `src/context/cart-context.tsx`

### Interface

```typescript
interface CartItem {
  id: string | number;
  name: string;
  sku?: string;
  qtyunit?: string;
  MRP?: number;
  netPrice?: number;
  itemHSN?: string | number;
  quantity: number;
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
  remainingqty?: string;
  [key: string]: any;
}

interface CartContextValue {
  cartItems: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (id: string | number) => void;
  updateQuantity: (id: string | number, quantity: number) => void;
  clearCart: () => void;
  setCart: (items: CartItem[]) => void;
  cartLoaded: boolean;
}
```

### addToCart Logic

```typescript
const addToCart = (item: CartItem) => {
  setCartItems(prev => {
    const existingIndex = prev.findIndex(i => i.id === item.id);
    if (existingIndex >= 0) {
      // Increment quantity
      const updated = [...prev];
      updated[existingIndex] = {
        ...updated[existingIndex],
        quantity: updated[existingIndex].quantity + 1,
      };
      return updated;
    }
    return [...prev, { ...item, quantity: 1 }];
  });
};
```

**Identity check uses `item.id`.** If the backend returns products with non-unique IDs (variants of the same product), the `id` may need to be `sku` or a composite key. This is a known edge case to verify.

### Persistence Pattern

```typescript
const lastSavedCartRef = useRef<string>('');

useEffect(() => {
  if (!cartLoaded) return;  // Don't save during hydration

  const serialized = JSON.stringify(cartItems);
  if (serialized === lastSavedCartRef.current) return;  // No change

  lastSavedCartRef.current = serialized;
  saveCart(cartItems);  // src/utils/storage/cartStorage.ts
}, [cartItems, cartLoaded]);
```

**Why `lastSavedCartRef`:** Prevents redundant AsyncStorage writes when `setCartItems` is called but produces the same cart (rare but possible in rapid state updates).

### Hydration

```typescript
useEffect(() => {
  const hydrateCart = async () => {
    const savedCart = await loadCart();  // Returns [] on error
    setCartItems(savedCart);
    setCartLoaded(true);
  };
  hydrateCart();
}, []);
```

**Never render cart-dependent components before `cartLoaded === true`.** Display a loading state or nothing.

### Consuming CartContext

```typescript
const { cartItems, addToCart, removeFromCart, updateQuantity, clearCart, cartLoaded } = useCart();

// useCart hook (in cart-context.tsx)
export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within CartProvider');
  return context;
};
```

---

## 5. Local State Patterns

### Order Tabs State (QuickBillingHomePage)

```typescript
interface Order {
  id: string;           // UUID
  name: string;         // "Order 1", "Order 2"
  items: CartItem[];
  customerName: string;
  customerPhone: string;
  billType: 'taxInvoice' | 'invoice';
  billReference?: string;  // Backend hold order reference
}

const [orders, setOrders] = useState<Order[]>([defaultOrder]);
const [activeOrderId, setActiveOrderId] = useState<string>(defaultOrder.id);
```

**Persistence:**
```typescript
// On every orders change
useEffect(() => {
  AsyncStorage.setItem('pos_orders', JSON.stringify(orders));
}, [orders]);
```

**Hydration:**
```typescript
useEffect(() => {
  const restore = async () => {
    const saved = await AsyncStorage.getItem('pos_orders');
    if (saved) {
      const parsed: Order[] = JSON.parse(saved);
      setOrders(parsed);
      setActiveOrderId(parsed[0].id);
      // Restore cart context with active order's items
      setCart(parsed[0].items);
    }
  };
  restore();
}, []);
```

### UI Modal State

```typescript
// Standard pattern for modal/drawer visibility
const [showBarcodeDialog, setShowBarcodeDialog] = useState(false);
const [showCheckout, setShowCheckout] = useState(false);
const [showReturnDrawer, setShowReturnDrawer] = useState(false);
const [showProductDetail, setShowProductDetail] = useState(false);
```

Never combine multiple boolean UI states into a single enum — it's harder to reason about edge cases (e.g., what happens when two modals are "open"?).

---

## 6. Server State (Not Managed in Context)

These are fetched on demand and stored in component-local state. They are not global:

| Data | Fetched By | When |
|---|---|---|
| Product search results | QuickBillingSearchBar | On debounced input change |
| Refreshed cart totals | QuickBillingCheckout | On checkout open |
| UPI config | QuickBillingCheckout | On mount + upiRefreshTrigger |
| Return reasons | ReturnOrderDrawer | On drawer open |
| GST/CIN config | QuickBillingCheckout | On checkout open |
| Hold order details | QuickBillingHomePage | On tab restore |

**Pattern:**

```typescript
const [upiId, setUpiId] = useState<string | null>(null);
const [upiLoading, setUpiLoading] = useState(false);

useEffect(() => {
  const fetchUpi = async () => {
    setUpiLoading(true);
    try {
      const data = await orderService.getUpiId();
      setUpiId(data.upiId ?? null);
    } catch {
      setUpiId(null);
    } finally {
      setUpiLoading(false);
    }
  };
  fetchUpi();
}, [upiRefreshTrigger]);
```

---

## 7. State Reset on Checkout Complete

After a successful order:

```typescript
const handleOrderComplete = () => {
  // 1. Clear cart
  clearCart();

  // 2. Reset current order tab
  setOrders(prev => prev.map(order =>
    order.id === activeOrderId
      ? { ...order, items: [], customerName: '', customerPhone: '' }
      : order
  ));

  // 3. Close checkout
  setShowCheckout(false);

  // 4. Remove backend hold order
  if (activeOrder.billReference) {
    holdOrderService.removeHoldOrder({ billReference: activeOrder.billReference });
  }
};
```

**Order: clear cart FIRST, then update tab state.** CartContext `setCart` triggers AsyncStorage write; if we update tab state first and app crashes, cart might be out of sync.

---

## 8. State Anti-Patterns to Avoid

| Anti-Pattern | Why It's Wrong | Correct Pattern |
|---|---|---|
| Storing derived values (totals) in state | Becomes stale. Recalculate from source. | Compute in `useMemo` from cart items |
| Reading AsyncStorage synchronously | AsyncStorage is always async | Always `await` or use `useEffect` |
| Setting state in render | Causes infinite loops | Use `useEffect` or event handlers |
| Nested context providers within feature components | Context should wrap at root | All context providers in App.tsx |
| Duplicate state across context and local state | Single source of truth rule | Pick one owner, pass as props |
| Using `cartItems.length` as a key | Unstable, causes remounts | Use stable `item.id` as key |

---

## 9. Performance Considerations

### Prevent unnecessary re-renders in CartContext consumers

```typescript
// Memoize callbacks in CartProvider to prevent consumer re-renders
const addToCart = useCallback((item: CartItem) => { ... }, []);
const removeFromCart = useCallback((id) => { ... }, []);
const updateQuantity = useCallback((id, qty) => { ... }, []);
const clearCart = useCallback(() => { ... }, []);
const setCart = useCallback((items) => { ... }, []);
```

### Split CartContext if needed

If `cartItems` changes cause unrelated components to re-render, split into:
- `CartItemsContext` — just the items array
- `CartActionsContext` — just the action functions (stable refs, never changes)

Action consumers subscribe to `CartActionsContext` and never re-render on item changes.

### useMemo for derived totals

```typescript
const orderTotal = useMemo(
  () => cartItems.reduce((sum, item) => sum + (item.netPrice ?? 0) * item.quantity, 0),
  [cartItems]
);
```

Note: This is a client-side estimate. The authoritative total comes from `refreshCart()`. Use this only for display estimates, never for order placement.
