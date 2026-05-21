# APP_ARCHITECTURE.md — Application Architecture

## 1. Runtime Stack

| Layer | Technology | Version |
|---|---|---|
| UI Framework | React Native | 0.84.1 |
| Language | TypeScript | 5.8.3 |
| JS Engine | Hermes | Bundled with RN 0.84 |
| Bundler | Metro | @react-native/metro-config |
| Camera | react-native-vision-camera | 4.7.3 |
| Barcode ML | @react-native-ml-kit/barcode-scanning | 2.0.0 |
| HTTP | axios | 1.13.6 |
| Storage | @react-native-async-storage/async-storage | 2.1.1 |
| Icons | react-native-vector-icons | 10.3.0 |
| Toast | react-native-toast-message | 2.3.3 |
| PDF | react-native-pdf | 7.0.3 |
| File I/O | react-native-blob-util | 0.24.7 |
| QR code | react-native-qrcode-svg | 6.3.21 |

---

## 2. Application Layer Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        index.js (entry)                         │
│              AppRegistry.registerComponent('mposapp')           │
└─────────────────────────────┬───────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│                           App.tsx                               │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  RootSiblingParent  (react-native-root-siblings)         │   │
│  │  ┌───────────────────────────────────────────────────┐   │   │
│  │  │  PortalProvider  (overlay/modal host)             │   │   │
│  │  │  ┌─────────────────────────────────────────────┐  │   │   │
│  │  │  │  AuthProvider  (login state + token)        │  │   │   │
│  │  │  │  ┌─────────────────────────────────────┐   │  │   │   │
│  │  │  │  │  CartProvider  (active cart state)  │   │  │   │   │
│  │  │  │  │  ┌───────────────────────────────┐  │   │  │   │   │
│  │  │  │  │  │  SafeAreaView                 │  │   │  │   │   │
│  │  │  │  │  │  ┌─────────────────────────┐  │  │   │  │   │   │
│  │  │  │  │  │  │  RootNavigator          │  │  │   │  │   │   │
│  │  │  │  │  │  │  (auth gate)            │  │  │   │  │   │   │
│  │  │  │  │  │  └─────────────────────────┘  │  │   │  │   │   │
│  │  │  │  │  └───────────────────────────────┘  │   │  │   │   │
│  │  │  │  └─────────────────────────────────────┘   │  │   │   │
│  │  │  └─────────────────────────────────────────────┘  │   │   │
│  │  └───────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Navigation Architecture

The app does **not** use React Navigation. Navigation is a conditional render in `App.tsx` based on auth state.

```typescript
// RootNavigator logic (simplified)
const { user, isLoading } = useAuth();

if (isLoading) return <SplashScreen />;
if (!user) return <LoginComponent />;
return <QuickBillingHomePage />;
```

**Rationale:** The POS app has two states — logged in or logged out. There is no deep linking, no back stack, and no tab navigation at the root level. Introducing React Navigation would add overhead with no benefit for this architecture.

**Future migration path:** If a reports screen, settings screen, or multi-store selector is added, React Navigation Stack should be adopted at that point.

**Intra-screen navigation:** Modals, drawers, and dialogs handle all sub-flows within `QuickBillingHomePage`. These are controlled via local boolean state variables.

---

## 4. Context Provider Architecture

### AuthContext (`src/context/auth-context.tsx`)

```typescript
interface AuthUser {
  token: string;
  [key: string]: any;  // org data from login response
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (token: string, userData: object) => Promise<void>;
  logout: () => Promise<void>;
}
```

**Initialization flow:**
1. On mount, read `"AccessToken"` from AsyncStorage
2. If token exists, call `verifyAuth()` to validate
3. On 401, clear token and set `user = null`
4. Set `isLoading = false` after resolution

**Login flow:**
1. Receive token and user data from `AuthApi.loginWithOtp()`
2. Store token to AsyncStorage via `setToken()`
3. Store org data to AsyncStorage (`orgName`, `storeName`, `tenantId`)
4. Set `user` state

### CartContext (`src/context/cart-context.tsx`)

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

**Persistence pattern:**
- On every cart mutation, serialize to AsyncStorage key `'cart'`
- On mount, hydrate from AsyncStorage
- `cartLoaded` flag prevents premature rendering of cart-dependent components
- `lastSavedCartRef` prevents duplicate saves in rapid succession

---

## 5. Component Architecture

### Tier Classification

| Tier | Location | Characteristics |
|---|---|---|
| 1 — Primitives | `src/components/sections/ui/` | Stateless, no context, props-only |
| 2 — Feature Components | `src/components/sections/quick-billing/`, `home-page/` | Stateful, may read context, no direct API calls |
| 3 — Screen Containers | `src/screens/` | Data coordination, callbacks, API hooks |

### Component Dependency Graph

```
QuickBillingHomePage (Tier 3 — currently over-sized)
├── Header
│   └── [avatar, button primitives]
├── OrderTabsBar
├── QuickBillingSearchBar
│   └── [input primitive]
├── QuickBillingCartTable
│   └── [button primitive]
├── QuickBillingCustomerInfo
│   └── [input primitive]
├── BarcodeDialog (modal)
│   └── VisionCamera
├── ProductDetailModal (modal)
├── QuickBillingCheckout (drawer/modal)
│   ├── QuickBillingAddProductDialog
│   └── QuickBillingExchangeDialog
├── ReturnOrderDrawer (drawer)
│   └── ReturnOrderApi calls
├── CreditNote (modal)
└── CreditNoteType (modal)
```

### Known Architectural Debt

`QuickBillingHomePage.tsx` is 1127 lines. It handles:
- Order tab CRUD
- Hold order sync
- Customer info state
- Cart refresh before checkout
- UI modal open/close state
- Order placement coordination

**Decomposition target:**
```
src/hooks/useOrderTabs.ts       — tab CRUD + hold order sync
src/hooks/useCheckoutFlow.ts    — cart refresh + order placement
src/screens/QuickBillingScreen.tsx — thin coordinator
```

---

## 6. Service Layer Architecture

```
src/services/
  api/
    AuthApi.ts           — OTP generation, login, device verification
    productService.ts    — product search, barcode lookup, category browse
    orderService.ts      — place order, refresh cart, payments, e-bill
    customerService.ts   — customer search and save
    holdOrderService.ts  — save/resume/delete hold orders
    ReturnOrderApi.ts    — return order lookup, reason fetch, save returns
  constants/
    config.ts            — BASE_URL, AsyncStorage keys, timeout values
```

**Request pattern:**

```typescript
// All service functions follow this pattern
import axios from 'axios';
import { getToken } from '../utils/storage/tokenStorage';
import { BASE_URL } from '../constants/config';

export async function searchProducts(query: string): Promise<Product[]> {
  const token = await getToken();
  const response = await axios.post(
    `${BASE_URL}/lumepos/ws/searchProducts`,
    { productName: query },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    }
  );
  return response.data;
}
```

**No global axios instance** currently exists. This is a known gap — a shared axios instance with interceptors for auth headers and 401 handling should be created.

**Recommended axios interceptor setup:**

```typescript
// src/services/api/axiosInstance.ts
const instance = axios.create({ baseURL: BASE_URL, timeout: 10000 });

instance.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

instance.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401) {
      await removeToken();
      // trigger auth context logout
    }
    return Promise.reject(error);
  }
);
```

---

## 7. Data Flow for Core POS Operation

```
User scans barcode
       │
       ▼
BarcodeDialog.useCodeScanner()
  → onCodeScanned(codes)
  → strip 'ST' suffix
  → productService.getMultipleProducts([barcode])
       │
       ▼
  API returns products[]
       │
  ┌────┴────┐
  │ count   │
  │ === 1   │──► CartContext.addToCart(product)
  │         │    → AsyncStorage.setItem('cart', ...)
  └────┬────┘
       │ > 1
       ▼
  Show product selection list
  User selects → CartContext.addToCart(selected)
       │
       ▼
User taps Checkout
  → refreshCart(cartItems)  [backend recalculates totals]
  → Show checkout modal
  → User enters customer info + payment
  → orderService.placeOrder(payload)
  → orderService.orderPayment(paymentPayload)
  → orderService.sendLumeEbill(orderId)  [if e-bill requested]
  → CartContext.clearCart()
  → Show success
```

---

## 8. Storage Architecture

| Key | Type | Owner | Purpose |
|---|---|---|---|
| `AccessToken` | string | tokenStorage.ts | Bearer auth token |
| `cart` | JSON array | cartStorage.ts | Active cart items |
| `quickBilling_billType` | string | QuickBillingHomePage | Tax invoice vs invoice |
| `pos_orders` | JSON array | QuickBillingHomePage | Multi-order tab state |
| `orgName` | string | AuthContext | Store org name |
| `storeName` | string | AuthContext | Store name |
| `tenantId` | string | AuthContext | Tenant identifier |

**Rule:** Never read AsyncStorage keys inline with string literals. All keys must be constants defined in `src/services/constants/config.ts`.

---

## 9. Permission Architecture

| Permission | Library | When Requested |
|---|---|---|
| CAMERA | react-native-permissions | On first BarcodeDialog open |
| READ_EXTERNAL_STORAGE | react-native-permissions | On image-pick for barcode |
| WRITE_EXTERNAL_STORAGE | react-native-permissions | On invoice save/share |

Permissions are requested lazily (on feature use), not on app start. If permission is denied, show a user-actionable message pointing to device Settings.

---

## 10. Build Configuration

**Android:** Standard React Native 0.84 Android build. Gradle configs in `android/`. ProGuard rules must preserve ML Kit and Vision Camera classes.

**iOS:** Standard React Native 0.84 iOS build. Vision Camera requires `NSCameraUsageDescription` in Info.plist.

**Metro:** Default `@react-native/metro-config`. No custom resolvers currently needed.

**Babel:** `@react-native/babel-preset`. Hermes-compatible output.

**Environment variables:** Currently only BASE_URL is configurable via `config.ts`. For multi-environment builds, introduce `react-native-config` and `.env.staging`/`.env.production` files.
