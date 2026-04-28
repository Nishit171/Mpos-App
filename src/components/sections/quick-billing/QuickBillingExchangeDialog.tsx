import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { Picker } from '@react-native-picker/picker';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {
  getItemDetails,
  getOrderDetails,
  getReturnReasons,
  getvalidateQuantity,
  isValidateQuantitySuccess,
} from '../../../services/api/ReturnOrderApi';
import BarcodeDialog from '../home-page/BarcodeDialog';

export type QuickBillingExchangeApplyPayload = {
  billId: string;
  reasonId: string;
  lines: Array<{
    itemSkuCode: string;
    qty: number;
    itemName: string;
  }>;
  totalAmount: number;
  otherReason?: string;
};

type ReasonRow = { reasonId: string | number; description: string };

type LineRow = {
  itemSkuCode: string;
  itemName: string;
  itemPrice: number;
  qty: number;
  maxQty: number;
};

function normalizeReasons(raw: unknown): ReasonRow[] {
  if (!raw) return [];
  const arr = Array.isArray(raw) ? raw : (raw as { data?: unknown })?.data;
  if (!Array.isArray(arr)) return [];
  return arr
    .map((r: any) => ({
      reasonId: r?.reasonId ?? r?.id ?? '',
      description: String(r?.description ?? r?.name ?? ''),
    }))
    .filter(r => r.reasonId !== '' && r.description);
}

function parseItemRows(details: unknown): LineRow[] {
  if (!details) return [];
  const list = Array.isArray(details) ? details : [details];
  const out: LineRow[] = [];
  for (const d of list) {
    if (!d || typeof d !== 'object') continue;
    const o = d as Record<string, unknown>;
    const sku = String(o.itemSkuCode ?? '');
    if (!sku) continue;
    const maxQty = Math.max(1, Number(o.itemQuantity) || 1);
    const price = Number(o.itemPrice) || 0;
    const name = String(o.itemName ?? o.name ?? sku);
    out.push({
      itemSkuCode: sku,
      itemName: name,
      itemPrice: price,
      qty: 1,
      maxQty,
    });
  }
  return out;
}

interface QuickBillingExchangeDialogProps {
  open: boolean;
  onClose: () => void;
  onApply: (payload: QuickBillingExchangeApplyPayload) => void;
}

export default function QuickBillingExchangeDialog({
  open,
  onClose,
  onApply,
}: QuickBillingExchangeDialogProps) {
  const [billId, setBillId] = useState('');
  const [submittedBillId, setSubmittedBillId] = useState('');
  const [orderSummary, setOrderSummary] = useState<{ id?: string | number; createdDateTime?: string } | null>(
    null
  );
  const [itemCode, setItemCode] = useState('');
  const [lines, setLines] = useState<LineRow[]>([]);
  const [reasons, setReasons] = useState<ReasonRow[]>([]);
  const [selectedReason, setSelectedReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [loadingBill, setLoadingBill] = useState(false);
  const [loadingItem, setLoadingItem] = useState(false);
  const [barcodeOpen, setBarcodeOpen] = useState(false);
  const [barcodeTarget, setBarcodeTarget] = useState<'billId' | 'itemCode' | null>(null);

  useEffect(() => {
    if (!open) return;
    ;(async () => {
      try {
        const raw = await getReturnReasons();
        setReasons(normalizeReasons(raw));
      } catch {
        setReasons([]);
      }
    })();
  }, [open]);

  useEffect(() => {
    if (!open) {
      setBillId('');
      setSubmittedBillId('');
      setOrderSummary(null);
      setItemCode('');
      setLines([]);
      setSelectedReason('');
      setCustomReason('');
      setBarcodeOpen(false);
      setBarcodeTarget(null);
    }
  }, [open]);

  const handleSubmitBill = async () => {
    const id = billId.trim();
    if (!id) {
      showToast('error', 'Validation', 'Enter a bill ID');
      return;
    }
    setLoadingBill(true);
    try {
      const orderDetails = await getOrderDetails(id);
      if (!orderDetails || (typeof orderDetails === "object" && Object.keys(orderDetails).length === 0)) {
        showToast('error', 'Not found', 'No order found for this bill ID');
        setSubmittedBillId('');
        setOrderSummary(null);
        return;
      }
      setSubmittedBillId(id);
      const raw = orderDetails as Record<string, unknown>;
      const o =
        raw?.data && typeof raw.data === "object"
          ? (raw.data as Record<string, unknown>)
          : raw;
      setOrderSummary({
        id: (o.id ?? o.orderId ?? o.order_id) as string | number | undefined,
        createdDateTime: o.createdDateTime as string | undefined,
      });
    } catch {
      showToast('error', 'Error', 'Failed to load order');
      setSubmittedBillId('');
      setOrderSummary(null);
    } finally {
      setLoadingBill(false);
    }
  };

  const handleAddItem = async (code?: string) => {
    const current = (code ?? itemCode).replace(/\D/g, '');
    if (!current) {
      showToast('error', 'Validation', 'Enter product code');
      return;
    }
    if (!submittedBillId) {
      showToast('error', 'Validation', 'Load a bill first');
      return;
    }
    setLoadingItem(true);
    try {
      const vq = await getvalidateQuantity(current, submittedBillId, 0);
      if (!vq || !isValidateQuantitySuccess(vq)) {
        showToast('error', 'Quantity', `Quantity not available for item ${current}`);
        return;
      }
      const itemDetails = await getItemDetails(current, submittedBillId);
      if (!itemDetails) {
        showToast('error', 'Error', 'Could not load item details');
        return;
      }
      const parsed = parseItemRows(itemDetails);
      if (parsed.length === 0) {
        showToast('error', 'Error', 'Invalid item response');
        return;
      }
      setLines(prev => {
        const next = [...prev];
        for (const row of parsed) {
          const idx = next.findIndex(l => l.itemSkuCode === row.itemSkuCode);
          if (idx >= 0) {
            next[idx] = {
              ...next[idx],
              maxQty: row.maxQty,
              itemPrice: row.itemPrice || next[idx].itemPrice,
              itemName: row.itemName || next[idx].itemName,
              qty: Math.min(next[idx].qty + 1, row.maxQty),
            };
          } else {
            next.push(row);
          }
        }
        return next;
      });
      setItemCode('');
    } catch {
      showToast('error', 'Error', 'Failed to add item');
    } finally {
      setLoadingItem(false);
    }
  };

  const setQty = (sku: string, next: number) => {
    setLines(prev =>
      prev.map(l => {
        if (l.itemSkuCode !== sku) return l;
        const q = Math.max(1, Math.min(next, l.maxQty));
        return { ...l, qty: q };
      })
    );
  };

  const removeLine = (sku: string) => {
    setLines(prev => prev.filter(l => l.itemSkuCode !== sku));
  };

  const totalAmount = lines.reduce((s, l) => s + l.itemPrice * l.qty, 0);

  const handleApply = () => {
    if (!submittedBillId) {
      showToast('error', 'Validation', 'Load a bill first');
      return;
    }
    if (!lines.length) {
      showToast('error', 'Validation', 'Add at least one exchange line');
      return;
    }
    if (!selectedReason) {
      showToast('error', 'Validation', 'Select a return reason');
      return;
    }
    if (selectedReason === '11' && !customReason.trim()) {
      showToast('error', 'Validation', 'Enter a reason');
      return;
    }
    const payload: QuickBillingExchangeApplyPayload = {
      billId: submittedBillId,
      reasonId: selectedReason,
      lines: lines.map((l) => ({
        itemSkuCode: l.itemSkuCode,
        qty: l.qty,
        itemName: l.itemName,
      })),
      totalAmount,
      ...(selectedReason === '11' ? { otherReason: customReason.trim() } : {}),
    };
    onApply(payload);
    onClose();
    showToast('success', 'Success', 'Exchange applied to checkout');
  };

  return (
    <>
      <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
        <View style={styles.overlay}>
          <View style={styles.container}>
            <View style={styles.header}>
              <Text style={styles.title}>Exchange Product</Text>
              <Pressable onPress={onClose} style={styles.closeBtn}>
                <Icon name="close" size={22} color="#64748b" />
              </Pressable>
            </View>

            <ScrollView
              style={styles.content}
              contentContainerStyle={styles.contentInner}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.section}>
                <Text style={styles.label}>Bill ID</Text>
                <View style={styles.row}>
                  <View style={styles.inputWithIcon}>
                    <TextInput
                      style={styles.input}
                      value={billId}
                      onChangeText={text => setBillId(text.replace(/[^0-9]/g, ''))}
                      placeholder="Bill / order ID"
                      placeholderTextColor="#94a3b8"
                      keyboardType="number-pad"
                    />
                    <Pressable
                      style={styles.scanBtn}
                      onPress={() => {
                        setBarcodeTarget('billId');
                        setBarcodeOpen(true);
                      }}
                    >
                      <Icon name="qr-code-scanner" size={20} color="#ffaf0f" />
                    </Pressable>
                  </View>
                  <Pressable
                    style={[styles.primaryBtn, loadingBill && styles.btnDisabled]}
                    disabled={loadingBill}
                    onPress={() => void handleSubmitBill()}
                  >
                    {loadingBill ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.primaryBtnText}>Load</Text>
                    )}
                  </Pressable>
                </View>
                {orderSummary && submittedBillId ? (
                  <Text style={styles.metaText}>
                    Bill #{orderSummary.id ?? submittedBillId}
                    {orderSummary.createdDateTime ? ` · ${orderSummary.createdDateTime}` : ''}
                  </Text>
                ) : null}
              </View>

              {submittedBillId ? (
                <>
                  <View style={styles.section}>
                    <Text style={styles.label}>Return Reason</Text>
                    <View style={styles.pickerWrap}>
                      <Picker
                        selectedValue={selectedReason}
                        onValueChange={value => setSelectedReason(String(value))}
                        style={styles.picker}
                      >
                        <Picker.Item label="Select reason" value="" />
                        {reasons.map(r => (
                          <Picker.Item
                            key={String(r.reasonId)}
                            label={r.description}
                            value={String(r.reasonId)}
                          />
                        ))}
                      </Picker>
                    </View>
                    {selectedReason === '11' ? (
                      <TextInput
                        style={[styles.input, styles.mt10]}
                        placeholder="Specify reason"
                        placeholderTextColor="#94a3b8"
                        value={customReason}
                        onChangeText={setCustomReason}
                      />
                    ) : null}
                  </View>

                  <View style={styles.section}>
                    <Text style={styles.label}>Item Code</Text>
                    <View style={styles.row}>
                      <View style={styles.inputWithIcon}>
                        <TextInput
                          style={styles.input}
                          value={itemCode}
                          onChangeText={text => setItemCode(text.replace(/[^0-9]/g, ''))}
                          placeholder="Product code"
                          placeholderTextColor="#94a3b8"
                          keyboardType="number-pad"
                        />
                        <Pressable
                          style={styles.scanBtn}
                          onPress={() => {
                            setBarcodeTarget('itemCode');
                            setBarcodeOpen(true);
                          }}
                        >
                          <Icon name="qr-code-scanner" size={20} color="#ffaf0f" />
                        </Pressable>
                      </View>
                      <Pressable
                        style={[styles.primaryBtn, loadingItem && styles.btnDisabled]}
                        disabled={loadingItem}
                        onPress={() => void handleAddItem()}
                      >
                        {loadingItem ? (
                          <ActivityIndicator color="#fff" />
                        ) : (
                          <Text style={styles.primaryBtnText}>Add</Text>
                        )}
                      </Pressable>
                    </View>
                  </View>

                  {lines.length > 0 ? (
                    <View style={styles.section}>
                      <Text style={styles.sectionTitle}>Exchange Lines</Text>
                      {lines.map(line => (
                        <View key={line.itemSkuCode} style={styles.lineCard}>
                          <View style={styles.lineHeader}>
                            <View style={styles.lineHeaderText}>
                              <Text style={styles.lineName}>{line.itemName}</Text>
                              <Text style={styles.lineSku}>SKU {line.itemSkuCode}</Text>
                            </View>
                            <Pressable onPress={() => removeLine(line.itemSkuCode)}>
                              <Icon name="close" size={22} color="#dc2626" />
                            </Pressable>
                          </View>

                          <View style={styles.lineFooter}>
                            <Text style={styles.linePrice}>
                              Rs {line.itemPrice.toFixed(2)} x {line.qty} = Rs {(line.itemPrice * line.qty).toFixed(2)}
                            </Text>
                            <View style={styles.qtyWrap}>
                              <Pressable
                                style={[styles.qtyBtn, line.qty <= 1 && styles.qtyBtnDisabled]}
                                disabled={line.qty <= 1}
                                onPress={() => setQty(line.itemSkuCode, line.qty - 1)}
                              >
                                <Icon name="remove" size={18} color="#fff" />
                              </Pressable>
                              <Text style={styles.qtyText}>{line.qty}</Text>
                              <Pressable
                                style={[styles.qtyBtn, line.qty >= line.maxQty && styles.qtyBtnDisabled]}
                                disabled={line.qty >= line.maxQty}
                                onPress={() => setQty(line.itemSkuCode, line.qty + 1)}
                              >
                                <Icon name="add" size={18} color="#fff" />
                              </Pressable>
                            </View>
                          </View>
                          <Text style={styles.maxQtyText}>Max return qty: {line.maxQty}</Text>
                        </View>
                      ))}
                      <Text style={styles.totalText}>Credit value: Rs {totalAmount.toFixed(2)}</Text>
                    </View>
                  ) : null}
                </>
              ) : null}
            </ScrollView>

            <View style={styles.footer}>
              <Pressable onPress={onClose} style={[styles.footerBtn, styles.cancelBtn]}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleApply}
                disabled={!submittedBillId || !lines.length}
                style={[
                  styles.footerBtn,
                  styles.applyBtn,
                  (!submittedBillId || !lines.length) && styles.btnDisabled,
                ]}
              >
                <Text style={styles.applyText}>Apply to checkout</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <BarcodeDialog
        isOpen={barcodeOpen}
        onClose={() => {
          setBarcodeOpen(false);
          setBarcodeTarget(null);
        }}
        onSubmit={barcode => {
          const raw = barcode.replace(/\D/g, '');
          if (barcodeTarget === 'billId') {
            setBillId(raw);
          } else if (barcodeTarget === 'itemCode') {
            setItemCode(raw);
            if (submittedBillId && raw) void handleAddItem(raw);
          }
          setBarcodeOpen(false);
          setBarcodeTarget(null);
        }}
        barcodeOnly
        title={barcodeTarget === 'billId' ? 'Scan bill' : 'Scan product'}
        cartItems={[]}
      />
    </>
  );
}

const showToast = (
  type: 'success' | 'error',
  text1: string,
  text2?: string,
) => {
  Toast.show({
    type,
    text1,
    text2,
    position: 'top',
    visibilityTime: 2500,
    autoHide: true,
  });
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  container: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '92%',
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
  },
  closeBtn: {
    padding: 4,
  },
  content: {
    flexGrow: 1,
  },
  contentInner: {
    padding: 16,
    gap: 14,
  },
  section: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#334155',
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inputWithIcon: {
    flex: 1,
    position: 'relative',
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    backgroundColor: '#fff',
    color: '#000',
    paddingHorizontal: 12,
    paddingVertical: 10,
    paddingRight: 44,
    fontSize: 15,
  },
  scanBtn: {
    position: 'absolute',
    right: 8,
    top: '50%',
    marginTop: -16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 175, 15, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtn: {
    minWidth: 86,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
    backgroundColor: '#0064c2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  metaText: {
    marginTop: 8,
    fontSize: 12,
    color: '#64748b',
  },
  pickerWrap: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    overflow: 'hidden',
  },
  picker: {
    color: '#000',
  },
  mt10: {
    marginTop: 10,
  },
  lineCard: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  lineHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  lineHeaderText: {
    flex: 1,
    paddingRight: 8,
  },
  lineName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  lineSku: {
    marginTop: 2,
    fontSize: 12,
    color: '#64748b',
  },
  lineFooter: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  linePrice: {
    flex: 1,
    fontSize: 13,
    color: '#334155',
  },
  qtyWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    overflow: 'hidden',
  },
  qtyBtn: {
    backgroundColor: '#0064c2',
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnDisabled: {
    opacity: 0.45,
  },
  qtyText: {
    minWidth: 30,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  maxQtyText: {
    marginTop: 8,
    fontSize: 11,
    color: '#94a3b8',
  },
  totalText: {
    marginTop: 4,
    textAlign: 'right',
    color: '#033c70',
    fontWeight: '700',
    fontSize: 14,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    padding: 14,
    flexDirection: 'row',
    gap: 10,
  },
  footerBtn: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtn: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#fff',
  },
  applyBtn: {
    backgroundColor: '#0064c2',
  },
  cancelText: {
    color: '#0f172a',
    fontWeight: '600',
    fontSize: 15,
  },
  applyText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
});
