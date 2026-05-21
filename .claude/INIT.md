# MPOS App — Master Engineering Context

> This document is the authoritative reference for all AI-assisted and human development on this repository.
> Read this before making any architectural decision, adding any feature, or modifying any workflow.

---

## 1. Project Purpose

The Apeirosai MPOS app is a production-grade mobile Point of Sale (POS) application built in React Native. Its primary reason for existence is **high-performance barcode scanning** — a capability that was cost-prohibitive and latency-heavy in the existing web-based solution.

The app is the **cashier-facing billing terminal** for physical retail stores. It replaces slow, browser-based POS workflows with a mobile-native experience optimized for speed, reliability under poor connectivity, and single-handed operation on a handheld device.

**What this app is NOT:**
- It is not connected to the React.js website frontend.
- It is not a customer-facing app.
- It is not an inventory management system.
- It is not a reporting dashboard.

---

## 2. Backend Connections

| System | Purpose | Connection |
|---|---|---|
| Java Spring Boot backend | All business logic, product data, order placement, payments | REST API at `https://mpos.apeirosai.com` |
| JSP admin system | Admin configuration, GST settings, UPI config, categories | Same backend domain, different path |

The React Native app is a **thin client**. All pricing, discount, GST, and order logic lives on the backend. The app's job is to collect input, send it to the backend, and render results.

---

## 3. Architecture Overview

```
index.js
  └── App.tsx
        ├── RootSiblingParent          (portal/modal host)
        ├── PortalProvider             (overlay rendering context)
        ├── AuthProvider               (auth state + token)
        ├── CartProvider               (active cart state)
        └── SafeAreaView
              └── RootNavigator
                    ├── [unauthenticated] → LoginComponent
                    └── [authenticated]  → QuickBillingHomePage
                          ├── Header
                          ├── OrderTabsBar          (multi-order switching)
                          ├── QuickBillingSearchBar (search + barcode trigger)
                          ├── QuickBillingCartTable (live cart)
                          ├── BarcodeDialog         (camera scanner)
                          └── QuickBillingCheckout  (payment + invoice)
```

**Navigation:** No React Navigation library. Authentication gate is a conditional render in `App.tsx`. All POS interaction happens within a single screen (`QuickBillingHomePage`) using modal overlays and drawers.

**State:** React Context API only. No Redux, no Zustand. Two contexts: `AuthContext` and `CartContext`.

**Persistence:** `@react-native-async-storage/async-storage` for token, cart, bill type preference, and order tabs state.

**HTTP:** `axios` with Bearer token auth. Token stored in AsyncStorage as `"AccessToken"`.

---

## 4. App Scope

### In Scope
- Cashier login (OTP-based, Indian +91 mobile)
- Barcode scanning → product lookup → add to cart
- Manual product search by name
- Cart management (add, remove, quantity adjustment, manual price edit)
- Customer name and phone number collection
- GST / Non-GST invoice type selection
- Checkout with discounts applied from backend
- Multiple/split payment modes: Cash, Card, UPI, Credit Note
- Credit system validation
- Hold orders (save/resume billing sessions)
- Multi-order tabs (run multiple carts simultaneously)
- Return order processing
- Exchange order processing
- Invoice generation
- E-bill delivery to customer WhatsApp number

### Out of Scope
- Inventory management
- Product creation or editing
- Staff management
- Sales reporting
- Customer loyalty programs beyond credit notes
- Multi-store management
- Offline order placement (online-only checkout)

---

## 5. Feature Overview

### Barcode Scanning
Primary workflow. Uses `react-native-vision-camera` v4 with `useCodeScanner` hook. Supports EAN-13, EAN-8, UPC-A, UPC-E, CODE-128, QR. Fallback: `@react-native-ml-kit/barcode-scanning` for image-from-gallery scanning. Manual entry always available.

### Product Add Flow
Products are added **one at a time**. There is no multi-product bulk add. After scanning or searching, a product is selected, quantity defaulting to 1, and added to the active cart tab. Variant/size selection handled before add.

### Cart Management
Live cart in `CartContext`. Each cart item carries full product metadata (HSN, GST code, MRP, net price, department). Cart is persisted to AsyncStorage on every change. Backend `refreshCart` is called before checkout to recalculate totals and apply backend discounts.

### Multi-Order Tabs
Multiple simultaneous billing sessions ("Order 1", "Order 2", etc.) are supported via `pos_orders` in AsyncStorage and synced to backend hold orders via `holdOrderService`. Switching tabs saves the current order.

### Customer Info
Name and phone number collected at checkout. Used for invoice, e-bill delivery, and customer search/save. Phone is validated as 10-digit Indian number.

### Invoice Type
`taxInvoice` (with GST, requires CIN) or `invoice` (simplified). Selected per session. Persisted in AsyncStorage as `quickBilling_billType`.

### Payments
Split payments supported. Methods: Cash, Card (with last 4 digits), UPI (with configured UPI ID), Credit Note (with note number validation). Total must equal order total before placement.

### Return Orders
Accessed via ReturnOrderDrawer. Lookup by bill ID. Item-level return with reason selection and quantity validation against original purchase.

### Exchange Orders
Processed through exchange dialog. Links return items to new sale items.

### E-Bill / WhatsApp
After order placement, invoice sent to customer's WhatsApp number via `sendLumeEbill` or `sendEbillAndCreditNote`. Button visible on invoice/confirmation screen.

---

## 6. Workflow Philosophy

1. **Speed over features.** Every tap saved matters. Barcode scan → instant add is the ideal path.
2. **One product at a time.** No bulk add. The UX is optimized for the single-scan workflow.
3. **Backend is the source of truth.** Prices, discounts, GST rates, and totals come from the server. The client never calculates final billing amounts independently.
4. **Fail loudly at checkout, not during scanning.** Scanning errors should be retried silently. Payment errors must surface clearly.
5. **Cart state survives crashes.** AsyncStorage persistence ensures the cart is never lost on app kill.
6. **Connectivity is assumed but not guaranteed.** Product search and checkout require connectivity. The app should show clear error states, not hang indefinitely.

---

## 7. Folder Structure Philosophy

```
src/
  assets/          Static images only. No business logic.
  components/
    sections/      Feature-specific compound components (not shared primitives).
      home-page/   Components specific to the main billing screen.
      quick-billing/ Core POS feature components.
      login/       Auth screen components.
      ui/          Reusable primitives (button, input, avatar, dropdown, portal).
  context/         React Context providers. AuthContext and CartContext only.
  hooks/           Custom hooks. One concern per hook.
  screens/         Screen-level components (currently thin, logic lives in sections/).
  services/
    api/           One file per backend resource domain.
    constants/     config.ts with BASE_URL and shared constants.
  types/           TypeScript interfaces. One file per domain.
  utils/
    billing/       Cart calculation and discount logic utilities.
    products/      Product data mapping and transformation.
    storage/       AsyncStorage read/write wrappers.
    validation/    Input validators (phone, UPI, barcode).
```

**Rule:** If a component file exceeds ~400 lines, it must be decomposed. `QuickBillingHomePage.tsx` at 1127 lines is a known debt item.

---

## 8. Coding Standards

- **TypeScript strict mode.** No `any` except at API response boundaries, and only until types are defined.
- **Functional components only.** No class components.
- **No inline styles.** Use `StyleSheet.create()` for all styles.
- **No magic numbers.** Constants go in `src/services/constants/config.ts` or domain-specific constant files.
- **No `console.log` in production paths.** Use conditional dev-only logging.
- **Explicit return types** on all service functions.
- **Error handling at the API boundary.** Services catch axios errors and throw typed errors or return null. Components handle null states.
- **No business logic in components.** Components render state. Business logic lives in services, hooks, or utils.
- **AsyncStorage keys** must be defined as constants, never inline strings.

---

## 9. Component Architecture

Components are divided into three tiers:

**Tier 1 — UI Primitives** (`src/components/sections/ui/`)
Stateless, no API calls, no context reads. `button.tsx`, `input.tsx`, `avatar.tsx`, `dropdown-menu.tsx`, `portal.tsx`. These accept only props.

**Tier 2 — Feature Components** (`src/components/sections/quick-billing/`, `home-page/`)
Stateful, may read context, may call hooks. Do not call API services directly — receive callbacks as props or call hooks that wrap services.

**Tier 3 — Screen Containers** (`src/screens/`)
Coordinate data fetching, pass data to feature components, handle navigation. Currently thin; long-term destination for logic extracted from `QuickBillingHomePage`.

---

## 10. State Management Approach

Two React Contexts. No external state library.

**AuthContext** — Authentication only.
- `user` object with token
- `login(token, userData)` and `logout()`
- Initialization from AsyncStorage on mount

**CartContext** — Active cart only.
- Array of `CartItem` objects
- `addToCart`, `removeFromCart`, `updateQuantity`, `clearCart`, `setCart`
- Persisted to AsyncStorage on every mutation
- `cartLoaded` flag prevents rendering before hydration

**What does NOT go in context:**
- Order tabs state (local component state in `QuickBillingHomePage`, persisted via `pos_orders`)
- UI state (modal open/closed, scan active)
- Product search results (local component state)
- Payment form data (local component state)

---

## 11. API Communication Philosophy

- All requests require Bearer token from `AuthContext`.
- Base URL in `src/services/constants/config.ts`. Never hardcoded in service files.
- Each service file owns one domain (products, orders, customers, auth, returns, hold orders).
- Services return typed data or throw. They do not return `{ success, error }` wrappers — callers handle try/catch.
- `refreshCart` is always called immediately before order placement. Never skip this step.
- Request timeout: 10 seconds default. Long operations (sendEbill) may need 30 seconds.

---

## 12. Barcode Scanning Strategy

- **Primary path:** `react-native-vision-camera` `useCodeScanner` hook, live camera frame analysis.
- **Scan lock:** 500ms debounce on successful scan to prevent duplicate triggers.
- **Barcode normalization:** Strip `ST` suffix (`barcode.split('ST')[0]`) before lookup.
- **Fallback 1:** Manual text entry in BarcodeDialog.
- **Fallback 2:** Image upload from gallery → `@react-native-ml-kit/barcode-scanning`.
- **Torch control:** Toggle via Vision Camera torch prop. Always off by default.
- **Permission:** `CAMERA` permission required. Requested on first open, not on app start.
- **Auto-add rule:** If product lookup returns exactly 1 result, add directly without confirmation. If multiple, show selection list.

---

## 13. Performance Priorities

1. Barcode scan-to-cart time < 500ms (network dependent; scan recognition < 50ms)
2. Product search results appear within 300ms of debounce trigger (300ms debounce)
3. Cart render does not rerender non-affected items on quantity change
4. App cold start < 3 seconds on mid-range Android
5. No memory leaks from camera frames — Vision Camera frame processor cleanup is mandatory
6. `refreshCart` must not block the UI — show loading indicator, not spinner overlay
7. AsyncStorage reads are async — never block render waiting for storage

---

## 14. UI/UX Expectations

- **Target device:** Mid-range Android handset (2GB RAM, 720p screen). iOS is secondary.
- **One-handed operation:** Primary actions reachable with thumb. Cart at bottom. Scanner at top.
- **Toast feedback:** Every scan result, add-to-cart, and error gets a `react-native-toast-message` notification.
- **No loading spinners blocking the screen** unless payment is processing.
- **Numeric keyboards** for all quantity and price inputs. No full keyboard unless searching by name.
- **Haptic or audible feedback** on scan (if available).
- **Dark mode:** Not required. Light mode only.
- **Text sizes:** Minimum 14sp body, 16sp product names, 18sp totals.

---

## 15. Error Handling Standards

| Scenario | Behavior |
|---|---|
| Network request fails | Show toast with user-friendly message. Log error in dev. |
| Product not found by barcode | Show "Product not found" toast. Keep scanner active. |
| Invalid OTP | Show inline error message. Preserve form state. |
| Checkout total mismatch | Block order placement. Show error with breakdown. |
| Credit note invalid | Show specific backend error message. |
| Camera permission denied | Show actionable prompt to open Settings. |
| Session expired (401) | Clear token, redirect to login. |
| AsyncStorage read failure | Fall back to empty state. Log error. |

**Never show raw error messages or stack traces to the user.** All user-facing errors must be human-readable.

---

## 16. Authentication / Session Handling

- Login: OTP-based to Indian mobile (+91). Two steps: generate OTP → verify OTP.
- Token: Bearer token stored in AsyncStorage as `"AccessToken"`.
- Session validation: `verifyAuth()` called on app start.
- Auto-logout on 401 response from any API call.
- Org data (`orgName`, `storeName`, `tenantId`) stored in AsyncStorage after login.
- Device OTP verification (`verifyDeviceOtp`) is a secondary auth layer for new devices.
- No token refresh flow currently. Session re-login required on expiry.

---

## 17. Scalability Expectations

- The app is designed for a **single store, single cashier** session model.
- Multi-order tabs (up to ~5 concurrent) are the extent of parallelism.
- Product catalog size is not a concern — search is server-side.
- No offline mode. Network is required for all business operations.
- Future: multi-store switching may require tenant-aware API calls.
- Future: receipt printer integration (Bluetooth/WiFi thermal printer).
- Future: customer display (second-screen mirror).

---

## 18. Future Extensibility Goals

| Goal | Prerequisite |
|---|---|
| Bluetooth receipt printer | BLE library integration, print template system |
| Offline product cache | SQLite or WatermelonDB, sync strategy |
| Loyalty points display | Customer profile API integration |
| Multi-language support | i18n library, string extraction |
| Product image scanning | ML Kit image labeling |
| Dashboard/reports screen | New screen, new API endpoints |
| React Navigation adoption | Refactor App.tsx navigation gate |

---

## 19. Key Files Quick Reference

| File | Purpose |
|---|---|
| `src/components/sections/quick-billing/QuickBillingHomePage.tsx` | Main POS screen (1127 lines — decomposition needed) |
| `src/components/sections/home-page/BarcodeDialog.tsx` | Camera scanner (1075 lines) |
| `src/components/sections/quick-billing/QuickBillingCheckout.tsx` | Payment + invoice |
| `src/context/auth-context.tsx` | Auth state |
| `src/context/cart-context.tsx` | Cart state |
| `src/services/api/orderService.ts` | Order placement, cart refresh, e-bill |
| `src/services/api/productService.ts` | Product search, barcode lookup |
| `src/services/api/ReturnOrderApi.ts` | Return order flow |
| `src/services/api/holdOrderService.ts` | Save/resume order sessions |
| `src/services/constants/config.ts` | BASE_URL and global constants |
| `src/utils/storage/tokenStorage.ts` | Token read/write |
| `src/utils/storage/cartStorage.ts` | Cart persistence |

---

## 20. Repository Conventions

- Branch naming: `feature/`, `fix/`, `chore/`
- Commit messages: imperative mood, present tense (`add barcode torch toggle`, not `added`)
- No `console.log` left in committed code
- All new files must have TypeScript types — no implicit `any`
- Test new utility functions. UI component tests are optional but encouraged.
- Run `eslint` before committing. Warnings are acceptable, errors are not.
