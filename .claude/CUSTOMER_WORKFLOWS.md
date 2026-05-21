# CUSTOMER_WORKFLOWS.md — Customer Workflows

## 1. Customer Data in the MPOS App

Customer data in this app serves three purposes:
1. **Invoice personalization** — name and phone on the printed/digital invoice
2. **E-bill delivery** — WhatsApp invoice sent to customer's phone
3. **Customer history** — save customer for repeat lookup on future visits

Customer data is **optional for most transactions** but required for e-bill delivery and tax invoices.

---

## 2. Customer Info Collection

**Component:** `QuickBillingCustomerInfo`
**Location:** `src/components/sections/quick-billing/QuickBillingCustomerInfo.tsx`

Displayed in the billing screen at all times (not just at checkout). This allows the cashier to capture customer info early while scanning products.

### Fields

| Field | Type | Required | Validation |
|---|---|---|---|
| Customer Name | string | No | No special validation. Any text. |
| Customer Phone | string | No (Yes for e-bill) | 10 digits, Indian format |
| Bill Type | enum | Yes | `'taxInvoice'` or `'invoice'` |

### Phone Number Validation

```typescript
// src/utils/validation/phoneValidation.ts
export const validateIndianPhone = (phone: string): boolean => {
  return /^[6-9]\d{9}$/.test(phone);
};
// Indian mobile numbers start with 6, 7, 8, or 9
// Landlines are NOT supported
```

---

## 3. Customer Search and Auto-Fill

When the cashier enters a phone number, the app searches for an existing customer record:

```typescript
// In QuickBillingCustomerInfo (or a parent hook)
const handlePhoneChange = async (phone: string) => {
  setCustomerPhone(phone);

  if (phone.length === 10 && validateIndianPhone(phone)) {
    try {
      const results = await customerService.searchCustomers('', phone);
      if (results.length > 0) {
        // Auto-fill name from existing customer
        setCustomerName(results[0].name);
        Toast.show({ type: 'info', text1: `Customer: ${results[0].name}` });
      }
    } catch {
      // Silent fail — don't block the flow if search fails
    }
  }
};
```

**Behavior:**
- Auto-fill is triggered when 10 digits are entered
- If multiple customers match the phone (unlikely but possible), use the first result
- If no match, the cashier enters the name manually
- Search failure is silent — does not block checkout

---

## 4. Customer Save

At order placement, if a phone number was entered, the customer is saved (or updated) on the backend:

```typescript
// In checkout flow, non-blocking
const saveCustomerIfNew = async (name: string, phone: string) => {
  if (!phone || !validateIndianPhone(phone)) return;

  try {
    await customerService.saveCustomer({ name, mobileNum: phone });
  } catch {
    // Non-critical — order can complete without customer save
  }
};
```

**Timing:** Call `saveCustomer` after `placeOrder` succeeds. Never block order placement on customer save.

---

## 5. Customer Service API

**File:** `src/services/api/customerService.ts`

```typescript
// Search customers by name or phone
POST /lumepos/ws/ftk/search
Body: { name?: string, mobileNum?: string }
Response: Array<{
  id: string,
  name: string,
  mobileNum: string,
  lastOrderDate?: string,
  totalOrders?: number,
}>

// Save or update customer
POST /lumepos/ws/ftk/saveCustomer
Body: {
  name: string,
  mobileNum: string,
}
Response: {
  customerId: string,
  status: 'created' | 'updated',
}
```

**Search by name:** Used for customer lookup by name when cashier remembers the name but not the phone. Minimum 2 characters.

**Search by phone:** Used for auto-fill on phone entry. Exact 10-digit match.

---

## 6. Bill Type Selection

Bill type is a critical customer-facing decision:

| Bill Type | Display Label | GST on Invoice | CIN Required |
|---|---|---|---|
| `taxInvoice` | "Tax Invoice" | Yes | Yes |
| `invoice` | "Invoice" | No | No |

**UI:** Toggle buttons or radio selection in `QuickBillingCustomerInfo`.

**Persistence:** Bill type selection is stored in AsyncStorage as `quickBilling_billType`. The cashier's last selection is restored on next session.

```typescript
// On bill type change
const handleBillTypeChange = async (type: 'taxInvoice' | 'invoice') => {
  setBillType(type);
  await AsyncStorage.setItem(STORAGE_KEYS.BILL_TYPE, type);
};

// On mount — restore preference
useEffect(() => {
  AsyncStorage.getItem(STORAGE_KEYS.BILL_TYPE).then(saved => {
    if (saved === 'taxInvoice' || saved === 'invoice') {
      setBillType(saved);
    }
  });
}, []);
```

---

## 7. E-Bill Workflow

E-bill is the primary invoice delivery method. It sends the invoice to the customer's WhatsApp number.

### Prerequisites
- `customerPhone` must be a valid 10-digit Indian number
- Order must be placed successfully (have an `orderId`)
- Backend must have generated the invoice PDF

### Flow

```
Order placed successfully
    │
Invoice screen / confirmation visible
    │
"E-Bill" button displayed (if customerPhone present)
    │
Cashier taps E-Bill
    │
orderService.sendLumeEbill(orderId)
    │
Response includes invoice URL
    │
WhatsApp opens with pre-filled message:
    wa.me/91{customerPhone}?text={encoded invoice link}
    │
Customer receives invoice on WhatsApp
```

### Implementation

```typescript
const handleSendEbill = async () => {
  if (!customerPhone || !validateIndianPhone(customerPhone)) {
    Toast.show({ type: 'error', text1: 'Valid phone number required for E-Bill' });
    return;
  }

  setEbillLoading(true);
  try {
    const result = await orderService.sendLumeEbill(orderId);

    const message = result.invoiceUrl
      ? `Your invoice from ${storeName}: ${result.invoiceUrl}`
      : `Thank you for shopping at ${storeName}!`;

    const whatsappUrl = `https://wa.me/91${customerPhone}?text=${encodeURIComponent(message)}`;

    const canOpen = await Linking.canOpenURL(whatsappUrl);
    if (canOpen) {
      await Linking.openURL(whatsappUrl);
      Toast.show({ type: 'success', text1: 'WhatsApp opened' });
    } else {
      Toast.show({ type: 'error', text1: 'WhatsApp not installed on this device' });
    }
  } catch {
    Toast.show({ type: 'error', text1: 'E-Bill failed', text2: 'You can retry from this screen' });
  } finally {
    setEbillLoading(false);
  }
};
```

### E-Bill with Credit Note

When a credit note is involved in the payment:

```typescript
// Use combined endpoint
await orderService.sendEbillAndCreditNote({
  orderId,
  customerPhone,
  creditNoteData: {
    creditNoteNumber,
    creditAmount,
  }
});
```

### WhatsApp Not Available

If WhatsApp is not installed on the cashier device:
- Show toast: "WhatsApp not installed"
- Offer to copy invoice link to clipboard as fallback
- Order status is unaffected

---

## 8. Customer Data Privacy

- Phone numbers are used for invoice delivery only
- No customer data is stored in AsyncStorage (session-only in component state)
- Customer data transmitted over HTTPS
- No analytics or tracking tied to customer phone numbers
- Backend handles data retention — out of scope for the app

---

## 9. Edge Cases

### Customer provides number at end of transaction

If the cashier enters the phone number after scanning all items but before checkout, the phone is included in the order. E-bill is available.

If phone is entered after order placement — not supported in current flow. The cashier would need to manually share the invoice.

### Customer declines to provide phone

Fully supported. Name and phone are optional. Order placed as anonymous sale. No e-bill available.

### Two customers with same phone

If `searchCustomers` returns multiple results for a phone (e.g., family members sharing a number), use the first result for auto-fill. This is a backend data quality issue, not a client problem.

### International customers

Not supported. Phone validation enforces 10-digit Indian format. If the store serves international customers, the validation logic would need to be relaxed or a country selector added.

### Customer wants invoice via email

Not supported in current flow. WhatsApp-only e-bill delivery. Email would require a separate backend endpoint and email input field.
