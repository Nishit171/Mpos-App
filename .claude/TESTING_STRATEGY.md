# TESTING_STRATEGY.md — Testing Strategy

## 1. Testing Philosophy

The MPOS app is a **transaction-critical production system**. A bug in checkout, payment recording, or barcode scanning has direct revenue impact. Testing priorities reflect this:

1. **Business logic utilities** — highest coverage, pure functions, easy to test
2. **API service layer** — mock responses, verify request shapes
3. **Context providers** — state transitions, persistence behavior
4. **Component integration** — key user flows, not pixel-perfect snapshots
5. **E2E flows** — manual testing on device for camera and payment hardware

**What we do NOT test:**
- UI snapshots — brittle, low value
- Third-party library internals (Vision Camera, AsyncStorage)
- Pixel layout correctness
- Backend logic (tested by the backend team)

---

## 2. Test Setup

**Framework:** Jest (configured in `jest.config.js`)
**Preset:** `react-native`
**TypeScript:** Handled by Babel transform in `@react-native/babel-preset`

```javascript
// jest.config.js
module.exports = {
  preset: 'react-native',
  setupFilesAfterFramework: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    // Map module aliases if added to tsconfig paths
  },
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|react-native-vision-camera|' +
    '@react-native-ml-kit|react-native-permissions|react-native-toast-message)/)',
  ],
};
```

### Setup file

```typescript
// jest.setup.ts
import '@testing-library/jest-native/extend-expect';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock Vision Camera
jest.mock('react-native-vision-camera', () => ({
  Camera: 'Camera',
  useCodeScanner: jest.fn(() => ({})),
  useCameraDevices: jest.fn(() => ({ back: { id: 'back', hasTorch: true } })),
}));

// Mock react-native-permissions
jest.mock('react-native-permissions', () => ({
  check: jest.fn(() => Promise.resolve('granted')),
  request: jest.fn(() => Promise.resolve('granted')),
  PERMISSIONS: { ANDROID: { CAMERA: 'android.permission.CAMERA' } },
  RESULTS: { GRANTED: 'granted', DENIED: 'denied', BLOCKED: 'blocked' },
}));
```

---

## 3. Unit Tests — Utility Functions

All utility functions must have unit test coverage. These are pure functions — testing is straightforward.

### Validation tests

```typescript
// src/utils/validation/__tests__/phoneValidation.test.ts
import { validateIndianPhone } from '../phoneValidation';

describe('validateIndianPhone', () => {
  it('accepts valid 10-digit numbers starting with 6-9', () => {
    expect(validateIndianPhone('9876543210')).toBe(true);
    expect(validateIndianPhone('6123456789')).toBe(true);
    expect(validateIndianPhone('7000000000')).toBe(true);
    expect(validateIndianPhone('8999999999')).toBe(true);
  });

  it('rejects numbers starting with 0-5', () => {
    expect(validateIndianPhone('5876543210')).toBe(false);
    expect(validateIndianPhone('0000000000')).toBe(false);
  });

  it('rejects numbers shorter or longer than 10 digits', () => {
    expect(validateIndianPhone('987654321')).toBe(false);    // 9 digits
    expect(validateIndianPhone('98765432101')).toBe(false);  // 11 digits
  });

  it('rejects non-numeric input', () => {
    expect(validateIndianPhone('abcdefghij')).toBe(false);
    expect(validateIndianPhone('+919876543210')).toBe(false);
  });
});
```

```typescript
// src/utils/validation/__tests__/upiValidation.test.ts
import { validateUpiId } from '../upiValidation';

describe('validateUpiId', () => {
  it('accepts valid UPI IDs', () => {
    expect(validateUpiId('store@paytm')).toBe(true);
    expect(validateUpiId('merchant.name@okaxis')).toBe(true);
    expect(validateUpiId('12345678@upi')).toBe(true);
  });

  it('rejects invalid formats', () => {
    expect(validateUpiId('invalid')).toBe(false);        // No @ symbol
    expect(validateUpiId('@provider')).toBe(false);      // No identifier
    expect(validateUpiId('id@')).toBe(false);            // No provider
    expect(validateUpiId('')).toBe(false);
  });
});
```

### Payment validation tests

```typescript
// src/utils/billing/__tests__/paymentValidation.test.ts
import { validatePayments } from '../paymentValidation';

describe('validatePayments', () => {
  it('passes when payments sum equals order total', () => {
    const payments = [{ method: 'cash', amount: 500 }];
    expect(validatePayments(payments, 500).valid).toBe(true);
  });

  it('fails when total is short', () => {
    const payments = [{ method: 'cash', amount: 400 }];
    const result = validatePayments(payments, 500);
    expect(result.valid).toBe(false);
    expect(result.message).toContain('100.00');
  });

  it('fails when no payments provided', () => {
    expect(validatePayments([], 500).valid).toBe(false);
  });

  it('fails when card payment lacks last 4 digits', () => {
    const payments = [{ method: 'card', amount: 500, cardNumber: '12' }];
    expect(validatePayments(payments, 500).valid).toBe(false);
  });

  it('handles floating point amounts correctly', () => {
    const payments = [
      { method: 'cash', amount: 333.33 },
      { method: 'upi', amount: 166.67, upiId: 'store@upi' },
    ];
    expect(validatePayments(payments, 500).valid).toBe(true);
  });

  it('handles split payments summing to total', () => {
    const payments = [
      { method: 'cash', amount: 200 },
      { method: 'card', amount: 300, cardNumber: '4321' },
    ];
    expect(validatePayments(payments, 500).valid).toBe(true);
  });
});
```

### Cart calculation tests

```typescript
// src/utils/billing/__tests__/cartCalculations.test.ts
describe('cart total calculation', () => {
  it('calculates total from netPrice × quantity', () => {
    const items = [
      { id: 1, netPrice: 100, quantity: 2 },
      { id: 2, netPrice: 50, quantity: 1 },
    ];
    const total = items.reduce((sum, i) => sum + i.netPrice * i.quantity, 0);
    expect(total).toBe(250);
  });

  it('handles items with undefined netPrice', () => {
    const items = [
      { id: 1, netPrice: undefined, MRP: 100, quantity: 1 },
    ];
    // Fall back to MRP if netPrice missing
    const total = items.reduce((sum, i) => sum + (i.netPrice ?? i.MRP ?? 0) * i.quantity, 0);
    expect(total).toBe(100);
  });
});
```

---

## 4. Unit Tests — Service Layer

Mock axios responses. Verify request payloads.

```typescript
// src/services/api/__tests__/productService.test.ts
import axios from 'axios';
import { searchProducts, getMultipleProducts } from '../productService';
import { getToken } from '../../utils/storage/tokenStorage';

jest.mock('axios');
jest.mock('../../utils/storage/tokenStorage');

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('productService', () => {
  beforeEach(() => {
    (getToken as jest.Mock).mockResolvedValue('test-token');
  });

  describe('searchProducts', () => {
    it('sends correct request payload', async () => {
      mockedAxios.post.mockResolvedValue({ data: [] });
      await searchProducts('apple');

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/searchProducts'),
        { productName: 'apple' },
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
        })
      );
    });

    it('returns product array from response', async () => {
      const mockProducts = [{ id: 1, name: 'Apple' }];
      mockedAxios.post.mockResolvedValue({ data: mockProducts });

      const result = await searchProducts('apple');
      expect(result).toEqual(mockProducts);
    });
  });

  describe('getMultipleProducts', () => {
    it('normalizes barcode before sending', async () => {
      mockedAxios.post.mockResolvedValue({ data: [] });
      await getMultipleProducts(['123456ST07']);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ barcodes: ['123456'] }),
        expect.anything()
      );
    });
  });
});
```

---

## 5. Context Tests

```typescript
// src/context/__tests__/CartContext.test.tsx
import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { CartProvider, useCart } from '../cart-context';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <CartProvider>{children}</CartProvider>
);

describe('CartContext', () => {
  it('starts with empty cart', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    expect(result.current.cartItems).toEqual([]);
  });

  it('adds a new item', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => {
      result.current.addToCart({ id: 1, name: 'Test Product', quantity: 1 });
    });
    expect(result.current.cartItems).toHaveLength(1);
    expect(result.current.cartItems[0].name).toBe('Test Product');
  });

  it('increments quantity for existing item', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => {
      result.current.addToCart({ id: 1, name: 'Test', quantity: 1 });
      result.current.addToCart({ id: 1, name: 'Test', quantity: 1 });
    });
    expect(result.current.cartItems).toHaveLength(1);
    expect(result.current.cartItems[0].quantity).toBe(2);
  });

  it('removes an item', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => {
      result.current.addToCart({ id: 1, name: 'Test', quantity: 1 });
      result.current.removeFromCart(1);
    });
    expect(result.current.cartItems).toHaveLength(0);
  });

  it('updates quantity', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => {
      result.current.addToCart({ id: 1, name: 'Test', quantity: 1 });
      result.current.updateQuantity(1, 5);
    });
    expect(result.current.cartItems[0].quantity).toBe(5);
  });

  it('clears all items', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => {
      result.current.addToCart({ id: 1, name: 'A', quantity: 1 });
      result.current.addToCart({ id: 2, name: 'B', quantity: 1 });
      result.current.clearCart();
    });
    expect(result.current.cartItems).toHaveLength(0);
  });
});
```

---

## 6. Component Tests — Key Flows

Use `@testing-library/react-native` for component tests.

```typescript
// src/components/sections/quick-billing/__tests__/QuickBillingSearchBar.test.tsx
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import QuickBillingSearchBar from '../QuickBillingSearchBar';
import * as productService from '../../../../services/api/productService';

jest.mock('../../../../services/api/productService');
jest.useFakeTimers();

describe('QuickBillingSearchBar', () => {
  it('calls searchProducts after debounce', async () => {
    const mockSearch = jest.spyOn(productService, 'searchProducts')
      .mockResolvedValue([{ id: 1, name: 'Apple Juice' }]);

    const { getByPlaceholderText } = render(
      <QuickBillingSearchBar onProductSelect={jest.fn()} onScanPress={jest.fn()} />
    );

    fireEvent.changeText(getByPlaceholderText(/search/i), 'apple');
    jest.advanceTimersByTime(300);

    await waitFor(() => {
      expect(mockSearch).toHaveBeenCalledWith('apple');
    });
  });

  it('does not search for single character input', () => {
    const mockSearch = jest.spyOn(productService, 'searchProducts');

    const { getByPlaceholderText } = render(
      <QuickBillingSearchBar onProductSelect={jest.fn()} onScanPress={jest.fn()} />
    );

    fireEvent.changeText(getByPlaceholderText(/search/i), 'a');
    jest.advanceTimersByTime(300);

    expect(mockSearch).not.toHaveBeenCalled();
  });
});
```

---

## 7. Tests NOT to Write

| Test Type | Reason to Skip |
|---|---|
| Snapshot tests for UI components | Brittle, breaks on any style change, zero business value |
| Tests for React Native internals | `FlatList` works — trust the framework |
| Tests for axios request construction (beyond param validation) | Network tests belong in integration/E2E |
| Tests that mock everything and test nothing | Tests that mock CartContext AND productService AND the component just test mock wiring |
| Tests for AsyncStorage data format | Test the behavior (cart persists), not the JSON shape |

---

## 8. E2E and Manual Testing

Some flows cannot be unit-tested because they require hardware:

| Flow | Test Method |
|---|---|
| Barcode camera scanning | Manual — test on physical device with real products |
| Torch control | Manual — verify torch toggles on device |
| WhatsApp e-bill delivery | Manual — verify WhatsApp opens with correct message |
| Payment terminal confirmation | Manual — cashier manually confirms physical terminal |
| Camera permission denial | Manual — deny permission in Settings, verify fallback |
| Network loss during checkout | Manual — airplane mode during checkout flow |

**Manual test checklist before each release:**

- [ ] Login with valid OTP
- [ ] Scan a product barcode → auto-add to cart
- [ ] Scan unknown barcode → "Product not found" toast
- [ ] Search product by name → add to cart
- [ ] Adjust cart quantity
- [ ] Remove cart item
- [ ] Open checkout → verify totals
- [ ] Cash payment → verify change calculation
- [ ] UPI payment → verify WhatsApp/payment flow
- [ ] Card payment → enter last 4 digits
- [ ] Split payment (cash + card) → verify validation
- [ ] Place order → verify order confirmation
- [ ] Send e-bill → verify WhatsApp opens
- [ ] Hold order → switch tabs → resume held order
- [ ] Return order by bill ID → select items → confirm return
- [ ] Tax invoice selection → GST details on checkout
- [ ] Logout → login again → verify session restoration

---

## 9. Running Tests

```bash
# Run all tests
npx react-native test

# Run specific file
npx jest src/utils/validation/__tests__/phoneValidation.test.ts

# Run with coverage
npx jest --coverage

# Run tests matching pattern
npx jest --testNamePattern="CartContext"

# Watch mode
npx jest --watch
```

---

## 10. Coverage Targets

| Area | Target Coverage |
|---|---|
| `src/utils/` | 80%+ |
| `src/services/api/` | 60%+ |
| `src/context/` | 70%+ |
| `src/components/` | 40%+ (key flows) |
| Overall | 50%+ |

Coverage is a lagging indicator. Do not write low-value tests to hit coverage targets. Prioritize tests that catch real regressions.
