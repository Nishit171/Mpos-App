# UI_COMPONENT_SYSTEM.md — UI Component System

## 1. Component Tier System

All components in this app belong to one of three tiers. Respect tier boundaries — a Tier 1 primitive must never call an API; a Tier 2 feature component must never initiate navigation.

| Tier | Location | Rules |
|---|---|---|
| 1 — Primitives | `src/components/sections/ui/` | Stateless, props-only, no context, no API |
| 2 — Feature Components | `src/components/sections/quick-billing/`, `home-page/` | Stateful, may read context, callbacks for data ops |
| 3 — Screen Containers | `src/screens/` | Orchestrate data, own API calls, pass to Tier 2 |

---

## 2. Existing UI Primitives

### `button.tsx`
A styled `TouchableOpacity` wrapper.

```typescript
interface ButtonProps {
  onPress: () => void;
  label: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
}
```

**Usage rules:**
- Use `disabled` prop to prevent double-taps during async operations
- Use `loading` prop during API calls to show spinner
- Never use raw `TouchableOpacity` for buttons that map to user actions — use this component

### `input.tsx`
A styled `TextInput` with label and error state.

```typescript
interface InputProps {
  value: string;
  onChangeText: (text: string) => void;
  label?: string;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  error?: string;
  editable?: boolean;
  maxLength?: number;
  secureTextEntry?: boolean;
}
```

**Usage rules:**
- Always set `keyboardType='numeric'` for quantity, price, and phone inputs
- Use `error` prop for validation feedback — never render error text manually beside this component

### `avatar.tsx`
Circular user avatar with initials fallback.

```typescript
interface AvatarProps {
  name?: string;
  imageUri?: string;
  size?: number;
}
```

### `dropdown-menu.tsx`
Dropdown/select component built on `@react-native-picker/picker`.

```typescript
interface DropdownMenuProps {
  options: Array<{ label: string; value: string }>;
  selectedValue: string;
  onSelect: (value: string) => void;
  placeholder?: string;
}
```

### `portal.tsx` / `PortalModal.tsx`
Portal-based overlay rendering using `react-native-root-siblings`. Renders content outside the normal component tree to avoid z-index issues.

```typescript
// Use PortalModal for any overlay that must appear above the camera view
<PortalModal visible={isOpen} onClose={onClose}>
  {children}
</PortalModal>
```

**Critical:** Use `PortalModal` for any overlay that renders on top of the Vision Camera view. Standard `Modal` from React Native may not render above the camera surface on Android.

---

## 3. Feature Component Reference

### QuickBillingHomePage
**Location:** `src/components/sections/quick-billing/QuickBillingHomePage.tsx`
**Lines:** ~1127 (decomposition needed — see APP_ARCHITECTURE.md)

Primary POS screen. Manages:
- Order tab state
- Customer info state
- Cart refresh flow
- Modal/drawer open/close state
- Checkout coordination

**Props:** None (root screen component)
**Consumes:** `AuthContext`, `CartContext`

---

### QuickBillingCartTable
**Location:** `src/components/sections/quick-billing/QuickBillingCartTable.tsx`

Renders the active cart items in a scrollable list.

```typescript
interface QuickBillingCartTableProps {
  items: CartItem[];
  onQuantityChange: (id: string | number, qty: number) => void;
  onRemove: (id: string | number) => void;
  onPriceEdit?: (id: string | number, price: number) => void;
}
```

**Performance:** Each row is a separate component. Use `React.memo` on the row component to prevent re-renders when other items change. The FlatList key extractor must use a stable unique ID, not the array index.

```typescript
<FlatList
  data={items}
  keyExtractor={(item) => String(item.id)}
  renderItem={({ item }) => <CartRow item={item} ... />}
  // These props are critical for performance:
  removeClippedSubviews={true}
  maxToRenderPerBatch={10}
  windowSize={5}
/>
```

---

### QuickBillingSearchBar
**Location:** `src/components/sections/quick-billing/QuickBillingSearchBar.tsx`

Search input with debounced product lookup and barcode scan trigger.

```typescript
interface QuickBillingSearchBarProps {
  onScanPress: () => void;
  onProductSelect: (product: Product) => void;
}
```

**Debounce:** 300ms via `useDebounce` hook. Do not remove or reduce this — eliminates rapid-fire API calls on each keystroke.

---

### QuickBillingCustomerInfo
**Location:** `src/components/sections/quick-billing/QuickBillingCustomerInfo.tsx`

Customer name, phone, and invoice type collection.

```typescript
interface QuickBillingCustomerInfoProps {
  customerName: string;
  customerPhone: string;
  billType: 'taxInvoice' | 'invoice';
  onCustomerNameChange: (name: string) => void;
  onCustomerPhoneChange: (phone: string) => void;
  onBillTypeChange: (type: 'taxInvoice' | 'invoice') => void;
}
```

**Phone validation:** 10-digit numeric only. Validate via `src/utils/validation/phoneValidation.ts`.

---

### QuickBillingCheckout
**Location:** `src/components/sections/quick-billing/QuickBillingCheckout.tsx`

Payment method selection, order placement, and e-bill.

```typescript
interface QuickBillingCheckoutProps {
  orderTotal: number;
  cartItems: CartItem[];
  customerName: string;
  customerPhone: string;
  billType: 'taxInvoice' | 'invoice';
  upiRefreshTrigger: number;  // increment to re-fetch UPI config
  onOrderComplete: () => void;
  onClose: () => void;
}
```

**State managed internally:**
- Payment method list with amounts
- UPI ID (fetched from backend)
- Credit note state
- Loading states per action

---

### BarcodeDialog
**Location:** `src/components/sections/home-page/BarcodeDialog.tsx`

Full-screen camera scanner dialog with manual entry fallback.

```typescript
interface BarcodeDialogProps {
  onProductFound: (product: Product) => void;
  onClose: () => void;
  visible: boolean;
}
```

**Note:** `visible` controls an internal mount/unmount — ensures camera cleanup on close.

---

### ReturnOrderDrawer
**Location:** `src/components/sections/home-page/ReturnOrderDrawer.tsx`

Slide-in drawer for return order processing.

```typescript
interface ReturnOrderDrawerProps {
  visible: boolean;
  onClose: () => void;
  onReturnComplete: (creditAmount: number) => void;
}
```

---

### ProductDetailModal
**Location:** `src/components/sections/home-page/ProductDetailModal.tsx`

Shows product details and variant selection before adding to cart.

```typescript
interface ProductDetailModalProps {
  product: Product | null;
  visible: boolean;
  onAddToCart: (product: Product) => void;
  onClose: () => void;
}
```

---

### CreditNote / CreditNoteType
**Location:** `src/components/sections/home-page/CreditNote.tsx`, `CreditNoteType.tsx`

Credit note input and type selection modals.

---

## 4. Layout System

### No design system library. Pure StyleSheet.

All styles use `StyleSheet.create()`. No Tailwind, no Styled Components, no NativeWind.

**Color palette** (define as constants in `src/services/constants/config.ts`):

```typescript
export const Colors = {
  primary: '#1A73E8',        // primary action blue
  primaryDark: '#1557B0',
  danger: '#D32F2F',         // delete, error red
  success: '#388E3C',        // success green
  warning: '#F57C00',        // caution orange
  background: '#F5F5F5',     // page background
  surface: '#FFFFFF',        // card/modal background
  text: '#212121',           // primary text
  textSecondary: '#757575',  // secondary text
  border: '#E0E0E0',         // dividers and borders
  disabled: '#BDBDBD',       // disabled state
};
```

**Spacing scale** (use multiples of 4):

```typescript
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};
```

**Typography scale:**

```typescript
export const Typography = {
  body: 14,
  bodyLarge: 16,
  productName: 16,
  price: 18,
  total: 22,
  heading: 20,
  label: 12,
};
```

---

## 5. Modal and Overlay Patterns

### When to use PortalModal vs Modal vs View overlay

| Scenario | Use |
|---|---|
| Overlay above camera (BarcodeDialog overlays) | `PortalModal` |
| Standard dialogs not involving camera | React Native `Modal` |
| Drawers (ReturnOrderDrawer) | Animated `View` with absolute positioning |
| Toasts | `react-native-toast-message` (renders via root sibling) |

### Drawer animation pattern

```typescript
const drawerAnim = useRef(new Animated.Value(screenWidth)).current;

const openDrawer = () => {
  Animated.timing(drawerAnim, {
    toValue: 0,
    duration: 250,
    useNativeDriver: true,
  }).start();
};

const closeDrawer = () => {
  Animated.timing(drawerAnim, {
    toValue: screenWidth,
    duration: 200,
    useNativeDriver: true,
  }).start(() => onClose());
};
```

Always use `useNativeDriver: true` for translation animations. Avoid animating `height` — use translate instead.

---

## 6. Form Patterns

### Payment amount input

```typescript
// Use controlled numeric input
<TextInput
  keyboardType="numeric"
  value={amount === 0 ? '' : String(amount)}
  onChangeText={(text) => {
    const parsed = parseFloat(text) || 0;
    setAmount(parsed);
  }}
  placeholder="0.00"
/>
```

**Gotcha:** `keyboardType="numeric"` on Android may still allow decimal points on some devices. Always `parseFloat`, never `parseInt` for monetary values.

### Phone number input

```typescript
<TextInput
  keyboardType="phone-pad"
  maxLength={10}
  value={phone}
  onChangeText={(text) => setPhone(text.replace(/[^0-9]/g, ''))}
/>
```

Strip non-numeric characters on change. `maxLength={10}` enforces Indian phone format.

---

## 7. Toast Notification System

Uses `react-native-toast-message`. Toast must be rendered once at the app root level.

**Setup in App.tsx:**
```typescript
<Toast />  // Must be the last child in the tree (renders on top)
```

**Usage patterns:**

```typescript
import Toast from 'react-native-toast-message';

// Success
Toast.show({ type: 'success', text1: 'Product added', text2: productName });

// Error
Toast.show({ type: 'error', text1: 'Product not found', visibilityTime: 3000 });

// Info
Toast.show({ type: 'info', text1: 'Refreshing cart...' });
```

**Rules:**
- Success toasts: 2 seconds
- Error toasts: 3-4 seconds
- Never show raw error messages — map API errors to user-friendly strings
- Maximum one active toast at a time (Toast.show replaces current)

---

## 8. Loading State Patterns

| Scope | Pattern |
|---|---|
| Button action (save, submit) | `disabled` + spinner inside button via `loading` prop |
| Full-screen init | `ActivityIndicator` centered on screen |
| Cart refresh | Inline loading text in checkout header |
| Product search | Spinner below search bar, not spinner overlay |
| Order placement | Full modal with spinner (blocking — cannot cancel) |

**Never block the entire screen with a spinner during product search or cart refresh.** These are background operations. The user should be able to scroll the cart or dismiss while these run.

---

## 9. Accessibility

Minimum requirements for production:

- All `TouchableOpacity` elements have `accessibilityLabel` and `accessibilityRole`
- Form inputs have `accessibilityLabel`
- Error messages are announced via `accessibilityLiveRegion="polite"`
- Touch targets minimum 44×44 points
- Color is not the only differentiator for state (use icons + color)

---

## 10. Known UI Debt

| Issue | Location | Priority |
|---|---|---|
| QuickBillingHomePage is 1127 lines | quick-billing/QuickBillingHomePage.tsx | High |
| BarcodeDialog is 1075 lines | home-page/BarcodeDialog.tsx | Medium |
| No defined color/spacing constants file | src/services/constants/config.ts | Medium |
| Inline styles in some components | Various | Low |
| No loading skeleton for product search results | QuickBillingSearchBar | Low |
