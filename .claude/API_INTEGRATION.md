# API_INTEGRATION.md — API Integration

## 1. Backend Overview

| System | URL | Auth |
|---|---|---|
| Spring Boot backend | `https://mpos.apeirosai.com` | Bearer token |
| All API paths | `/lumepos/ws/` prefix | Authorization header |

The backend is a Java Spring Boot application. All business logic (pricing, GST, discounts, order validation) lives there. The React Native app is a thin client.

---

## 2. Base Configuration

**File:** `src/services/constants/config.ts`

```typescript
export const BASE_URL = 'https://mpos.apeirosai.com';

// AsyncStorage keys — never use inline strings
export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'AccessToken',
  CART: 'cart',
  POS_ORDERS: 'pos_orders',
  BILL_TYPE: 'quickBilling_billType',
  ORG_NAME: 'orgName',
  STORE_NAME: 'storeName',
  TENANT_ID: 'tenantId',
};

// Request timeouts
export const TIMEOUTS = {
  DEFAULT: 10000,       // 10 seconds
  EBILL: 30000,         // 30 seconds (WhatsApp delivery can be slow)
  CHECKOUT: 15000,      // 15 seconds for order placement
};
```

---

## 3. Recommended: Shared Axios Instance

Currently, each service creates its own axios requests without a shared instance. This is a known gap. A shared axios instance with interceptors should be created:

**File:** `src/services/api/axiosInstance.ts`

```typescript
import axios from 'axios';
import { BASE_URL, STORAGE_KEYS, TIMEOUTS } from '../constants/config';
import { getToken, removeToken } from '../../utils/storage/tokenStorage';

const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: TIMEOUTS.DEFAULT,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach token to every request
apiClient.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 globally
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await removeToken();
      // AuthContext listens via an event emitter or a global logout callback
      globalLogout();  // see Auth section below
    }
    return Promise.reject(error);
  }
);

export default apiClient;
```

---

## 4. Authentication API

**File:** `src/services/api/AuthApi.ts`

| Function | Method | Endpoint | Description |
|---|---|---|---|
| `generateOtp(mobileNumber)` | POST | `/lumepos/ws/generateOtp` | Send OTP to cashier phone |
| `loginWithOtp(RMN, OTP)` | POST | `/lumepos/ws/login` | Verify OTP, get token |
| `verifyDeviceOtp(deviceId, otp)` | POST | `/api/auth/verify-device` | Device-level auth for new devices |
| `verifyAuth()` | GET | `/api/auth/verify` | Validate existing token |

**Request/Response shapes:**

```typescript
// generateOtp
POST /lumepos/ws/generateOtp
Body: { mobileNumber: string }
Response: { message: string }

// loginWithOtp
POST /lumepos/ws/login
Body: { RMN: string, OTP: string }
Response: { token: string, orgName: string, storeName: string, tenantId: string, ... }

// verifyAuth
GET /api/auth/verify
Headers: { Authorization: 'Bearer <token>' }
Response: 200 OK (valid) | 401 Unauthorized (invalid/expired)
```

**Auth headers for CORS bypass:**
Some endpoints require additional headers:
```typescript
headers: {
  Origin: BASE_URL,
  Referer: BASE_URL,
}
```
This is a known quirk — the backend CORS config may require these. Include them in the shared axios instance defaults.

---

## 5. Product Service

**File:** `src/services/api/productService.ts`

| Function | Method | Endpoint | Description |
|---|---|---|---|
| `searchProducts(productName)` | POST | `/lumepos/ws/searchProducts` | Search by name |
| `getProductsFromCategory(deptnmbr)` | POST | `/lumepos/ws/getProductsFromCategorie` | Browse by category |
| `getMultipleProducts(barcodes[])` | POST | `/lumepos/ws/getMultipleProducts` | Barcode lookup (primary) |
| `addProduct(productData)` | POST | `/lumepos/ws/addProduct` | Add new product (admin) |
| `getPopularCategories()` | GET | `/lumepos/ws/popularCategories` | Fetch category list |

**Barcode lookup payload:**
```typescript
// getMultipleProducts — primary barcode scan API
POST /lumepos/ws/getMultipleProducts
Body: { barcodes: string[] }  // Always send array, even for single scan
Response: Product[]

interface Product {
  id: string | number;
  name: string;
  sku?: string;
  MRP?: number;
  netPrice?: number;
  itemHSN?: string | number;
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
}
```

**Product search payload:**
```typescript
POST /lumepos/ws/searchProducts
Body: { productName: string }
Response: Product[]
```

Minimum search length: 2 characters. Enforce in the component, not the service.

---

## 6. Order Service

**File:** `src/services/api/orderService.ts`

### refreshCart — Critical Pre-checkout Step

```typescript
POST /lumepos/ws/refreshCart
Body: {
  items: CartItem[],
  billType: 'taxInvoice' | 'invoice',
  customerPhone?: string,
}
Response: {
  items: CartItem[],        // Updated with final prices
  subtotal: number,
  discountAmount: number,
  taxAmount: number,
  netAmount: number,
  totalAmount: number,
}
```

**This call MUST happen before every order placement.** Never skip. It enforces server-side pricing, applies promotional discounts, and validates stock.

### placeOrder

```typescript
POST /lumepos/ws/placeOrder
Body: {
  items: CartItem[],
  customerName: string,
  customerPhone: string,
  billType: 'taxInvoice' | 'invoice',
  cinNo?: string,           // Required for taxInvoice
  totalAmount: number,
  discountAmount: number,
  billReference?: string,   // From hold order if resuming
}
Response: {
  orderId: string | number,
  billNumber: string,
  status: 'success' | 'error',
  message?: string,
}
```

**Idempotency:** The backend uses `billReference` for idempotency. If placing an order from a held cart, include the `billReference` to prevent duplicate orders on retry.

### orderPayment

```typescript
POST /lumepos/ws/orderPayment
Body: {
  orderId: string | number,
  payments: Array<{
    method: 'cash' | 'card' | 'upi' | 'creditNote',
    amount: number,
    cardNumber?: string,    // Last 4 digits
    upiId?: string,
    creditNoteNumber?: string,
  }>,
}
Response: { status: 'success' | 'error', message?: string }
```

**Order of operations:** Always call `placeOrder` first, then `orderPayment`. Never reverse. If `orderPayment` fails after `placeOrder` succeeds, record the `orderId` for manual reconciliation — do not retry `placeOrder`.

### validateCreditNote

```typescript
POST /lumepos/ws/validateCreditNote
Body: { creditNoteNumber: string, amount: number }
Response: {
  valid: boolean,
  availableBalance?: number,
  message?: string,
}
```

Call before checkout to validate credit note balance.

### E-Bill Functions

```typescript
// Standard e-bill
POST /lumepos/ws/sendEbill
Body: { orderId: string, customerPhone: string }
Response: { status: string, whatsappUrl?: string }

// Lume-branded e-bill (primary)
POST /lumepos/ws/lumeEbill
Body: { orderId: string }
Response: { status: string, invoiceUrl?: string }

// E-bill + credit note combined
POST /lumepos/ws/sendEbillAndCreditNote
Body: { orderId: string, customerPhone: string, creditNoteData: object }
Response: { status: string }
```

**E-bill is non-blocking.** Failure does not affect order status. Show error toast and offer retry button.

### UPI Management

```typescript
GET /lumepos/ws/getUpiId
Response: { upiId: string | null }

POST /lumepos/ws/saveUpi
Body: { upiId: string }
Response: { status: string }
```

### GST Management

```typescript
GET /lumepos/ws/gst
Response: { cinNo: string | null }

POST /lumepos/ws/gst
Body: { cinNo: string }
Response: { status: string }
```

---

## 7. Customer Service

**File:** `src/services/api/customerService.ts`

```typescript
// Search existing customers
POST /lumepos/ws/ftk/search
Body: { name?: string, mobileNum?: string }
Response: Array<{ id, name, mobileNum, ... }>

// Save new or update existing customer
POST /lumepos/ws/ftk/saveCustomer
Body: { name: string, mobileNum: string, ... }
Response: { customerId: string, status: string }
```

Customer save happens at checkout. It is non-blocking — failure should not prevent order placement.

---

## 8. Hold Order Service

**File:** `src/services/api/holdOrderService.ts`

```typescript
GET /lumepos/ws/getAllHoldBills
Response: Array<{ billReference, customerName, itemCount, totalAmount, ... }>

POST /lumepos/ws/getHoldOrderDetails
Body: { billReference: string }
Response: { items: CartItem[], customerName, customerPhone, billType, ... }

POST /lumepos/ws/saveHoldOrder
Body: { billReference, items, customerName, customerPhone, billType }
Response: { status: string }

POST /lumepos/ws/removeHoldOrder
Body: { billReference: string }
Response: { status: string }
```

**smartSaveHoldOrder logic:**
```typescript
// In holdOrderService.ts
export const smartSaveHoldOrder = async (payload: HoldOrderPayload) => {
  const existing = await getAllHoldBills();
  const exists = existing.some(b => b.billReference === payload.billReference);

  if (exists) {
    return saveHoldOrder(payload);   // Update
  } else {
    return saveHoldOrder(payload);   // Create (same endpoint, backend handles both)
  }
};
```

---

## 9. Return Order API

**File:** `src/services/api/ReturnOrderApi.ts`

```typescript
POST /lumepos/ws/getOrderDetails
Body: { billId: string }
Response: { items: OrderItem[], customerName, billDate, ... }

GET /lumepos/ws/returnReasons
Response: Array<{ id, reason }>

POST /lumepos/ws/getItemDetails
Body: { itemCode: string, billId: string }
Response: { item: OrderItem, maxReturnQty: number }

POST /lumepos/ws/saveReturns
Body: { items: ReturnItem[], billId: string }
Response: { returnId: string, creditAmount: number, status: string }

POST /lumepos/ws/validateQuantity
Body: { itemCode: string, billId: string, size: string }
Response: { valid: boolean, maxQty: number }
```

---

## 10. Error Handling Strategy

### Service-level error handling

```typescript
// Pattern: services throw typed errors, components catch them
export async function placeOrder(payload: OrderPayload): Promise<OrderResult> {
  try {
    const response = await apiClient.post('/lumepos/ws/placeOrder', payload, {
      timeout: TIMEOUTS.CHECKOUT,
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 400) {
        throw new Error(error.response.data?.message ?? 'Invalid order data');
      }
      if (error.response?.status === 401) {
        throw new Error('Session expired. Please login again.');
      }
      if (error.code === 'ECONNABORTED') {
        throw new Error('Request timed out. Check your network connection.');
      }
    }
    throw new Error('Order placement failed. Please try again.');
  }
}
```

### Component-level error handling

```typescript
// Pattern: try/catch in event handlers, map to toast
const handlePlaceOrder = async () => {
  setLoading(true);
  try {
    const result = await orderService.placeOrder(payload);
    handleOrderComplete(result.orderId);
  } catch (error) {
    Toast.show({
      type: 'error',
      text1: 'Order Failed',
      text2: error instanceof Error ? error.message : 'Please try again',
      visibilityTime: 4000,
    });
  } finally {
    setLoading(false);
  }
};
```

### Network error detection

```typescript
import NetInfo from '@react-native-community/netinfo';  // Add this dependency

const checkConnectivity = async (): Promise<boolean> => {
  const state = await NetInfo.fetch();
  return state.isConnected ?? false;
};

// Before checkout:
if (!(await checkConnectivity())) {
  Toast.show({ type: 'error', text1: 'No internet connection' });
  return;
}
```

**Note:** `@react-native-community/netinfo` is not in the current dependencies. Add it for robust connectivity checks before checkout.

---

## 11. Request Retry Strategy

| Endpoint | Retry Safe? | Retry Strategy |
|---|---|---|
| searchProducts | Yes | Auto-retry once on timeout |
| getMultipleProducts | Yes | Auto-retry once on timeout |
| refreshCart | Yes | Manual retry via button |
| placeOrder | **NO** | Manual retry ONLY with user confirmation |
| orderPayment | **NO** | Manual retry ONLY with user confirmation |
| sendLumeEbill | Yes | Auto-retry once, then manual |
| saveHoldOrder | Yes | Auto-retry twice |
| saveReturns | No | Manual retry only |

**The golden rule:** Never auto-retry any endpoint that creates a resource (order placement, payment recording, return saves). Always require explicit user action.

---

## 12. API Response Logging (Development Only)

```typescript
// Add to axiosInstance.ts — development only
if (__DEV__) {
  apiClient.interceptors.response.use(
    (response) => {
      console.log(`[API] ${response.config.method?.toUpperCase()} ${response.config.url}`, {
        status: response.status,
        data: response.data,
      });
      return response;
    },
    (error) => {
      console.error(`[API Error] ${error.config?.url}`, {
        status: error.response?.status,
        message: error.response?.data?.message,
      });
      return Promise.reject(error);
    }
  );
}
```

Remove or gate behind `__DEV__` before production deployment. Never log full response data in production — it may contain PII (customer phone, order amounts).
