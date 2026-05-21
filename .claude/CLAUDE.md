# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

All commands run from the `mposapp/` directory.

```bash
# Metro bundler (run first, keep open)
npm start

# Run on Android
npm run android

# Run on iOS
npm run ios

# Lint
npm run lint

# All tests
npm test

# Single test file
npx jest src/utils/validation/__tests__/phoneValidation.test.ts

# Tests matching a name pattern
npx jest --testNamePattern="CartContext"

# TypeScript check (no emit)
npx tsc --noEmit
```

## Architecture

**This is a React Native mobile POS (Point of Sale) app.** It is **not** connected to the React.js website frontend. It talks exclusively to a Java Spring Boot backend at `https://mpos.apeirosai.com` (`src/services/constants/config.ts`).

The primary reason this app exists is **barcode scanning performance** — web-based scanning was too slow/expensive; `react-native-vision-camera` provides sub-50ms native frame processing.

### Navigation

No React Navigation library. `App.tsx` renders a `RootNavigator` that conditionally shows `<LoginComponent />` or `<QuickBillingHomePage />` based on `AuthContext`. All POS sub-flows (checkout, scanner, returns, exchange) are modals/drawers within `QuickBillingHomePage` — no screen stack.

### Provider tree (App.tsx)

```
RootSiblingParent → PortalProvider → AuthProvider → CartProvider → SafeAreaView
```

- `RootSiblingParent` + `PortalProvider` — required for overlays that must render above the Vision Camera surface on Android
- `Toast` is rendered **outside** all providers as the last child of `RootSiblingParent`

### State management

Two React Contexts only:

- **`AuthContext`** (`src/context/auth-context.tsx`) — user/token, `login()`, `logout()`. Token persisted to AsyncStorage as `"AccessToken"`. Calls `AuthApi.verifyAuth()` on mount to validate stored token.
- **`CartContext`** (`src/context/cart-context.tsx`) — active cart items array with add/remove/update/clear. Persisted to AsyncStorage key `"cart"` on every mutation. `cartLoaded` flag gates cart-dependent renders.

Everything else is local component state: order tabs, payment form, product search results, UI open/close.

### Service layer

`src/services/api/` — one file per backend domain, no shared axios instance yet:

| File | Domain |
|---|---|
| `AuthApi.ts` | OTP generation, login, token verify |
| `productService.ts` | Product search, barcode lookup (`getMultipleProducts`) |
| `orderService.ts` | `refreshCart`, `placeOrder`, `orderPayment`, e-bill, UPI, GST |
| `customerService.ts` | Customer search and save |
| `holdOrderService.ts` | Save/resume/delete multi-order tab sessions on backend |
| `ReturnOrderApi.ts` | Return order lookup, reasons, item validation, save returns |

### Barcode scanning

`BarcodeDialog.tsx` uses `useCodeScanner` from Vision Camera. Key implementation details:

- **Scan lock:** `scanLockRef` (500ms debounce) prevents duplicate triggers from continuous frame analysis
- **Barcode normalization:** `rawBarcode.split('ST')[0]` strips store suffix before every API call
- **Auto-add rule:** If `getMultipleProducts` returns exactly 1 result, add directly and close dialog; if multiple, show selection list
- Fallback 1: manual text entry; Fallback 2: image from gallery via `@react-native-ml-kit/barcode-scanning`
- Camera component must **unmount** (not just hide) on close — use conditional rendering (`{show && <BarcodeDialog />}`) not a `visible` prop

### Checkout sequence (critical path)

`placeOrder` → `orderPayment` is an ordered two-step. Never reverse or retry automatically:
1. `orderService.refreshCart()` — backend recalculates totals, applies discounts — **must happen before every order placement**
2. `orderService.placeOrder()` — creates the order record
3. `orderService.orderPayment()` — records payment methods against the order
4. `orderService.sendLumeEbill()` — non-blocking, failure does not affect order status

If `placeOrder` succeeds but `orderPayment` fails, the order exists unpaid — surface the `orderId` to the cashier and do not auto-retry.

### Multi-order tabs

`QuickBillingHomePage` maintains an `orders` array in local state, persisted to AsyncStorage as `"pos_orders"`. Switching tabs calls `holdOrderService.smartSaveHoldOrder()` to sync the current cart to the backend.

### Key constraints

- Products are added **one at a time** — no bulk add flow exists
- The backend is the source of truth for all prices and discounts; client totals are estimates only
- `PortalModal` (not React Native `Modal`) must be used for any overlay that sits above the camera view
- All AsyncStorage keys must be constants — currently only `BASE_URL` is in `config.ts`; keys are inline strings in the codebase (known debt)

### Known architectural debt

- `QuickBillingHomePage.tsx` (~1127 lines) and `BarcodeDialog.tsx` (~1075 lines) need decomposition
- No shared axios instance with interceptors — each service file constructs its own headers
- `src/types/` files and several `src/utils/billing/` files are placeholders awaiting implementation

### Detailed documentation

The repo root (`C:/Apeirosai/mpos-app/`) contains 12 in-depth reference docs:
`INIT.md` (master context), `APP_ARCHITECTURE.md`, `POS_WORKFLOW.md`, `BARCODE_SCANNING_SYSTEM.md`, `STATE_MANAGEMENT.md`, `API_INTEGRATION.md`, `PAYMENT_WORKFLOWS.md`, `RETURN_EXCHANGE_SYSTEM.md`, `CUSTOMER_WORKFLOWS.md`, `UI_COMPONENT_SYSTEM.md`, `PERFORMANCE_GUIDELINES.md`, `DEVICE_COMPATIBILITY.md`, `TESTING_STRATEGY.md`.
