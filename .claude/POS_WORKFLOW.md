# POS_WORKFLOW.md — Point of Sale Workflow Documentation

## 1. Workflow Philosophy

The MPOS app is built around one guiding principle: **the fastest path from barcode scan to completed sale**. Every workflow decision optimizes for speed. Cashier time is retail revenue. A 5-second improvement per transaction across 200 daily transactions is 17 minutes of productivity per day.

**Core workflow axioms:**
- Barcode scan is always faster than search. Design for scan-first.
- Products are added one at a time. Never batch add.
- The backend calculates prices. The app collects input and displays results.
- Cart state persists across crashes. Nothing is ever truly lost.

---

## 2. Session Lifecycle

```
App launch
    │
    ▼
Token check (AsyncStorage "AccessToken")
    │
    ├── Token missing/expired ──► Login screen
    │                                │
    │                           OTP generation
    │                                │
    │                           OTP verification
    │                                │
    │                           Token stored
    │                                │
    └── Token valid ◄────────────────┘
    │
    ▼
QuickBillingHomePage loads
    │
    ├── Hydrate cart from AsyncStorage
    ├── Hydrate order tabs from AsyncStorage
    └── Load UPI config from backend
    │
    ▼
Billing session active
    │
    ▼
[Cart is built → Checkout → Order placed → Cart cleared]
    │
    ▼
Ready for next order
```

---

## 3. Order Tab Lifecycle

Multi-order tabs allow a cashier to run multiple billing sessions simultaneously (e.g., two customers being served in parallel).

```
QuickBillingHomePage mounts
    │
    ├── Load saved orders from AsyncStorage ('pos_orders')
    └── If none, initialize with one default order: Order 1

User taps "+" (add tab)
    │
    ├── Create new order object: { id: uuid, name: 'Order N', items: [], ... }
    ├── Save current order to backend (smartSaveHoldOrder)
    └── Switch to new order tab

User switches tabs
    │
    ├── Save current tab state to AsyncStorage
    ├── Restore CartContext items from selected tab's item list
    └── Re-render cart

User taps "×" (close tab)
    │
    ├── If items present: confirm discard
    ├── Call removeHoldOrder(billReference)
    └── Remove tab from local state
```

**Hold order sync:**
- Every tab switch calls `smartSaveHoldOrder` to persist cart to backend.
- On app resume (foreground), restore tabs from `pos_orders` in AsyncStorage.
- Hold orders are identifiable by `billReference` (UUID generated client-side).

---

## 4. Product Discovery Workflow

### 4.1 Barcode Scan Path (Primary)

```
Cashier taps camera icon / scan button
    │
    ▼
BarcodeDialog opens
    │
Camera initializes
    │
Camera frames analyzed by useCodeScanner
    │
Barcode detected (EAN-13, EPC, CODE-128, etc.)
    │
Scan lock engaged (500ms debounce)
    │
Barcode normalized: barcode.split('ST')[0]
    │
productService.getMultipleProducts([normalizedBarcode])
    │
    ├── 0 results: toast "Product not found" → keep scanner open
    ├── 1 result:  auto-add to cart → close dialog → success toast
    └── N results: show selection list → user picks variant → add to cart
```

**Torch control:** Cashier can toggle flash/torch within BarcodeDialog. State is ephemeral (not persisted).

**Image fallback:** If camera scanning fails, cashier can pick an image from gallery. `@react-native-ml-kit/barcode-scanning` processes the image.

**Manual entry fallback:** Text input always visible in BarcodeDialog for typed barcode entry.

### 4.2 Search Path (Secondary)

```
Cashier types in QuickBillingSearchBar
    │
useDebounce (300ms delay)
    │
productService.searchProducts(query)
    │
Results list renders below search bar
    │
Cashier taps product
    │
    ├── If product has variants: show ProductDetailModal for size/variant selection
    └── If single SKU: add directly to cart
```

**Minimum search length:** 2 characters before triggering API call.

**Search clears on product add:** Input resets after successful add to prepare for next scan.

---

## 5. Cart Management Workflow

### 5.1 Adding a Product

```
Product selected (from scan or search)
    │
CartContext.addToCart(product)
    │
    ├── Check if product (by id/sku) already in cart
    ├── If exists: increment quantity
    └── If new: append with quantity: 1
    │
AsyncStorage save (debounced via lastSavedCartRef)
    │
CartTable re-renders with updated list
```

### 5.2 Quantity Adjustment

```
Cashier taps quantity field on cart row
    │
Numeric keyboard opens
    │
CartContext.updateQuantity(id, newQty)
    │
    ├── If newQty === 0: prompt to remove item
    └── If newQty > 0: update quantity
    │
AsyncStorage save
```

**Quantity constraints:** Maximum quantity is not enforced client-side. Backend `refreshCart` enforces stock limits and returns adjusted quantities.

### 5.3 Removing an Item

```
Cashier taps delete/remove on cart row
    │
    ├── If item is only item: confirm before removing (empty cart warning)
    └── CartContext.removeFromCart(id)
    │
AsyncStorage save
```

### 5.4 Price Override

Cashiers may manually override `netPrice` for specific items (admin-configured permission). Price edit:
- Tapping price field opens numeric input
- New value replaces `netPrice`
- Backend `refreshCart` revalidates and may reject invalid prices

---

## 6. Customer Info Workflow

Customer data is collected in `QuickBillingCustomerInfo` before or at checkout:

```
Customer info section (always visible above checkout)
    │
Cashier enters customer name (optional) or phone number
    │
If phone entered:
    │
    ├── Validate: 10 digits, Indian format
    ├── customerService.searchCustomers(name, phone)
    └── If existing customer found: pre-fill name
    │
Phone and name saved with order payload
```

**Bill type selection** (in same component):
- Toggle between "Tax Invoice" (GST) and "Invoice" (non-GST)
- Selection persisted to AsyncStorage `quickBilling_billType`
- Affects invoice format rendered by backend

---

## 7. Checkout Workflow

This is the most critical and complex workflow. Any error here means a failed transaction.

```
Cashier taps "Checkout" button
    │
Step 1: Cart refresh
    orderService.refreshCart(cartItems)
    ├── Backend recalculates totals, applies store-level discounts
    ├── Returns updated items with final prices, GST, net amounts
    └── CartContext.setCart(refreshedItems)
    │
Step 2: Checkout modal opens
    QuickBillingCheckout renders with refreshed totals
    │
Step 3: Payment method entry
    ├── Cashier selects payment method(s): Cash / Card / UPI / Credit Note
    ├── Enters amount per method
    └── Split payments: multiple methods allowed, must sum to order total
    │
Step 4: Payment validation (client-side)
    ├── Total of all payment method amounts === order total
    ├── UPI: UPI ID must be configured
    ├── Card: last 4 digits required
    └── Credit Note: note number required
    │
Step 5: Order placement
    orderService.placeOrder(orderPayload)
    ├── Payload includes: cart items, customer info, bill type, payment breakdown
    └── Returns: orderId
    │
Step 6: Payment recording
    orderService.orderPayment({ orderId, payments: [...] })
    │
Step 7: E-bill (optional but encouraged)
    ├── If customer phone provided: offer e-bill button
    ├── orderService.sendLumeEbill(orderId)  [or sendEbillAndCreditNote]
    └── WhatsApp opens with invoice link
    │
Step 8: Order completion
    ├── CartContext.clearCart()
    ├── Close checkout modal
    ├── Remove hold order from backend if tab was held
    └── Reset order tab or close it
```

**Failure handling at each step:**

| Step | Failure | Recovery |
|---|---|---|
| Cart refresh | Network error | Block checkout, show retry button |
| Cart refresh | Stock insufficient | Show which items failed, allow removal |
| Order placement | Network error | Do not double-submit. Show retry. |
| Order placement | Backend validation error | Show specific message. Keep modal open. |
| Payment recording | Failure after placeOrder | Show orderId to cashier for manual reconciliation |
| E-bill send | Failure | Non-blocking. Show failure toast. Cashier can retry. |

**Critical rule:** Never retry `placeOrder` automatically. If it fails, the cashier must confirm the order wasn't placed before retrying. Duplicate orders are a billing integrity issue.

---

## 8. Hold Order Workflow

```
Cashier taps "Hold" on current order tab
    │
holdOrderService.smartSaveHoldOrder({
  billReference: tabId,
  cartItems,
  customerName,
  customerPhone,
  billType,
})
    │
Backend saves hold order
    │
Tab remains active with held status indicator
    │
Cashier resumes:
    holdOrderService.getHoldOrderDetails(billReference)
    → restore cart and customer info to tab
```

**Edge cases:**
- Hold order save fails → cart saved locally in AsyncStorage. Warn cashier.
- Session expires while hold order exists → hold order persists on backend under tenant. New session can restore.
- Maximum hold orders: not enforced client-side. Backend may have limits.

---

## 9. Return Order Workflow

Detailed in `RETURN_EXCHANGE_SYSTEM.md`. Summary:

```
Header → Return button → ReturnOrderDrawer opens
    │
Cashier enters bill ID (original invoice number)
    │
ReturnOrderApi.getOrderDetails(billId)
    → display original order items
    │
Cashier selects items to return + quantities
    │
ReturnOrderApi.getReturnReasons() → reason dropdown
    │
Cashier selects return reason per item
    │
ReturnOrderApi.getSaveReturns(selectedItems)
    │
Return confirmed → credit note or cash refund
```

---

## 10. Exchange Order Workflow

```
Within QuickBillingCheckout or via exchange dialog:
    │
Select returned items (from previous return order or current session)
    │
QuickBillingExchangeDialog opens
    │
Add new items via search/scan
    │
Net difference calculated
    ├── If new items cost more: collect difference payment
    └── If new items cost less: issue credit note or refund difference
    │
Order placed with exchange flag
```

---

## 11. Discount Application

Discounts are **server-side only**. The client does not calculate or display discount amounts before `refreshCart`.

```
refreshCart() response includes:
  ├── discountAmount (total discount)
  ├── discountPercent
  ├── finalAmount
  └── Per-item: discountedPrice, originalPrice
```

**Manual discount override:** If admin-enabled, cashier may enter a percentage discount. This is sent as part of the order payload. Backend validates against maximum allowed discount for the cashier's role.

---

## 12. GST Handling

| Invoice Type | GST Applied | CIN Required |
|---|---|---|
| `taxInvoice` | Yes | Yes (Company Identification Number) |
| `invoice` | No | No |

- CIN is fetched via `orderService.getGst()` on checkout open.
- If CIN not configured, prompt cashier to enter it. Saved via `orderService.saveGst(cinNo)`.
- GST breakdown is included in the invoice PDF generated by the backend.
- `vatbit` and `gstctype` on each CartItem determine per-product GST rates.

---

## 13. Multi-Payment Scenarios

| Scenario | Handling |
|---|---|
| Full cash | Single Cash entry, amount = total |
| Partial cash + UPI | Cash + UPI amounts, must sum to total |
| Full card | Single Card entry with last 4 digits |
| Credit note + cash | Credit note validated first, balance as cash |
| Credit note full | Credit note amount === total, no additional payment |
| UPI | UPI ID auto-populated from saved config |

**Validation rule:** No order placement until `sum(paymentAmounts) === orderTotal`. Show remaining balance to collect in real-time as cashier enters amounts.

---

## 14. Session Recovery Scenarios

| Scenario | Behavior |
|---|---|
| App killed mid-cart | Cart reloaded from AsyncStorage on next launch |
| App killed mid-checkout | Cart reloaded. Checkout must be restarted. No duplicate order. |
| Network lost during scan | Product lookup fails. Retry scan when network restores. |
| Network lost during checkout | Block order placement. Show offline indicator. |
| Token expired mid-session | 401 interceptor redirects to login. Cart preserved. |
| Device restart | Cart and tab state restored from AsyncStorage on next launch. |
