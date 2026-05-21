# RETURN_EXCHANGE_SYSTEM.md — Return and Exchange System

## 1. Overview

The MPOS app supports two post-sale workflows:

| Workflow | Trigger | Outcome |
|---|---|---|
| **Return** | Customer returns purchased items | Credit note or cash refund via backend |
| **Exchange** | Customer exchanges items from a purchase | New sale linked to return, net difference collected or refunded |

Both workflows are accessed from the main billing screen. Neither creates a new independent cart — they are linked to an original invoice.

---

## 2. Return Order Architecture

**Files:**
- `src/services/api/ReturnOrderApi.ts` — all backend calls
- `src/components/sections/home-page/ReturnOrderDrawer.tsx` — UI

**Entry point:** Header → Return button → `ReturnOrderDrawer` opens as a slide-in drawer.

---

## 3. Return Order Flow

```
Cashier taps "Return" in Header
    │
ReturnOrderDrawer opens
    │
Step 1: Bill Lookup
    Cashier enters original bill ID (invoice number)
    ReturnOrderApi.getOrderDetails(billId)
        → Returns: original items list, customer name, bill date, total
    │
    ├── Bill not found: "Invoice not found" toast, keep input active
    └── Bill found: display original order items
    │
Step 2: Item Selection
    Cashier selects items to return
    Per item: enter return quantity
    ReturnOrderApi.getItemDetails(itemCode, billId)
        → Validates returnable quantity (considers prior returns against this bill)
    │
Step 3: Reason Selection
    ReturnOrderApi.getReturnReasons()
        → List of reason options (e.g., "Defective", "Wrong Size", "Customer Changed Mind")
    Cashier selects reason per item
    │
Step 4: Quantity Validation
    For each selected item:
    ReturnOrderApi.getvalidateQuantity(itemCode, billId, size)
        → Returns: maxReturnQty (original qty minus already-returned qty)
    │
    ├── Return qty > maxReturnQty: show error, cap at max
    └── Return qty valid: proceed
    │
Step 5: Save Return
    ReturnOrderApi.getSaveReturns(returnItems)
        → Returns: { returnId, creditAmount, status }
    │
    ├── Success: show credit amount, offer credit note or cash refund option
    └── Failure: show error, allow retry (return is idempotent with same items)
    │
Drawer closes, credit info passed to active checkout if exchange follows
```

---

## 4. Return Order API Reference

```typescript
// Step 1: Get original order
POST /lumepos/ws/getOrderDetails
Body: { billId: string }
Response: {
  items: Array<{
    itemCode: string,
    name: string,
    quantity: number,
    netPrice: number,
    sku?: string,
    size?: string,
  }>,
  customerName: string,
  customerPhone?: string,
  billDate: string,
  totalAmount: number,
}

// Step 2: Get item details + returnable quantity
POST /lumepos/ws/getItemDetails
Body: { itemCode: string, billId: string }
Response: {
  item: OrderItem,
  maxReturnQty: number,  // Original qty minus previously returned qty
}

// Step 3: Get return reasons
GET /lumepos/ws/returnReasons
Response: Array<{ id: number, reason: string }>

// Step 4: Validate return quantity
POST /lumepos/ws/validateQuantity
Body: { itemCode: string, billId: string, size: string }
Response: { valid: boolean, maxQty: number }

// Step 5: Save return
POST /lumepos/ws/saveReturns
Body: {
  billId: string,
  items: Array<{
    itemCode: string,
    returnQty: number,
    reasonId: number,
    size?: string,
  }>
}
Response: {
  returnId: string,
  creditAmount: number,
  status: 'success' | 'error',
  message?: string,
}
```

---

## 5. Return Item Interface

```typescript
interface ReturnItem {
  itemCode: string;
  name: string;
  originalQty: number;
  returnQty: number;
  maxReturnQty: number;  // From getItemDetails/validateQuantity
  netPrice: number;
  reasonId: number;
  reason: string;
  size?: string;
  sku?: string;
}
```

---

## 6. Edge Cases in Return Flow

### Partial Return (Returning Some Items from Bill)

Supported. Cashier selects specific items and quantities. Not all items need to be returned.

### Multiple Returns Against Same Bill

Supported by the backend. `validateQuantity` and `getItemDetails` account for prior returns. The `maxReturnQty` returned will be `originalQty - alreadyReturnedQty`.

Example: Original purchase = 3 units. First return = 1 unit. Second return attempt maximum = 2 units.

### Return After Long Period

No time limit enforced client-side. Backend may enforce a return window (e.g., 30 days). If backend rejects with a time-limit error, show the backend's error message verbatim.

### Bill Not Found

```typescript
// getOrderDetails returns 404 or empty response
if (!orderDetails || !orderDetails.items?.length) {
  Toast.show({ type: 'error', text1: 'Invoice not found', text2: 'Check the bill number' });
  return;
}
```

### Damaged Item Return

Use the "Defective/Damaged" return reason. No special handling required client-side — the backend tracks damage separately for inventory purposes.

### Return Without Original Bill (No Bill ID)

Not supported in the current flow. Bill ID is mandatory. If the store policy allows returns without a bill, this workflow needs a backend API to support lookup by customer phone.

---

## 7. Exchange Order Flow

Exchange = Return (some items) + New Sale (replacement items)

**Entry:** Via `QuickBillingExchangeDialog` within the checkout flow, or initiated from `ReturnOrderDrawer` after a return.

```
After return is processed (or within checkout):
    │
QuickBillingExchangeDialog opens
    │
Shows returned items with credit value
    │
Cashier scans/searches replacement items
    │
Net calculation:
    returnCreditAmount = sum(returnedItems.price * returnQty)
    newItemsTotal = sum(newItems.price * qty)
    netDifference = newItemsTotal - returnCreditAmount
    │
    ├── netDifference > 0: Collect additional payment
    │       → Present payment options for the difference
    │
    ├── netDifference = 0: Even exchange, no payment
    │
    └── netDifference < 0: Issue credit note for difference
    │
Order placed with exchange flag
    placeOrder({ ..., isExchange: true, returnId, ... })
```

---

## 8. Exchange Order Data Flow

```typescript
interface ExchangePayload {
  originalBillId: string;
  returnId: string;
  returnedItems: ReturnItem[];
  newItems: CartItem[];
  returnCreditAmount: number;
  newItemsTotal: number;
  netPaymentDue: number;       // Positive = customer pays, Negative = refund to customer
  payments?: PaymentMethodData[];  // Only if netPaymentDue > 0
}
```

The exchange order is placed as a new order on the backend. The `returnId` links it to the original return for audit trail.

---

## 9. Credit Note Issuance

After a successful return:

```typescript
const returnResult = await ReturnOrderApi.getSaveReturns(items);

// returnResult.creditAmount = ₹ refund value
// Options presented to cashier:
// 1. Issue credit note (customer uses against future purchase)
// 2. Cash refund (backend records cash outflow)
```

If credit note issued:
- Backend generates credit note number
- Display credit note number prominently on screen
- Cashier communicates credit note number to customer
- Credit note can be used in future checkout via Credit Note payment method

---

## 10. Return Workflow Failure Scenarios

| Failure | Recovery |
|---|---|
| getOrderDetails fails | Show retry. If persistent, ask cashier to check bill ID. |
| getReturnReasons fails | Show inline error in reason dropdown. Block submission until resolved. |
| validateQuantity returns maxQty = 0 | Show "All units already returned" message. Remove item from selection. |
| saveReturns fails (network) | Non-idempotent risk — show retry with warning to check if return was already processed. |
| saveReturns returns error message | Show backend error verbatim. Common: "Return window expired", "Item not eligible for return". |
| ReturnOrderDrawer crashes mid-flow | Cart is unaffected. Return can be reattempted. No partial state to recover. |

### Handling duplicate return submission

If the network request fails after the backend has already processed the return, a retry would create a duplicate return. Before retrying `saveReturns`, check `getItemDetails` to see if `maxReturnQty` has decreased — this indicates the return was already processed.

```typescript
const handleReturnRetry = async () => {
  // Verify return wasn't already processed
  const itemCheck = await ReturnOrderApi.getItemDetails(items[0].itemCode, billId);
  if (itemCheck.maxReturnQty < originalMaxQty) {
    Toast.show({ type: 'info', text1: 'Return already processed successfully' });
    onReturnComplete(previousCreditAmount);
    return;
  }
  // Safe to retry
  await submitReturn();
};
```

---

## 11. UI/UX Guidelines for Returns

- **ReturnOrderDrawer** slides in from the right, overlaying the billing screen.
- Selected items should show a visual indicator (checkbox or highlight).
- Quantity inputs should show `maxReturnQty` as the maximum allowed.
- Return reasons should be a radio group (one reason per item) or dropdown.
- Credit amount should be displayed prominently before confirming.
- Confirm button should require explicit tap — no auto-submit.
- "Cancel" closes drawer without saving any state. No partial return is recorded unless `saveReturns` was called.

---

## 12. Permissions and Access Control

Return functionality is accessible to all authenticated cashiers. There is no client-side role check. If the backend enforces role-based return limits (e.g., manager approval required for returns above ₹X), it will return an appropriate error message that the client should display.

Future: If manager approval flow is added, the UI would need a "Request Manager Override" action that calls a backend approval endpoint.
