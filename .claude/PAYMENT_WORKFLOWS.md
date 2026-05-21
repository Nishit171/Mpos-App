# PAYMENT_WORKFLOWS.md — Payment Workflows

## 1. Payment Architecture Overview

Payment in the MPOS app is a **two-step process**:
1. `placeOrder` — creates the order record with item details
2. `orderPayment` — records the payment method(s) against the order

Both steps must succeed for a transaction to be complete. If `placeOrder` succeeds but `orderPayment` fails, the order exists on the backend without a payment record. This requires manual reconciliation.

**Never reverse the order.** Always place the order first, then record payment.

---

## 2. Supported Payment Methods

| Method | Code | Additional Data Required |
|---|---|---|
| Cash | `cash` | None |
| Card (Debit/Credit) | `card` | Last 4 digits of card |
| UPI | `upi` | UPI ID (pre-configured or entered) |
| Credit Note | `creditNote` | Credit note number |

---

## 3. Payment Method Data Interface

```typescript
interface PaymentMethodData {
  method: 'cash' | 'card' | 'upi' | 'creditNote';
  amount: number;
  cardNumber?: string;        // Last 4 digits only
  upiId?: string;             // Full UPI ID (e.g., "store@paytm")
  creditNoteNumber?: string;  // Credit note reference number
}
```

---

## 4. Split Payment Logic

The MPOS supports **split payments** — paying with multiple methods for a single order.

### Rules

1. Sum of all payment amounts MUST equal the order total
2. No overpayment or underpayment allowed
3. A single method can be used only once per transaction
4. At least one payment method must be entered

### Client-side validation

```typescript
const validatePayments = (
  payments: PaymentMethodData[],
  orderTotal: number
): { valid: boolean; message?: string } => {
  if (payments.length === 0) {
    return { valid: false, message: 'Select at least one payment method' };
  }

  const total = payments.reduce((sum, p) => sum + p.amount, 0);
  // Use toFixed to avoid floating point errors
  if (parseFloat(total.toFixed(2)) !== parseFloat(orderTotal.toFixed(2))) {
    const diff = orderTotal - total;
    return {
      valid: false,
      message: diff > 0
        ? `₹${diff.toFixed(2)} still to be collected`
        : `Payment exceeds total by ₹${Math.abs(diff).toFixed(2)}`,
    };
  }

  // Validate per-method requirements
  for (const payment of payments) {
    if (payment.method === 'card' && !payment.cardNumber?.match(/^\d{4}$/)) {
      return { valid: false, message: 'Enter last 4 digits of card' };
    }
    if (payment.method === 'upi' && !payment.upiId) {
      return { valid: false, message: 'UPI ID not configured' };
    }
    if (payment.method === 'creditNote' && !payment.creditNoteNumber) {
      return { valid: false, message: 'Enter credit note number' };
    }
  }

  return { valid: true };
};
```

### Floating Point Handling

Monetary amounts must never be compared with `===`. Use `toFixed(2)` comparison or multiply by 100 and compare integers:

```typescript
// Correct
Math.round(total * 100) === Math.round(orderTotal * 100)

// Wrong — floating point errors
total === orderTotal
```

---

## 5. Cash Payment Flow

```
Cashier selects "Cash"
    │
Cashier enters cash received amount
    │
If amount > orderTotal:
    Show change to return = receivedAmount - orderTotal
    Set payment amount = orderTotal (not received amount)
    │
Confirm payment
    │
→ orderService.orderPayment({ method: 'cash', amount: orderTotal })
```

**Change calculation display:**

```typescript
const changeToReturn = cashReceived > orderTotal
  ? cashReceived - orderTotal
  : 0;
```

Show change amount prominently. This is the most common payment method.

---

## 6. Card Payment Flow

```
Cashier selects "Card"
    │
Cashier enters last 4 digits of card
    │
System displays order total for card swipe reference
    │
Cashier processes card on physical terminal (not in-app)
    │
Cashier confirms card payment in app
    │
→ orderService.orderPayment({ method: 'card', amount, cardNumber: lastFour })
```

**Important:** The app does NOT process card payments. It records the last 4 digits for audit trail only. The actual card transaction happens on a separate POS terminal. The cashier manually confirms after the physical terminal approves.

---

## 7. UPI Payment Flow

```
Checkout opens
    │
UPI config fetched: orderService.getUpiId()
    │
    ├── UPI ID found: display existing UPI ID
    └── No UPI ID: show input to configure
    │
Cashier presents UPI QR or shares UPI ID with customer
    │
Customer completes UPI payment on their device
    │
Cashier confirms receipt in app
    │
→ orderService.orderPayment({ method: 'upi', amount, upiId })
```

**UPI ID management:**
```typescript
// Update UPI ID
const handleSaveUpi = async (newUpiId: string) => {
  if (!validateUpiId(newUpiId)) {  // src/utils/validation/upiValidation.ts
    Toast.show({ type: 'error', text1: 'Invalid UPI ID format' });
    return;
  }
  await orderService.saveUpi({ upiId: newUpiId });
  // Trigger re-fetch via upiRefreshTrigger
  setUpiRefreshTrigger(prev => prev + 1);
};
```

**UPI validation:**
```typescript
// src/utils/validation/upiValidation.ts
export const validateUpiId = (upiId: string): boolean => {
  // VPA format: identifier@provider
  return /^[\w.\-]+@[\w.\-]+$/.test(upiId);
};
```

---

## 8. Credit Note Payment Flow

```
Cashier selects "Credit Note"
    │
Cashier enters credit note number
    │
orderService.validateCreditNote({ creditNoteNumber, amount })
    │
    ├── Valid: show available balance, allow use
    │         If credit note amount < order total: collect balance via other method
    │         If credit note amount >= order total: full credit note payment
    │
    └── Invalid: show backend error message, clear input
    │
On order placement:
    → orderService.orderPayment({ method: 'creditNote', amount, creditNoteNumber })
    → If e-bill: orderService.sendEbillAndCreditNote(payload)
```

**Partial credit note scenario:**

```typescript
// If credit note covers ₹800 of a ₹1200 order:
payments = [
  { method: 'creditNote', amount: 800, creditNoteNumber: 'CN-12345' },
  { method: 'cash', amount: 400 },
]
// Total = 1200 ✓
```

**Credit note validation response handling:**

```typescript
const handleCreditNoteValidation = async (noteNumber: string, amount: number) => {
  try {
    const result = await orderService.validateCreditNote({ creditNoteNumber: noteNumber, amount });

    if (!result.valid) {
      Toast.show({ type: 'error', text1: result.message ?? 'Invalid credit note' });
      setCreditNoteValid(false);
      return;
    }

    setCreditNoteBalance(result.availableBalance ?? 0);
    setCreditNoteValid(true);
  } catch {
    Toast.show({ type: 'error', text1: 'Could not validate credit note' });
  }
};
```

---

## 9. Full Checkout Sequence

```typescript
const executeCheckout = async () => {
  // Step 1: Validate payments client-side
  const validation = validatePayments(payments, orderTotal);
  if (!validation.valid) {
    Toast.show({ type: 'error', text1: validation.message });
    return;
  }

  setLoading(true);

  try {
    // Step 2: Place order (creates order record)
    const orderResult = await orderService.placeOrder({
      items: cartItems,
      customerName,
      customerPhone,
      billType,
      cinNo: billType === 'taxInvoice' ? cinNo : undefined,
      totalAmount: orderTotal,
      discountAmount,
      billReference: activeOrder.billReference,
    });

    const orderId = orderResult.orderId;

    // Step 3: Record payment(s)
    await orderService.orderPayment({
      orderId,
      payments: payments.map(p => ({
        method: p.method,
        amount: p.amount,
        cardNumber: p.cardNumber,
        upiId: p.upiId,
        creditNoteNumber: p.creditNoteNumber,
      })),
    });

    // Step 4: E-bill (non-blocking)
    if (customerPhone && sendEbill) {
      orderService.sendLumeEbill(orderId).catch(() => {
        Toast.show({ type: 'info', text1: 'E-bill could not be sent', visibilityTime: 3000 });
      });
    }

    // Step 5: Complete
    onOrderComplete(orderId);

  } catch (error) {
    handleCheckoutError(error, orderId);
  } finally {
    setLoading(false);
  }
};
```

---

## 10. Checkout Error Handling

### After placeOrder fails

```typescript
if (step === 'placing') {
  // Order was not created — safe to retry
  Toast.show({
    type: 'error',
    text1: 'Order Failed',
    text2: 'Your cart is intact. Please try again.',
  });
}
```

### After placeOrder succeeds but orderPayment fails

```typescript
if (step === 'payment') {
  // CRITICAL: Order exists, payment not recorded
  // Show order ID to cashier for reconciliation
  Toast.show({
    type: 'error',
    text1: 'Payment Recording Failed',
    text2: `Order #${orderId} created. Note this number and contact support.`,
    visibilityTime: 10000,  // Long visibility
  });
  // DO NOT clear cart
  // DO NOT close checkout modal
  // Offer manual retry for payment only
}
```

### After both succeed but e-bill fails

```typescript
// Non-critical — order is complete
Toast.show({
  type: 'info',
  text1: 'E-Bill Not Sent',
  text2: 'Order complete. You can resend from the invoice screen.',
});
onOrderComplete(orderId);  // Proceed normally
```

---

## 11. GST Invoice Selection

| Invoice Type | When to Use | Backend Effect |
|---|---|---|
| `taxInvoice` | GST-registered customer | Includes GST breakup, requires CIN |
| `invoice` | Regular retail sale | Simplified format, no GST detail |

**CIN requirement for taxInvoice:**

```typescript
// Before checkout, ensure CIN is configured
const cinNo = await orderService.getGst();

if (billType === 'taxInvoice' && !cinNo) {
  // Prompt cashier to enter CIN
  setShowCinPrompt(true);
  return;
}
```

The CIN (Company Identification Number) is set once per store by the admin. If missing, prompt the cashier to enter it. Save via `orderService.saveGst(cinNo)`.

---

## 12. E-Bill and WhatsApp Integration

E-billing is the primary invoice delivery method. After a successful order:

```typescript
// Primary e-bill send
const handleSendEbill = async (orderId: string, customerPhone: string) => {
  try {
    setEbillLoading(true);
    const result = await orderService.sendLumeEbill(orderId);

    if (result.invoiceUrl) {
      // Option to open WhatsApp directly
      const whatsappUrl = `https://wa.me/91${customerPhone}?text=${encodeURIComponent(`Your invoice: ${result.invoiceUrl}`)}`;
      await Linking.openURL(whatsappUrl);
    }

    Toast.show({ type: 'success', text1: 'E-bill sent!' });
  } catch {
    Toast.show({ type: 'error', text1: 'E-bill failed. Retry from invoice screen.' });
  } finally {
    setEbillLoading(false);
  }
};
```

**WhatsApp deeplink format:**
```
https://wa.me/91<10-digit-phone>?text=<encoded-message>
```

The `91` prefix is the India country code. Always prepend for Indian mobile numbers.

---

## 13. Refund Scenarios

Direct refunds are not handled in the payment flow. Refunds are processed through the Return Order system (see `RETURN_EXCHANGE_SYSTEM.md`). Return orders generate credit notes or cash refund records on the backend.

---

## 14. Payment Security Considerations

- Card numbers: only last 4 digits stored. Never collect or transmit full card numbers.
- UPI IDs: transmitted over HTTPS to backend only. Not logged.
- Credit note numbers: treated as sensitive. Not logged.
- All payment data transmitted over HTTPS (`https://mpos.apeirosai.com`).
- No payment data stored in AsyncStorage. Payment state is session-only.
- Order IDs and payment confirmations logged to backend only, not client-side.
