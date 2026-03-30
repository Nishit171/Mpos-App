import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Pressable,
  TouchableOpacity,
  Alert,
  Modal,
  Linking,
  Dimensions,
  Image,
} from 'react-native';
import { WebView } from 'react-native-webview';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCart } from '../../../context/cart-context';
import { useAuth } from '../../../context/auth-context';
import { saveCustomer } from '../../../services/api/customerService';
import {
  validateCreditNote,
  getUpiId,
  placeOrder,
  sendLumeEbill,
  orderPayment,
  refreshCart,
} from '../../../services/api/orderService';

export interface PaymentMethodData {
  method: string
  amount: number
  cardNumber?: string
  upiId?: string
  creditNoteNumber?: string
}

type BillType = 'taxInvoice' | 'invoice';

interface QuickBillingCheckoutProps {
  cartItems: any[];
  refreshedCart?: any;
  clearCurrentOrderCart: () => void;
  customerName: string;
  customerPhone: string;
  billType: BillType;
  onPaymentComplete?: () => void;
  onCartRefreshed?: (refreshedCart: any) => void;
  selectedPaymentMethods?: PaymentMethodData[];
  onPaymentMethodsChange?: (methods: PaymentMethodData[]) => void;
  orderId?: string | null;
  onOrderIdChange?: (id: string | null) => void;
  paymentResponse?: any;
  onPaymentResponseChange?: (response: any) => void;
  upiRefreshTrigger?: number;
}

const paymentMethods = [
  { key: 'cash', label: 'Cash', icon: '💵' },
  { key: 'card', label: 'Card', icon: '💳' },
  { key: 'upi', label: 'UPI', icon: '📱' },
  { key: 'creditNote', label: 'Credit Note', icon: '🏢' },
];

const saveCustomerInfo = async (
  customerName: string,
  customerPhone: string,
) => {
  try {
    if (!customerName?.trim() && !customerPhone?.trim()) {
      return { success: true, message: 'No customer info provided' };
    }
    const customerData = {
      firstName: customerName?.trim() || '',
      lastName: '',
      mobileNum: customerPhone?.trim() || '',
      emailId: '',
    };
    const result = await saveCustomer(customerData);
    return result.success
      ? {
          success: true,
          message: 'Customer info saved successfully',
          data: result.data,
        }
      : {
          success: false,
          message: `API Error: ${
            result.error || 'Failed to save customer'
          }`,
          data: result.data,
        };
  } catch (error) {
    return {
      success: false,
      message: `Network error: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`,
    };
  }
};

export default function QuickBillingCheckout({
  cartItems,
  refreshedCart,
  clearCurrentOrderCart,
  customerName,
  customerPhone,
  billType,
  onPaymentComplete,
  onCartRefreshed,
  selectedPaymentMethods: externalSelectedPaymentMethods,
  onPaymentMethodsChange,
  orderId: externalOrderId,
  onOrderIdChange,
  paymentResponse: externalPaymentResponse,
  onPaymentResponseChange,
  upiRefreshTrigger,
}: QuickBillingCheckoutProps) {
  const [internalSelectedPaymentMethods, setInternalSelectedPaymentMethods] =
    useState<PaymentMethodData[]>([]);
  const selectedPaymentMethods =
    externalSelectedPaymentMethods ?? internalSelectedPaymentMethods;
  const setSelectedPaymentMethods =
    onPaymentMethodsChange ?? setInternalSelectedPaymentMethods;

  const [internalOrderId, setInternalOrderId] = useState<string | null>(
    null,
  );
  const orderId = externalOrderId ?? internalOrderId;
  const setOrderId = onOrderIdChange ?? setInternalOrderId;

  const [internalPaymentResponse, setInternalPaymentResponse] =
    useState<any>(null);
  const paymentResponse =
    externalPaymentResponse ?? internalPaymentResponse;
  const setPaymentResponse =
    onPaymentResponseChange ?? setInternalPaymentResponse;

  const [tempAmount, setTempAmount] = useState('');
  const [tempCreditNoteNumber, setTempCreditNoteNumber] =
    useState('');
  const [systemUpiId, setSystemUpiId] = useState('');
  const [isFetchingUpi, setIsFetchingUpi] = useState(false);
  const [upiFetchFailed, setUpiFetchFailed] = useState(false);
  const [tempSelectedMethod, setTempSelectedMethod] =
    useState<string>('');
  const [isProcessingPayment, setIsProcessingPayment] =
    useState(false);
  const [editingPaymentIndex, setEditingPaymentIndex] = useState<
    number | null
  >(null);
  const [isEditingMode, setIsEditingMode] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [orgName, setOrgName] = useState<string | null>(null);
  const [storeName, setStoreName] = useState<string | null>(null);
  const [isSendingEbill, setIsSendingEbill] = useState(false);
  const [isCartManuallyCleared, setIsCartManuallyCleared] =
    useState(false);

  const { user: authUser } = useAuth();

  const [discountPercent, setDiscountPercent] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [discountType, setDiscountType] = useState<
    'percent' | 'amount'
  >('percent');
  const [showDiscount, setShowDiscount] = useState(false);
  const [appliedDiscount, setAppliedDiscount] = useState<
    { type: 'percent' | 'amount'; value: number } | null
  >(null);
  const [isApplyingDiscount, setIsApplyingDiscount] =
    useState(false);

  const { clearCart } = useCart();

  const isCartEmpty =
    isCartManuallyCleared || (cartItems ?? []).length === 0;

  const getEffectivePrice = (item: any) => Number(item?.netPrice) || 0;
  // `cartItems` can come from `refreshedCart?.cartItem` (server-calculated line totals).
  // In that case, `netPrice` is already the per-line total, so we must NOT multiply by `quantity` again.
  const isUsingRefreshedCart = !!refreshedCart?.cartItem;
  const lineItemsTotal = isCartEmpty
    ? 0
    : (cartItems ?? []).reduce(
        (sum, item) => {
          const net = getEffectivePrice(item);
          const qty = Number(item?.quantity) || 0;
          return sum + (isUsingRefreshedCart ? net : net * qty);
        },
        0,
      );
  const discounts = isCartEmpty ? [] : refreshedCart?.discounts ?? [];

  const computedDiscountAmount = Array.isArray(discounts)
    ? discounts.reduce(
        (sum, d) =>
          sum +
          (typeof d === 'object' && d.discAmount
            ? d.discAmount
            : 0),
        0,
      )
    : typeof discounts === 'object' && discounts.discAmount
    ? discounts.discAmount
    : 0;
  // When refreshed cart is active, line item totals can already be post-discount.
  // Reconstruct gross so discount is applied exactly once in netTotal.
  const grossTotal =
    isUsingRefreshedCart && computedDiscountAmount > 0
      ? lineItemsTotal + computedDiscountAmount
      : lineItemsTotal;
  const netTotal = isCartEmpty
    ? 0
    : Math.max(0, grossTotal - computedDiscountAmount);

  const totalAmountPaid = isCartEmpty
    ? 0
    : selectedPaymentMethods.reduce(
        (sum, method) => sum + method.amount,
        0,
      );
  const remainingAmount = netTotal - totalAmountPaid;
  const isPaymentComplete = isCartEmpty
    ? false
    : Math.abs(remainingAmount) < 0.01;
  const effectiveOrderId =
    orderId ||
    paymentResponse?.data?.orderId ||
    paymentResponse?.data?.order_id ||
    null;

  const invoicePdfUrl = paymentResponse?.data?.invoicePdfUrl;
  const invoicePdfUri =
    typeof invoicePdfUrl === 'string' ? invoicePdfUrl.trim() : '';
  const hasInvoicePreview = invoicePdfUri.length > 0;
  const invoicePreviewWebUri = invoicePdfUri
    ? `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(
        invoicePdfUri,
      )}`
    : '';
  const invoicePreviewHtml = invoicePreviewWebUri
    ? `<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      html, body { margin: 0; padding: 0; height: 100%; background: #fff; }
      iframe { border: 0; width: 100%; height: 100%; }
    </style>
  </head>
  <body>
    <iframe src="${invoicePreviewWebUri}" allowfullscreen></iframe>
  </body>
</html>`
    : '';
  const [invoicePreviewMode, setInvoicePreviewMode] = useState<
    'google' | 'direct'
  >('google');

  useEffect(() => {
    if (paymentResponse && paymentResponse.success) {
      setIsModalOpen(true);
      setInvoicePreviewMode('google');
    }
  }, [paymentResponse]);

  useEffect(() => {
    // Keep amount in sync with payable amount when a method is selected.
    // This prevents stale values (e.g. old pre-discount amount) from lingering.
    if (!tempSelectedMethod || isEditingMode) return;
    setTempAmount(
      remainingAmount > 0 ? remainingAmount.toFixed(2) : '',
    );
  }, [remainingAmount, tempSelectedMethod, isEditingMode]);

  useEffect(() => {
    if (!isCartEmpty) return;

    // Reset payment-entry UI when cart is cleared (e.g. "Clear All").
    setTempAmount('');
    setTempCreditNoteNumber('');
    setTempSelectedMethod('');
    setIsEditingMode(false);
    setEditingPaymentIndex(null);

    if (selectedPaymentMethods.length > 0) {
      setSelectedPaymentMethods([]);
    }
  }, [
    isCartEmpty,
    selectedPaymentMethods.length,
    setSelectedPaymentMethods,
  ]);

  useEffect(() => {
    const loadStoreInfo = async () => {
      try {
        const storedOrgName = await AsyncStorage.getItem('orgName');
        const storedStoreName = await AsyncStorage.getItem('storeName');

        if (storedOrgName) setOrgName(storedOrgName);
        if (storedStoreName) setStoreName(storedStoreName);
      } catch (error) {
        // Keep silent: e-bill button is gated on store/org names.
        console.warn('Failed to load store info', error);
      }
    };

    // Prefer authenticated user fields (should be set on login).
    if (authUser?.orgName) setOrgName(String(authUser.orgName));
    if (authUser?.storeName) setStoreName(String(authUser.storeName));

    // Fallback to AsyncStorage if user fields are not present yet.
    if (!authUser?.orgName || !authUser?.storeName) {
      loadStoreInfo();
    }
  }, [authUser]);

  useEffect(() => {
    const fetchUpiIdOnce = async () => {
      try {
        setIsFetchingUpi(true);
        setUpiFetchFailed(false);
        const result = await getUpiId();
        const data = result.data;
        if (data && data.status === 'SUCCESS' && data.data) {
          setSystemUpiId(data.data);
        } else if (data && data.upiId) {
          setSystemUpiId(data.upiId);
        } else if (
          data &&
          data.data &&
          typeof data.data === 'string'
        ) {
          setSystemUpiId(data.data);
        } else if (
          data &&
          data.data &&
          data.data.upiId
        ) {
          setSystemUpiId(data.data.upiId);
        } else {
          setSystemUpiId('');
          setUpiFetchFailed(true);
        }
      } catch (error) {
        setSystemUpiId('');
        setUpiFetchFailed(true);
      } finally {
        setIsFetchingUpi(false);
      }
    };
    fetchUpiIdOnce();
  }, [upiRefreshTrigger]);

  const handleAddPaymentMethod = async () => {
    if (!tempSelectedMethod || !tempAmount || Number(tempAmount) <= 0) {
      Alert.alert(
        'Payment method required',
        'Please select a payment method and enter a valid amount',
      );
      return;
    }
    const amount = Number(tempAmount);
    if (isNaN(amount)) {
      Alert.alert(
        'Invalid amount',
        'Please enter a valid number for the amount.',
      );
      return;
    }
    if (isEditingMode && editingPaymentIndex !== null) {
      handleUpdatePaymentMethod();
      return;
    }
    const existingMethod = selectedPaymentMethods.find(
      m => m.method === tempSelectedMethod,
    );
    if (existingMethod) {
      Alert.alert(
        'Duplicate method',
        'This payment method is already added. Please remove it first or use a different method.',
      );
      return;
    }
    if (tempSelectedMethod === 'creditNote') {
      const validationRes = await validateCreditNote({
        creditNoteNum: tempCreditNoteNumber,
        paidAmount: Number.parseInt(tempAmount, 10),
      });
      if (
        !validationRes ||
        !validationRes.success ||
        validationRes.data?.status !== 'success'
      ) {
        Alert.alert(
          'Invalid credit note',
          validationRes?.data?.status_message ||
            validationRes?.data?.message ||
            'Invalid credit note or validation failed.',
        );
        return;
      }
    }
    const newPaymentMethod: PaymentMethodData = {
      method: tempSelectedMethod,
      amount,
      ...(tempSelectedMethod === 'card' && {
        cardNumber: '',
      }),
      ...(tempSelectedMethod === 'creditNote' && {
        creditNoteNumber: tempCreditNoteNumber,
      }),
    };
    setSelectedPaymentMethods([
      ...selectedPaymentMethods,
      newPaymentMethod,
    ]);
    setTempAmount('');
    setTempCreditNoteNumber('');
    setTempSelectedMethod('');
  };

  const handleRemovePaymentMethod = (index: number) => {
    setSelectedPaymentMethods(
      selectedPaymentMethods.filter((_, i) => i !== index),
    );
  };

  const handleEditPaymentMethod = (index: number) => {
    const method = selectedPaymentMethods[index];
    setEditingPaymentIndex(index);
    setIsEditingMode(true);
    setTempSelectedMethod(method.method);
    setTempAmount(method.amount.toString());
    setTempCreditNoteNumber(method.creditNoteNumber || '');
  };

  const handleUpdatePaymentMethod = () => {
    if (
      editingPaymentIndex === null ||
      !tempSelectedMethod ||
      !tempAmount ||
      Number(tempAmount) <= 0
    ) {
      Alert.alert(
        'Payment method required',
        'Please select a payment method and enter a valid amount',
      );
      return;
    }
    const amount = Number(tempAmount);
    if (isNaN(amount)) {
      Alert.alert(
        'Invalid amount',
        'Please enter a valid number for the amount.',
      );
      return;
    }
    const otherPaymentMethodsTotal = selectedPaymentMethods
      .filter((_, index) => index !== editingPaymentIndex)
      .reduce((sum, method) => sum + method.amount, 0);
    if (otherPaymentMethodsTotal + amount > netTotal) {
      Alert.alert(
        'Amount too high',
        `Total payment amount cannot exceed ₹${netTotal.toFixed(
          2,
        )}`,
      );
      return;
    }
    const updatedMethods = [...selectedPaymentMethods];
    updatedMethods[editingPaymentIndex] = {
      method: tempSelectedMethod,
      amount,
      ...(tempSelectedMethod === 'card' && {
        cardNumber: '',
      }),
      ...(tempSelectedMethod === 'creditNote' && {
        creditNoteNumber: tempCreditNoteNumber,
      }),
    };
    setSelectedPaymentMethods(updatedMethods);
    handleCancelEdit();
  };

  const handleCancelEdit = () => {
    setIsEditingMode(false);
    setEditingPaymentIndex(null);
    setTempSelectedMethod('');
    setTempAmount('');
    setTempCreditNoteNumber('');
  };

  const handleApplyDiscount = async () => {
    if (isApplyingDiscount) return;
    if (selectedPaymentMethods.length > 0) return;

    setIsApplyingDiscount(true);
    try {
      let input;
      if (discountType === 'percent' && discountPercent > 0) {
        const modCart = cartItems.map((item: any) => ({
          ...item,
          qtyMux: item.qtyMux || '',
          overrideDiscountType: '%',
          overrideDiscountValue: discountPercent.toString(),
        }));
        input = { cartItem: modCart };
        setAppliedDiscount({
          type: 'percent',
          value: discountPercent,
        });
      } else if (discountType === 'amount' && discountAmount > 0) {
        const modCart = cartItems.map((item: any) => ({
          ...item,
          qtyMux: item.qtyMux || '',
        }));
        input = {
          cartItem: modCart,
          discount: {
            cartDiscountType: '$',
            cartDiscountValue: discountAmount.toString(),
          },
        };
        setAppliedDiscount({
          type: 'amount',
          value: discountAmount,
        });
      } else {
        Alert.alert(
          'Invalid discount',
          'Please enter a valid discount value',
        );
        setIsApplyingDiscount(false);
        return;
      }

      const result = await refreshCart(input);
      if (result.success && result.data) {
        if (onCartRefreshed) {
          onCartRefreshed(result.data);
        }
        Alert.alert('Success', 'Discount applied successfully');
      } else {
        Alert.alert('Error', 'Failed to apply discount');
        setAppliedDiscount(null);
      }
    } catch (error) {
      console.error('Failed to apply discount:', error);
      Alert.alert('Error', 'Failed to apply discount');
      setAppliedDiscount(null);
    } finally {
      setIsApplyingDiscount(false);
    }
  };

  const handleRemoveDiscount = async () => {
    if (isApplyingDiscount) return;
    if (selectedPaymentMethods.length > 0) return;

    setIsApplyingDiscount(true);
    try {
      const modCart = cartItems.map((item: any) => {
        const {
          overrideDiscountType,
          overrideDiscountValue,
          ...itemWithoutDiscount
        } = item;
        return {
          ...itemWithoutDiscount,
          qtyMux: item.qtyMux || '',
        };
      });

      const input = { cartItem: modCart };

      const result = await refreshCart(input);
      if (result.success && result.data) {
        if (onCartRefreshed) {
          onCartRefreshed(result.data);
        }
        setAppliedDiscount(null);
        setDiscountPercent(0);
        setDiscountAmount(0);
        Alert.alert('Success', 'Discount removed successfully');
      } else {
        Alert.alert('Error', 'Failed to remove discount');
      }
    } catch (error) {
      console.error('Failed to remove discount:', error);
      Alert.alert('Error', 'Failed to remove discount');
    } finally {
      setIsApplyingDiscount(false);
    }
  };

  useEffect(() => {
    if (cartItems.length === 0) {
      setAppliedDiscount(null);
      setDiscountPercent(0);
      setDiscountAmount(0);
    }
  }, [cartItems.length]);

  useEffect(() => {
    if (
      isCartManuallyCleared &&
      (cartItems ?? []).length > 0 &&
      !refreshedCart
    ) {
      setIsCartManuallyCleared(false);
    }
  }, [cartItems, isCartManuallyCleared, refreshedCart]);

  const handlePayNow = async () => {
    if (!isPaymentComplete) {
      Alert.alert(
        'Payment incomplete',
        'Please ensure the total payment amount matches the required amount',
      );
      return;
    }
    if (isProcessingPayment) {
      return;
    }
    setIsProcessingPayment(true);
    try {
      let placedOrderId = orderId;
      const placeOrderPayload = refreshedCart
        ? refreshedCart
        : { cartItem: cartItems };
      if (!placedOrderId) {
        try {
          const placeOrderRes = await placeOrder(
            placeOrderPayload,
          );
          if (
            placeOrderRes.success &&
            placeOrderRes.data &&
            placeOrderRes.data.order_id
          ) {
            placedOrderId = placeOrderRes.data.order_id;
            setOrderId(placedOrderId);
          } else {
            Alert.alert(
              'Error',
              'Failed to place order. Please try again.',
            );
            return;
          }
        } catch (error) {
          console.error('Place order error:', error);
          Alert.alert(
            'Error',
            'Failed to place order. Please try again.',
          );
          return;
        }
      }
      const consumerResponse = selectedPaymentMethods.map(
        method => {
          const baseResponse = { amountPaid: method.amount };
          switch (method.method) {
            case 'cash':
              return {
                ...baseResponse,
                paymentChannel: 'CASH',
                orgPaymentMediaId: '1',
                paymentMode: 'CASH',
              };
            case 'card':
              return {
                ...baseResponse,
                paymentChannel: 'CARD',
                orgPaymentMediaId: '4',
                paymentMode: 'CARD',
                cardNumber: '',
              };
            case 'creditNote':
              return {
                ...baseResponse,
                paymentChannel: 'CREDIT_NOTE',
                orgPaymentMediaId: '5',
                paymentMode: 'CREDIT_NOTE',
                creditNoteNo: method.creditNoteNumber,
              };
            case 'upi':
              return {
                ...baseResponse,
                paymentChannel: 'UPI',
                orgPaymentMediaId: '6',
                paymentMode: 'UPI',
                upiId: systemUpiId,
              };
            default:
              return baseResponse;
          }
        },
      );
      const input = {
        userType: 'CONSUMER',
        consumerResponse,
        order_id: placedOrderId ? String(placedOrderId) : '',
        billAmount: netTotal,
        customerName: customerName?.trim() || '',
        customerNumber: customerPhone?.trim() || '',
        isTaxInvoice: billType === 'taxInvoice',
      };
      const response = await orderPayment(input);
      setPaymentResponse(response);
      if (response.success) {
        const customerSaveResult = await saveCustomerInfo(
          customerName,
          customerPhone,
        );
        if (customerSaveResult.success) {
          if (customerName?.trim() || customerPhone?.trim()) {
            Alert.alert(
              'Payment successful',
              'Payment successful! Customer info saved.',
            );
          } else {
            Alert.alert('Payment successful', 'Payment successful!');
          }
        } else {
          Alert.alert('Payment successful', 'Payment successful!');
        }
      } else {
        Alert.alert('Payment failed', 'Please try again.');
      }
    } catch (error) {
      console.error('Payment error:', error);
      Alert.alert('Payment failed', 'Please try again.');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const closeModal = () => {
    console.log('Invoice modal closing');
    setIsModalOpen(false);
    setIsCartManuallyCleared(true);
    clearCart();
    clearCurrentOrderCart();
    if (typeof onCartRefreshed === 'function') {
      onCartRefreshed(null);
    }
    setSelectedPaymentMethods([]);
    setTempAmount('');
    setTempCreditNoteNumber('');
    setTempSelectedMethod('');
    setIsEditingMode(false);
    setEditingPaymentIndex(null);
    setPaymentResponse(null);
    setOrderId(null);
    setAppliedDiscount(null);
    setDiscountPercent(0);
    setDiscountAmount(0);
  };

  const downloadReceipt = async (pdfUrl: string | undefined) => {
    if (!pdfUrl) {
      Alert.alert('Error', 'PDF URL not available');
      return;
    }
    try {
      await Linking.openURL(pdfUrl);
    } catch (error) {
      console.error('Open PDF error:', error);
      Alert.alert('Error', 'Failed to open invoice URL');
    }
  };

  const printReceipt = async () => {
    if (!invoicePdfUri) {
      Alert.alert(
        'Invoice unavailable',
        'Invoice not available for printing',
      );
      return;
    }
    try {
      await Linking.openURL(invoicePdfUri);
    } catch (error) {
      console.error('Print error:', error);
      Alert.alert('Error', 'Failed to open invoice URL');
    }
  };

  const handleSendEbill = async () => {
    if (isSendingEbill) return;
    setIsSendingEbill(true);
    try {
      if (!effectiveOrderId) {
        Alert.alert(
          'Missing order ID',
          'Order ID is not available for sending e-bill. Please complete the payment first.',
        );
        return;
      }
      const response = await sendLumeEbill(String(effectiveOrderId));
      if (response.success) {
        Alert.alert('Success', 'E-bill sent successfully!');
      } else {
        Alert.alert(
          'Error',
          `Failed to send E-bill: ${
            response.error || 'Unknown error'
          }`,
        );
      }
    } catch (error) {
      console.error('Send E-bill error:', error);
      Alert.alert(
        'Error',
        'Failed to send E-bill. Please try again.',
      );
    } finally {
      setIsSendingEbill(false);
    }
  };

  const shouldShowEbill = !(isSendingEbill || !effectiveOrderId);

  const discountLocked = selectedPaymentMethods.length > 0;

  const parsedTempAmount = Number(tempAmount);
  const shouldIncludeUpiAmount =
    Number.isFinite(parsedTempAmount) && parsedTempAmount > 0;
  const upiPayUri = systemUpiId
    ? `upi://pay?pa=${encodeURIComponent(
        systemUpiId,
      )}&pn=${encodeURIComponent(
        storeName || orgName || 'Store',
      )}${shouldIncludeUpiAmount ? `&am=${parsedTempAmount.toFixed(2)}` : ''}&cu=INR`
    : '';
  const upiQrImageUrl = upiPayUri
    ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
        upiPayUri,
      )}`
    : '';

  // Diagnostics: why E-bill button isn't rendering
  console.log('EBILL DEBUG', {
    isSendingEbill,
    effectiveOrderId,
  });
  console.log('EBILL SHOULD SHOW:', shouldShowEbill);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.headerIcon}>💳</Text>
        <Text style={styles.headerTitle}>Checkout</Text>
      </View>

      <View style={styles.content}>
        {/* Discount section */}
        {cartItems.length > 0 && (
          <View style={styles.discountSection}>
            <Pressable
              style={[
                styles.discountToggle,
                discountLocked && styles.discountToggleDisabled,
              ]}
              onPress={() => {
                if (discountLocked && !showDiscount) return;
                setShowDiscount(prev => !prev);
              }}
            >
              <Text style={styles.discountIcon}>%</Text>
              <Text style={styles.discountToggleText}>Add Discount</Text>
              <Text style={styles.discountChevron}>
                {showDiscount ? '▲' : '▼'}
              </Text>
            </Pressable>

            {showDiscount && (
              <View
                style={[
                  styles.discountContent,
                  discountLocked && styles.discountContentLocked,
                ]}
                pointerEvents={discountLocked ? 'none' : 'auto'}
              >
                <View style={styles.discountInputsRow}>
                  <Pressable
                    style={[
                      styles.discountTypeButton,
                      discountType === 'percent' &&
                        styles.discountTypeButtonActive,
                      discountLocked && styles.discountControlDisabled,
                    ]}
                    disabled={discountLocked}
                    onPress={() => {
                      if (discountLocked) return;
                      setDiscountType('percent');
                      setDiscountAmount(0);
                    }}
                  >
                    <Text
                      style={[
                        styles.discountTypeButtonText,
                        discountType === 'percent' &&
                          styles.discountTypeButtonTextActive,
                      ]}
                    >
                      %
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.discountTypeButton,
                      discountType === 'amount' &&
                        styles.discountTypeButtonActive,
                      discountLocked && styles.discountControlDisabled,
                    ]}
                    disabled={discountLocked}
                    onPress={() => {
                      if (discountLocked) return;
                      setDiscountType('amount');
                      setDiscountPercent(0);
                    }}
                  >
                    <Text
                      style={[
                        styles.discountTypeButtonText,
                        discountType === 'amount' &&
                          styles.discountTypeButtonTextActive,
                      ]}
                    >
                      ₹
                    </Text>
                  </Pressable>
                </View>

                {discountType === 'percent' ? (
                  <View style={styles.discountInputRow}>
                    <TextInput
                      keyboardType="numeric"
                      value={
                        discountPercent === 0
                          ? ''
                          : discountPercent.toString()
                      }
                      onChangeText={value => {
                        let val = Number(value);
                        if (val < 0) val = 0;
                        if (val > 100) val = 100;
                        setDiscountPercent(val);
                        setDiscountAmount(0);
                      }}
                      placeholder="Enter percentage"
                      style={styles.discountInput}
                      placeholderTextColor="#9ca3af"
                      editable={!discountLocked}
                    />
                    <Pressable
                      style={[
                        styles.discountApplyButton,
                        (!discountPercent ||
                          discountPercent <= 0 ||
                          isApplyingDiscount ||
                          discountLocked) &&
                          styles.discountApplyButtonDisabled,
                      ]}
                      disabled={
                        !discountPercent ||
                        discountPercent <= 0 ||
                        isApplyingDiscount ||
                        discountLocked
                      }
                      onPress={handleApplyDiscount}
                    >
                      <Text style={styles.discountApplyText}>
                        {isApplyingDiscount ? 'Applying...' : 'Apply'}
                      </Text>
                    </Pressable>
                  </View>
                ) : (
                  <View style={styles.discountInputRow}>
                    <TextInput
                      keyboardType="numeric"
                      value={
                        discountAmount === 0 ? '' : discountAmount.toString()
                      }
                      onChangeText={value => {
                        let val = Number(value);
                        if (val < 0) val = 0;
                        if (val > grossTotal) val = grossTotal;
                        setDiscountAmount(val);
                        setDiscountPercent(0);
                      }}
                      placeholder="Enter amount"
                      style={styles.discountInput}
                      placeholderTextColor="#9ca3af"
                      editable={!discountLocked}
                    />
                    <Pressable
                      style={[
                        styles.discountApplyButton,
                        (!discountAmount ||
                          discountAmount <= 0 ||
                          isApplyingDiscount ||
                          discountLocked) &&
                          styles.discountApplyButtonDisabled,
                      ]}
                      disabled={
                        !discountAmount ||
                        discountAmount <= 0 ||
                        isApplyingDiscount ||
                        discountLocked
                      }
                      onPress={handleApplyDiscount}
                    >
                      <Text style={styles.discountApplyText}>
                        {isApplyingDiscount ? 'Applying...' : 'Apply'}
                      </Text>
                    </Pressable>
                  </View>
                )}

                {appliedDiscount && (
                  <View style={styles.appliedDiscountRow}>
                    <Text style={styles.appliedDiscountText}>
                      Discount Applied:{' '}
                      {appliedDiscount.type === 'percent'
                        ? `${appliedDiscount.value}%`
                        : `₹${appliedDiscount.value.toFixed(2)}`}
                    </Text>
                    <Pressable
                      onPress={handleRemoveDiscount}
                      disabled={isApplyingDiscount || discountLocked}
                      style={styles.removeDiscountButton}
                    >
                      <Text style={styles.removeDiscountText}>✕</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {/* Payment methods */}
        <View>
          <View style={styles.paymentMethodsGrid}>
            {paymentMethods.map(method => (
              <Pressable
                key={method.key}
                style={[
                  styles.paymentMethodButton,
                  tempSelectedMethod === method.key &&
                    styles.paymentMethodButtonActive,
                ]}
                onPress={() => {
                  setTempSelectedMethod(method.key);
                  if (remainingAmount > 0) {
                    setTempAmount(remainingAmount.toFixed(2));
                  }
                }}
              >
                <Text style={styles.paymentMethodIcon}>
                  {method.icon}
                </Text>
                <Text
                  style={[
                    styles.paymentMethodLabel,
                    tempSelectedMethod === method.key &&
                      styles.paymentMethodLabelActive,
                  ]}
                >
                  {method.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {tempSelectedMethod ? (
            <View style={styles.paymentDetails}>
              {tempSelectedMethod === 'upi' && (
                <View style={styles.fieldGroup}>
                  {systemUpiId ? (
                    <View style={styles.upiBox}>
                      <Text style={styles.upiQrHelpText}>
                        Scan to pay via UPI
                      </Text>
                      {upiQrImageUrl ? (
                        <Image
                          source={{ uri: upiQrImageUrl }}
                          style={styles.upiQrImage}
                          resizeMode="contain"
                        />
                      ) : null}
                      <View style={styles.upiIdBadge}>
                        <Text style={styles.upiValue}>
                          Store UPI: {systemUpiId}
                        </Text>
                      </View>
                      <Text style={styles.upiHint}>
                        Ask customer to pay using this UPI ID
                      </Text>
                    </View>
                  ) : isFetchingUpi ? (
                    <Text style={styles.fieldInfoText}>
                      Fetching UPI ID...
                    </Text>
                  ) : upiFetchFailed ? (
                    <Text style={styles.fieldErrorText}>
                      UPI unavailable. Please try another method.
                    </Text>
                  ) : null}
                </View>
              )}

              {tempSelectedMethod === 'creditNote' && (
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>
                    Credit Note Number
                  </Text>
                  <TextInput
                    value={tempCreditNoteNumber}
                    onChangeText={setTempCreditNoteNumber}
                    placeholder="Enter credit note number"
                    style={styles.fieldInput}
                    placeholderTextColor="#9ca3af"
                  />
                </View>
              )}

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Amount</Text>
                <TextInput
                  keyboardType="numeric"
                  value={tempAmount}
                  onChangeText={value => {
                    const clean = value
                      .replace(/[^0-9.]/g, '')
                      .replace(/(\..*)\./g, '$1');
                    setTempAmount(clean);
                  }}
                  placeholder={`Max: ₹${
                    remainingAmount > 0
                      ? remainingAmount.toFixed(2)
                      : '0.00'
                  }`}
                  style={styles.fieldInput}
                  placeholderTextColor="#9ca3af"
                />
                {tempAmount &&
                  Number(tempAmount) > remainingAmount && (
                    <Text style={styles.fieldErrorText}>
                      Amount exceeds pay amount
                    </Text>
                  )}
              </View>

              <Pressable
                style={[
                  styles.addPaymentButton,
                  (remainingAmount <= 0 ||
                    !tempAmount ||
                    Number(tempAmount) <= 0 ||
                    isNaN(Number(tempAmount)) ||
                    Number(tempAmount) > remainingAmount ||
                    (tempSelectedMethod === 'upi' &&
                      (isFetchingUpi ||
                        upiFetchFailed ||
                        !systemUpiId))) &&
                    styles.addPaymentButtonDisabled,
                ]}
                disabled={
                  remainingAmount <= 0 ||
                  !tempAmount ||
                  Number(tempAmount) <= 0 ||
                  isNaN(Number(tempAmount)) ||
                  Number(tempAmount) > remainingAmount ||
                  (tempSelectedMethod === 'upi' &&
                    (isFetchingUpi ||
                      upiFetchFailed ||
                      !systemUpiId))
                }
                onPress={handleAddPaymentMethod}
              >
                <Text style={styles.addPaymentButtonText}>
                  {isEditingMode
                    ? 'Update Payment Method'
                    : 'Add Payment Method'}
                </Text>
              </Pressable>

              {isEditingMode && (
                <Pressable
                  style={styles.cancelEditButton}
                  onPress={handleCancelEdit}
                >
                  <Text style={styles.cancelEditText}>
                    Cancel Edit
                  </Text>
                </Pressable>
              )}
            </View>
          ) : null}

          {/* Selected payment methods */}
          {selectedPaymentMethods.length > 0 && (
            <View style={styles.selectedMethodsSection}>
              <Text style={styles.sectionLabel}>
                Payment Methods Added
              </Text>
              {selectedPaymentMethods.map((method, index) => (
                <Pressable
                  key={index}
                  style={[
                    styles.selectedMethodCard,
                    editingPaymentIndex === index &&
                      styles.selectedMethodCardEditing,
                  ]}
                  onPress={() => handleEditPaymentMethod(index)}
                >
                  <View style={styles.selectedMethodHeader}>
                    <View style={styles.selectedMethodLeft}>
                      <Text style={styles.selectedMethodIcon}>
                        {
                          paymentMethods.find(
                            m => m.key === method.method,
                          )?.icon
                        }
                      </Text>
                      <Text style={styles.selectedMethodLabel}>
                        {
                          paymentMethods.find(
                            m => m.key === method.method,
                          )?.label
                        }
                        {editingPaymentIndex === index && (
                          <Text style={styles.editingTag}>
                            {' '}
                            (Editing)
                          </Text>
                        )}
                      </Text>
                    </View>
                    <Pressable
                      onPress={e => {
                        e.stopPropagation();
                        handleRemovePaymentMethod(index);
                      }}
                      style={styles.removeMethodButton}
                    >
                      <Text style={styles.removeMethodText}>
                        ✕
                      </Text>
                    </Pressable>
                  </View>
                  {method.method === 'upi' && systemUpiId ? (
                    <Text style={styles.methodDetailText}>
                      UPI: {systemUpiId}
                    </Text>
                  ) : null}
                  {method.creditNoteNumber ? (
                    <Text style={styles.methodDetailText}>
                      Credit Note: {method.creditNoteNumber}
                    </Text>
                  ) : null}
                  <View style={styles.methodAmountRow}>
                    <Text style={styles.methodAmountLabel}>
                      Amount:
                    </Text>
                    <Text style={styles.methodAmountValue}>
                      ₹{method.amount.toFixed(2)}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* Payment summary */}
        {selectedPaymentMethods.length > 0 && (
          <View style={styles.summaryCard}>
            <Text style={styles.sectionLabel}>Payment Summary</Text>
            {selectedPaymentMethods.map((method, index) => (
              <View
                key={index}
                style={styles.summaryRow}
              >
                <Text style={styles.summaryLabel}>
                  {
                    paymentMethods.find(
                      m => m.key === method.method,
                    )?.label
                  }
                  :
                </Text>
                <Text style={styles.summaryValue}>
                  ₹{method.amount.toFixed(2)}
                </Text>
              </View>
            ))}
            <View style={styles.summaryDivider} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabelStrong}>
                Remaining:
              </Text>
              <Text
                style={[
                  styles.summaryRemaining,
                  remainingAmount > 0
                    ? styles.summaryRemainingDue
                    : styles.summaryRemainingOk,
                ]}
              >
                ₹{remainingAmount.toFixed(2)}
              </Text>
            </View>
          </View>
        )}

        {/* Bill summary */}
        <View style={styles.billSummary}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabelStrong}>
              Total Amount
            </Text>
            <Text style={styles.summaryTotal}>
              ₹{grossTotal.toFixed(2)}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Tax (inclusive)</Text>
            <Text style={styles.summaryTotal}>₹0.00</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Discount</Text>
            <Text style={styles.summaryDiscount}>
              -₹{computedDiscountAmount.toFixed(2)}
            </Text>
          </View>
          <View style={[styles.summaryRow, styles.summaryRowBorderTop]}>
            <Text style={styles.summaryLabelStrong}>Bill Amount</Text>
            <Text style={styles.summaryTotalStrong}>
              ₹{netTotal.toFixed(2)}
            </Text>
          </View>
        </View>

        {/* Pay Now button */}
        <Pressable
          style={[
            styles.payNowButton,
            (isCartEmpty ||
              !isPaymentComplete ||
              isProcessingPayment) &&
              styles.payNowButtonDisabled,
          ]}
          disabled={
            isCartEmpty || !isPaymentComplete || isProcessingPayment
          }
          onPress={handlePayNow}
        >
          <Text style={styles.payNowText}>
            {isProcessingPayment
              ? 'Processing...'
              : isCartEmpty
              ? 'No items in cart'
              : !isPaymentComplete
              ? `Pay ₹${remainingAmount.toFixed(2)} more`
              : 'Pay Now'}
          </Text>
        </Pressable>
      </View>

      {/* Payment success modal */}
      <Modal
        visible={isModalOpen}
        transparent
        animationType="fade"
        onRequestClose={closeModal}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.invoiceModal}>
            <ScrollView
              style={styles.invoiceScroll}
              contentContainerStyle={styles.invoiceScrollContent}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.invoiceTitle}>Invoice</Text>
              <Text style={styles.invoiceLabel}>
                Total Amount
              </Text>
              <Text style={styles.invoiceAmount}>
                ₹{paymentResponse?.data?.totalAmount ??
                  netTotal.toFixed(2)}
              </Text>

              <View style={styles.invoiceInfoBlock}>
                <Text style={styles.invoiceLabel}>
                  Date & Time
                </Text>
                <Text style={styles.invoiceInfoText}>
                  {paymentResponse?.data?.orderDate ?? ''}
                </Text>
              </View>

              {hasInvoicePreview ? (
                <View style={styles.invoiceWebViewContainer}>
                  <WebView
                    key={`${invoicePreviewMode}-${invoicePdfUri}`}
                    originWhitelist={['*']}
                    source={
                      invoicePreviewMode === 'google'
                        ? { html: invoicePreviewHtml }
                        : { uri: invoicePdfUri }
                    }
                    style={styles.invoiceWebView}
                    javaScriptEnabled
                    domStorageEnabled
                    startInLoadingState
                    scalesPageToFit
                    scrollEnabled
                    nestedScrollEnabled
                    mixedContentMode="always"
                    onError={() => {
                      if (invoicePreviewMode === 'google') {
                        setInvoicePreviewMode('direct');
                      }
                    }}
                    onHttpError={() => {
                      if (invoicePreviewMode === 'google') {
                        setInvoicePreviewMode('direct');
                      }
                    }}
                  />
                </View>
              ) : (
                <View style={styles.invoiceInfoBlock}>
                  <Text style={styles.invoiceInfoText}>
                    Invoice preview is not available inside the app. Use the
                    buttons below to open or share the invoice PDF.
                  </Text>
                </View>
              )}

              <View style={styles.invoiceButtonsRow}>
                <Pressable
                  onPress={() => downloadReceipt(invoicePdfUri || undefined)}
                  style={styles.invoiceButton}
                >
                  <Text style={styles.invoiceButtonText}>
                    Download
                  </Text>
                </Pressable>
                <Pressable
                  onPress={printReceipt}
                  style={styles.invoiceButton}
                >
                  <Text style={styles.invoiceButtonText}>
                    Print
                  </Text>
                </Pressable>
                {!(
                  isSendingEbill ||
                  !effectiveOrderId
                ) && (
                  <Pressable
                    onPress={handleSendEbill}
                    style={[
                      styles.invoiceButton,
                      styles.invoiceButtonSecondary,
                    ]}
                  >
                    <Text style={styles.invoiceButtonSecondaryText}>
                      E-bill
                    </Text>
                  </Pressable>
                )}
              </View>
            </ScrollView>
            <TouchableOpacity
              onPress={closeModal}
              style={styles.invoiceCloseButton}
              activeOpacity={0.7}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel="Close invoice"
            >
              <Text style={styles.invoiceCloseText}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  headerIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  content: {
    padding: 10,
  },
  discountSection: {
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingBottom: 8,
    marginBottom: 8,
  },
  discountToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginBottom: 6,
  },
  discountIcon: {
    fontSize: 12,
    color: '#0064c2',
    marginRight: 4,
  },
  discountToggleText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#111827',
  },
  discountChevron: {
    marginLeft: 'auto',
    fontSize: 11,
    color: '#0064c2',
    fontWeight: '600',
  },
  discountContent: {
    marginTop: 6,
  },
  discountToggleDisabled: {
    opacity: 0.55,
  },
  discountContentLocked: {
    opacity: 0.65,
  },
  discountControlDisabled: {
    opacity: 0.5,
  },
  discountInputsRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  discountTypeButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    marginRight: 4,
  },
  discountTypeButtonActive: {
    backgroundColor: '#e6f0fa',
    borderColor: '#0064c2',
  },
  discountTypeButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
  },
  discountTypeButtonTextActive: {
    color: '#0064c2',
  },
  discountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  discountInput: {
    flex: 1,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 12,
    color: '#111827',
    marginRight: 6,
  },
  discountApplyButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#0064c2',
  },
  discountApplyButtonDisabled: {
    opacity: 0.5,
  },
  discountApplyText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ffffff',
  },
  appliedDiscountRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#ecfdf3',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  appliedDiscountText: {
    fontSize: 11,
    color: '#166534',
    fontWeight: '500',
  },
  removeDiscountButton: {
    padding: 4,
    borderRadius: 999,
  },
  removeDiscountText: {
    fontSize: 12,
    color: '#dc2626',
  },
  paymentMethodsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  paymentMethodButton: {
    width: '48%',
    marginBottom: 10,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  paymentMethodButtonActive: {
    borderColor: '#0064c2',
    backgroundColor: '#eff6ff',
  },
  paymentMethodIcon: {
    marginRight: 4,
    fontSize: 12,
  },
  paymentMethodLabel: {
    fontSize: 11,
    color: '#111827',
  },
  paymentMethodLabelActive: {
    color: '#0064c2',
    fontWeight: '600',
  },
  paymentDetails: {
    marginTop: 6,
  },
  fieldGroup: {
    marginBottom: 6,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 2,
  },
  fieldInput: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 12,
    color: '#111827',
  },
  fieldInputError: {
    borderColor: '#ef4444',
  },
  fieldErrorText: {
    marginTop: 2,
    fontSize: 11,
    color: '#ef4444',
  },
  fieldInfoText: {
    fontSize: 11,
    color: '#4b5563',
  },
  upiBox: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#facc15',
    backgroundColor: '#fef9c3',
    padding: 8,
    alignItems: 'center',
  },
  upiQrHelpText: {
    fontSize: 11,
    color: '#6b7280',
    marginBottom: 6,
  },
  upiQrImage: {
    width: 140,
    height: 140,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  upiIdBadge: {
    marginTop: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#facc15',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  upiLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#854d0e',
  },
  upiValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#854d0e',
    marginTop: 2,
  },
  upiHint: {
    fontSize: 11,
    color: '#a16207',
    marginTop: 2,
  },
  addPaymentButton: {
    marginTop: 4,
    borderRadius: 8,
    backgroundColor: '#0064c2',
    paddingVertical: 6,
    alignItems: 'center',
  },
  addPaymentButtonDisabled: {
    opacity: 0.5,
  },
  addPaymentButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  cancelEditButton: {
    marginTop: 4,
    borderRadius: 8,
    backgroundColor: '#e5e7eb',
    paddingVertical: 6,
    alignItems: 'center',
  },
  cancelEditText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  selectedMethodsSection: {
    marginTop: 6,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  selectedMethodCard: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    padding: 8,
    marginBottom: 4,
  },
  selectedMethodCardEditing: {
    borderColor: '#0064c2',
    backgroundColor: '#eff6ff',
  },
  selectedMethodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  selectedMethodLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectedMethodIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  selectedMethodLabel: {
    fontSize: 12,
    color: '#111827',
    fontWeight: '500',
  },
  editingTag: {
    fontSize: 11,
    color: '#0064c2',
  },
  removeMethodButton: {
    padding: 4,
    borderRadius: 999,
  },
  removeMethodText: {
    fontSize: 12,
    color: '#9ca3af',
  },
  methodDetailText: {
    fontSize: 11,
    color: '#4b5563',
  },
  methodAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  methodAmountLabel: {
    fontSize: 11,
    color: '#6b7280',
    marginRight: 4,
  },
  methodAmountValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0064c2',
  },
  summaryCard: {
    marginTop: 6,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  summaryDivider: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    marginVertical: 4,
  },
  summaryLabel: {
    fontSize: 11,
    color: '#6b7280',
  },
  summaryLabelStrong: {
    fontSize: 11,
    fontWeight: '600',
    color: '#111827',
  },
  summaryValue: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0064c2',
  },
  summaryRemaining: {
    fontSize: 12,
    fontWeight: '600',
  },
  summaryRemainingDue: {
    color: '#dc2626',
  },
  summaryRemainingOk: {
    color: '#16a34a',
  },
  billSummary: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 6,
  },
  summaryTotal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#033c70',
  },
  summaryDiscount: {
    fontSize: 12,
    fontWeight: '700',
    color: '#f97316',
  },
  summaryRowBorderTop: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 4,
    marginTop: 4,
  },
  summaryTotalStrong: {
    fontSize: 13,
    fontWeight: '700',
    color: '#033c70',
  },
  payNowButton: {
    marginTop: 8,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: '#0064c2',
  },
  payNowButtonDisabled: {
    backgroundColor: '#e5e7eb',
  },
  payNowText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  invoiceModal: {
    width: '100%',
    maxWidth: 480,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    padding: 12,
  },
  invoiceCloseButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    zIndex: 20,
    elevation: 20,
    padding: 10,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  invoiceCloseText: {
    fontSize: 16,
    color: '#9ca3af',
  },
  invoiceScroll: {
    maxHeight: Math.min(Dimensions.get('window').height * 0.82, 720),
  },
  invoiceWebViewContainer: {
    height: 420,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f9fafb',
  },
  invoiceWebView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  invoiceScrollContent: {
    paddingTop: 8,
    paddingRight: 44,
    paddingBottom: 4,
  },
  invoiceTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  invoiceLabel: {
    fontSize: 12,
    color: '#374151',
  },
  invoiceAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#033c70',
    marginBottom: 8,
  },
  invoiceInfoBlock: {
    marginVertical: 6,
  },
  invoiceInfoText: {
    fontSize: 12,
    color: '#4b5563',
    marginTop: 2,
  },
  invoiceButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  invoiceButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#0064c2',
    marginRight: 8,
  },
  invoiceButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  invoiceButtonSecondary: {
    backgroundColor: '#ffaf0f',
  },
  invoiceButtonSecondaryText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
  },
});


