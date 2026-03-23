import type React from 'react';
import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  StyleSheet,
  TextInput,
  Alert,
  Dimensions,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import Icon from 'react-native-vector-icons/MaterialIcons';
import CreditNoteModal from './CreditNote';
import CreditNoteType from './CreditNoteType';
import BarcodeDialog from './BarcodeDialog';
import {
  getItemDetails,
  getOrderDetails,
  getReturnReasons,
  getSaveReturns,
  getvalidateQuantity,
} from '../../../services/api/ReturnOrderApi';

interface Order {
  id: number;
  status: string;
  createdDateTime: string;
}

interface ReturnOrderItem {
  itemSkuCode: string;
  itemName: string;
  itemPrice: number;
  itemQuantity: number;
}

interface NewItemsArray {
  itemPrice: string;
  itemQuantity: string;
  itemSkuCode: string;
  mrp: string;
  qty: string;
}

interface ReturnOrderDrawerProps {
  open: boolean;
  onClose: () => void;
  onGoHome: () => void;
}

const drawerMaxWidth = Math.min(Dimensions.get('window').width, 500);

const ReturnOrderDrawer: React.FC<ReturnOrderDrawerProps> = ({
  open,
  onClose,
  onGoHome,
}) => {
  const [billId, setBillId] = useState('');
  const [itemCode, setItemCode] = useState('');
  const [submittedBillId, setSubmittedBillId] = useState('');
  const [order, setOrder] = useState<Order | null>(null);
  const [returnResponse, setReturnReponse] = useState<any[]>([]);
  const [returnReason, setReturnReason] = useState<any[]>([]);
  const [returnOrderItem, setReturnOrderItem] = useState<ReturnOrderItem[]>([]);
  const [selectedReason, setSelectedReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [newItemsArray, setNewItemsArray] = useState<any[]>([]);
  const [savingReturns, setSavingReturns] = useState('');
  const [creditNoteModal, setOpenCreditNoteModal] = useState(false);
  const [itemQuantities, setItemQuantities] = useState<{
    [sku: string]: number;
  }>({});
  const [showQtyAlert, setShowQtyAlert] = useState(false);
  const [qtyAlertItemCode, setQtyAlertItemCode] = useState('');
  const [otherSavingReturns, setOtherSavingReturns] = useState('');
  const [showCreditType, setShowCreditType] = useState(false);
  const [creditNoteType, setCreditNoteType] = useState<
    'barcode' | 'description' | null
  >(null);
  const [isCreditEnabled, setIsCreditEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    context: 'bill' | 'reason' | 'search' | 'otherReason' | '';
  }>({
    text: '',
    context: '',
  });
  const [billPdfUrl, setBillPdfUrl] = useState('');
  const [creditNotPdfUrl, setCreditNotPdfUrl] = useState('');
  const [isBarcodeDialogOpen, setIsBarcodeDialogOpen] = useState(false);
  const [barcodeDialogTarget, setBarcodeDialogTarget] = useState<
    'billId' | 'itemCode' | null
  >(null);

  useEffect(() => {
    setItemQuantities(prev => {
      const updated = { ...prev };
      returnOrderItem.forEach(item => {
        if (!(item.itemSkuCode in updated)) {
          updated[item.itemSkuCode] = item.itemQuantity;
        }
      });
      Object.keys(updated).forEach(sku => {
        if (!returnOrderItem.some(i => i.itemSkuCode === sku)) {
          delete updated[sku];
        }
      });
      return updated;
    });
  }, [returnOrderItem]);

  useEffect(() => {
    if (!creditNoteModal && savingReturns) {
      // resetAllStates();
    }
  }, [creditNoteModal]);

  useEffect(() => {
    if (open) {
      setShowCreditType(false);
      setOpenCreditNoteModal(false);
      setCreditNoteType(null);
      setSavingReturns('');
      setOtherSavingReturns('');
      setBillPdfUrl('');
      setCreditNotPdfUrl('');
    }
  }, [open]);

  const showCustomToast = (code: any) => {
    Alert.alert(
      'Quantity Not Available',
      `For item code ${code}.`,
      [{ text: 'OK', style: 'default' }],
      { cancelable: true },
    );
  };

  const handleQuantityChange = (sku: string, delta: number) => {
    setItemQuantities(prev => {
      const item = returnOrderItem.find(i => i.itemSkuCode === sku);
      const originalQty = item?.itemQuantity ?? 1;
      const current = prev[sku] ?? originalQty;
      const newQty = Math.max(1, Math.min(current + delta, originalQty));
      return { ...prev, [sku]: newQty };
    });
    setNewItemsArray(prev =>
      prev.map(item =>
        item.itemSkuCode === sku
          ? {
              ...item,
              itemQuantity: Math.max(
                1,
                Math.min(
                  (itemQuantities[sku] ?? Number(item.itemQuantity)) + delta,
                  Number(
                    returnOrderItem.find(i => i.itemSkuCode === sku)
                      ?.itemQuantity ?? 1,
                  ),
                ),
              ).toString(),
            }
          : item,
      ),
    );
  };

  const handleSubmit = async (scannedBillId?: string) => {
    const currentBillId = scannedBillId || billId;
    if (currentBillId.trim()) {
      try {
        const orderDetails = await getOrderDetails(currentBillId);
        if (orderDetails) {
          setOrder(orderDetails);
          setSubmittedBillId(currentBillId);
          setMessage({ text: '', context: '' });
        } else if (
          orderDetails === null ||
          Object.keys(orderDetails || {}).length === 0
        ) {
          setOrder(null);
          setSubmittedBillId('');
          setBillId('');
          setMessage({ text: 'No order found for this Bill ID.', context: 'bill' });
          return;
        } else {
          setOrder(null);
          setSubmittedBillId('');
          setMessage({ text: '', context: '' });
          return;
        }
        const responses = await getReturnReasons();
        if (responses) {
          const responseArray = [responses];
          setReturnReason(responseArray);
        }
        setReturnReponse(responses);
        setMessage({ text: '', context: '' });
      } catch (error) {
        setOrder(null);
        setMessage({
          text: 'Failed to fetch order details. Please try again.',
          context: 'bill',
        });
        setBillId('');
      }
    } else {
      setBillId('');
      setMessage({ text: 'Please enter a valid Bill ID', context: 'bill' });
    }
  };

  const handleBillIdChange = (value: string) => {
    const numbersOnly = value.replace(/[^0-9]/g, '');
    setBillId(numbersOnly);
    setMessage({ text: '', context: '' });
    if (submittedBillId) {
      setSubmittedBillId('');
    }
    setItemCode('');
    setNewItemsArray([]);
    setReturnOrderItem([]);
    setItemQuantities({});
    setReturnReason([]);
    setSelectedReason('');
    setCustomReason('');
  };

  const handleSearchItems = async (scannedItemCode?: string) => {
    const currentItemCode = scannedItemCode || itemCode;
    if (currentItemCode === '') {
      setMessage({ text: 'Please enter Product code.', context: 'search' });
      return;
    }
    if (billId.trim() && currentItemCode.trim()) {
      try {
        const size = 0;
        const validateQuantity = await getvalidateQuantity(
          currentItemCode,
          billId,
          size,
        );
        if (validateQuantity.validate === 'success') {
          const itemDetails = await getItemDetails(currentItemCode, billId);
          if (itemDetails) {
            const newItemArray = Array.isArray(itemDetails)
              ? itemDetails.map(item => ({
                  itemPrice: item.itemPrice.toString(),
                  itemQuantity: item.itemQuantity.toString(),
                  itemSkuCode: item.itemSkuCode.toString(),
                  mrp: item.itemMRP.toString(),
                  qty: item.itemQuantity.toString(),
                }))
              : [
                  {
                    itemPrice: itemDetails.itemPrice.toString(),
                    itemQuantity: itemDetails.itemQuantity.toString(),
                    itemSkuCode: itemDetails.itemSkuCode.toString(),
                    mrp: itemDetails.itemMRP.toString(),
                    qty: itemDetails.itemQuantity.toString(),
                  },
                ];
            setNewItemsArray(prev => {
              const existingSkuCodes = new Set(prev.map(i => i.itemSkuCode));
              const filteredNew = newItemArray.filter(
                i => !existingSkuCodes.has(i.itemSkuCode),
              );
              return [...prev, ...filteredNew];
            });
            setReturnOrderItem(prev => {
              const newItems = Array.isArray(itemDetails)
                ? itemDetails
                : [itemDetails];
              const existingSkuCodes = new Set(prev.map(i => i.itemSkuCode));
              const filteredNew = newItems.filter(
                i => !existingSkuCodes.has(i.itemSkuCode),
              );
              return [...prev, ...filteredNew];
            });
            setItemCode('');
          }
          setIsCreditEnabled(false);
        } else {
          setIsCreditEnabled(true);
          setItemCode('');
          setMessage({
            text: `Quantity Not Available For Item Code ${currentItemCode}`,
            context: 'search',
          });
          return;
        }
      } catch (error) {
        setOrder(null);
        setIsCreditEnabled(true);
        setMessage({
          text: 'Failed to fetch item details. Please try again.',
          context: 'search',
        });
      }
    }
  };

  const handleRemoveItem = (skuCode: string) => {
    setNewItemsArray(prev => prev.filter(item => item.itemSkuCode !== skuCode));
    setReturnOrderItem(prev =>
      prev.filter(item => item.itemSkuCode !== skuCode),
    );
  };

  const handleIssueCreditNotes = async () => {
    setIsLoading(true);
    try {
      if (!selectedReason) {
        setShowCreditType(false);
        setMessage({ text: 'Please select a valid reason', context: 'reason' });
        return false;
      }
      if (selectedReason === '11' && !customReason) {
        setShowCreditType(false);
        setMessage({ text: 'Please enter a reason', context: 'otherReason' });
        return false;
      }
      const updatedItemsArray = newItemsArray.map(item => ({
        ...item,
        itemQuantity:
          itemQuantities[item.itemSkuCode]?.toString() ?? item.itemQuantity,
        qty: itemQuantities[item.itemSkuCode]?.toString() ?? item.qty,
        mrp: (
          Number(item.itemPrice) *
          (itemQuantities[item.itemSkuCode] ?? Number(item.itemQuantity))
        ).toString(),
      }));
      const items = {
        items: updatedItemsArray,
        orderId: billId,
        reasonId: selectedReason,
        totalAmount: updatedItemsArray
          .reduce((sum, item) => sum + Number(item.mrp), 0)
          .toString(),
        ...(selectedReason === '11' && customReason
          ? { otherReason: customReason }
          : {}),
      };
      for (const item of updatedItemsArray) {
        const isValid = await getvalidateQuantity(
          item.itemSkuCode,
          billId,
          Number(item.qty),
        );
        if (!isValid) {
          Alert.alert(
            'Validation',
            `Quantity validation failed for item ${item.itemSkuCode}`,
          );
          return false;
        }
      }
      const saveReturns = await getSaveReturns(items);
      if (saveReturns) {
        console.log('Credit Notes Issued Successfully:', saveReturns);
        const returnImg = saveReturns?.returnsBill;
        const returnBarcode = saveReturns?.creditNote[1]?.bill;

        const billPdf = saveReturns?.billPdfUrl;
        const customerPdf =
          saveReturns?.creditNote?.[1]?.txtCreditNote?.creditNotPdfUrl;

        setOtherSavingReturns(returnBarcode);
        setSavingReturns(returnImg);
        setBillPdfUrl(billPdf || '');
        setCreditNotPdfUrl(customerPdf || '');
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error issuing credit notes:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const resetAllStates = () => {
    setBillId('');
    setItemCode('');
    setSubmittedBillId('');
    setOrder(null);
    setReturnReponse([]);
    setReturnReason([]);
    setReturnOrderItem([]);
    setSelectedReason('');
    setCustomReason('');
    setNewItemsArray([]);
    setSavingReturns('');
    setOtherSavingReturns('');
    setOpenCreditNoteModal(false);
    setShowCreditType(false);
    setCreditNoteType(null);
    setItemQuantities({});
    setMessage({ text: '', context: '' });
    setBarcodeDialogTarget(null);
    setIsBarcodeDialogOpen(false);
    setBillPdfUrl('');
    setCreditNotPdfUrl('');
  };

  const closeDrawer = () => {
    onClose();
    resetAllStates();
  };

  useEffect(() => {
    console.log('RETURN DRAWER VISIBLE:', open);
  }, [open]);

  return (
    <Modal
      visible={open}
      transparent
      animationType="slide"
      onRequestClose={closeDrawer}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={closeDrawer} />
        <View style={[styles.drawer, { width: drawerMaxWidth }]}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Icon name="inbox" size={22} color="#0064c2" />
              <Text style={styles.headerTitle}>Return Order</Text>
            </View>
            <TouchableOpacity
              onPress={closeDrawer}
              style={styles.closeIconBtn}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Icon name="close" size={24} color="#000" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.section}>
              <Text style={styles.label}>Enter Bill ID</Text>
              <View style={styles.row}>
                <View style={styles.inputWithIcon}>
                  <TextInput
                    value={billId}
                    onChangeText={handleBillIdChange}
                    placeholder="Enter Bill Id"
                    placeholderTextColor="#94a3b8"
                    keyboardType="number-pad"
                    style={styles.input}
                  />
                  <TouchableOpacity
                    onPress={() => {
                      setBarcodeDialogTarget('billId');
                      setIsBarcodeDialogOpen(true);
                    }}
                    style={styles.scanBtn}
                    accessibilityLabel="Open barcode scanner for Bill ID"
                  >
                    <Icon name="qr-code-scanner" size={20} color="#ffaf0f" />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={() => handleSubmit()}
                >
                  <Text style={styles.primaryBtnText}>Submit</Text>
                </TouchableOpacity>
              </View>
              {message.context === 'bill' && message.text ? (
                <Text style={styles.errorText}>{message.text}</Text>
              ) : null}
            </View>

            {submittedBillId && order ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Order Details</Text>
                <View style={styles.card}>
                  <Text style={styles.cardText}>Bill ID: {order?.id}</Text>
                  <Text style={styles.cardText}>
                    Created At : {order?.createdDateTime}
                  </Text>
                </View>
              </View>
            ) : null}

            {submittedBillId ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Select a Reason</Text>
                <View style={styles.pickerWrap}>
                  <Picker
                    selectedValue={selectedReason}
                    onValueChange={val => {
                      setSelectedReason(String(val));
                      setMessage({ text: '', context: '' });
                    }}
                    style={styles.picker}
                  >
                    <Picker.Item label="Select" value="" />
                    {Array.isArray(returnResponse) &&
                      returnResponse.map(reason => (
                        <Picker.Item
                          key={reason.reasonId}
                          label={reason.description}
                          value={reason.reasonId.toString()}
                        />
                      ))}
                  </Picker>
                </View>
                {selectedReason === '11' ? (
                  <TextInput
                    style={[styles.input, styles.mt16]}
                    placeholder="Please specify your reason"
                    placeholderTextColor="#94a3b8"
                    value={customReason}
                    onChangeText={text => {
                      setCustomReason(text);
                      setMessage({ text: '', context: '' });
                    }}
                  />
                ) : null}
                {(message.context === 'reason' ||
                  message.context === 'otherReason') &&
                message.text ? (
                  <Text style={styles.errorText}>{message.text}</Text>
                ) : null}
              </View>
            ) : null}

            {submittedBillId ? (
              <View style={styles.section}>
                <Text style={styles.label}>Search by Item Code</Text>
                <View style={styles.row}>
                  <View style={styles.inputWithIcon}>
                    <TextInput
                      value={itemCode}
                      onChangeText={text => {
                        setItemCode(text.replace(/[^0-9]/g, ''));
                        setMessage({ text: '', context: '' });
                      }}
                      placeholder="Enter Product Code"
                      placeholderTextColor="#94a3b8"
                      keyboardType="number-pad"
                      style={styles.input}
                    />
                    <TouchableOpacity
                      onPress={() => {
                        setBarcodeDialogTarget('itemCode');
                        setIsBarcodeDialogOpen(true);
                      }}
                      style={styles.scanBtn}
                      accessibilityLabel="Open barcode scanner for Product Code"
                    >
                      <Icon name="qr-code-scanner" size={20} color="#ffaf0f" />
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity
                    style={styles.primaryBtn}
                    onPress={() => handleSearchItems()}
                  >
                    <Text style={styles.primaryBtnText}>Search</Text>
                  </TouchableOpacity>
                </View>
                {message.context === 'search' && message.text ? (
                  <Text style={styles.errorText}>{message.text}</Text>
                ) : null}
              </View>
            ) : null}

            {submittedBillId && newItemsArray?.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Items to Return</Text>
                {returnOrderItem?.map(item => (
                  <View key={item.itemSkuCode} style={styles.itemCard}>
                    <View style={styles.itemHeader}>
                      <Text style={styles.itemName}>{item.itemName}</Text>
                      <TouchableOpacity
                        onPress={() => handleRemoveItem(item.itemSkuCode)}
                        style={styles.removeBtn}
                        accessibilityLabel="Remove item"
                      >
                        <Icon name="close" size={22} color="#dc2626" />
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.cardText}>
                      Item Code :{' '}
                      <Text style={styles.bold}>{item.itemSkuCode}</Text>
                    </Text>
                    <View style={styles.itemFooter}>
                      <Text style={styles.priceText}>
                        ₹
                        {item.itemPrice &&
                        (itemQuantities[item.itemSkuCode] ?? item.itemQuantity)
                          ? (
                              item.itemPrice *
                              (itemQuantities[item.itemSkuCode] ??
                                item.itemQuantity)
                            ).toFixed(2)
                          : '0.00'}
                      </Text>
                      <View style={styles.qtyRow}>
                        <TouchableOpacity
                          style={[
                            styles.qtyBtn,
                            (itemQuantities[item.itemSkuCode] ??
                              item.itemQuantity) <= 1 && styles.qtyBtnDisabled,
                          ]}
                          onPress={() =>
                            handleQuantityChange(item.itemSkuCode, -1)
                          }
                          disabled={
                            (itemQuantities[item.itemSkuCode] ??
                              item.itemQuantity) <= 1
                          }
                          accessibilityLabel="Decrease quantity"
                        >
                          <Icon name="remove" size={18} color="#fff" />
                        </TouchableOpacity>
                        <TextInput
                          keyboardType="number-pad"
                          value={String(
                            itemQuantities[item.itemSkuCode] ??
                              item.itemQuantity,
                          )}
                          onChangeText={text => {
                            const n = Number(text.replace(/[^0-9]/g, ''));
                            if (!Number.isNaN(n)) {
                              handleQuantityChange(
                                item.itemSkuCode,
                                n -
                                  (itemQuantities[item.itemSkuCode] ??
                                    item.itemQuantity),
                              );
                            }
                          }}
                          style={styles.qtyInput}
                        />
                        <TouchableOpacity
                          style={[
                            styles.qtyBtn,
                            (itemQuantities[item.itemSkuCode] ??
                              item.itemQuantity) >= item.itemQuantity &&
                              styles.qtyBtnDisabled,
                          ]}
                          onPress={() =>
                            handleQuantityChange(item.itemSkuCode, 1)
                          }
                          disabled={
                            (itemQuantities[item.itemSkuCode] ??
                              item.itemQuantity) >= item.itemQuantity
                          }
                          accessibilityLabel="Increase quantity"
                        >
                          <Icon name="add" size={18} color="#fff" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}

            {submittedBillId && newItemsArray.length > 0 ? (
              <View style={styles.section}>
                <TouchableOpacity
                  style={[
                    styles.issueBtn,
                    isLoading && styles.issueBtnDisabled,
                  ]}
                  disabled={isLoading}
                  onPress={async () => {
                    const result = await handleIssueCreditNotes();
                    if (result === true) {
                      setShowCreditType(true);
                    }
                  }}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.issueBtnText}>Issue Credit Notes</Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : null}

            <CreditNoteModal
              creditNoteModal={creditNoteModal}
              setOpenCreditNoteModal={setOpenCreditNoteModal}
              creditnote={
                creditNoteType === 'description'
                  ? otherSavingReturns
                  : savingReturns
              }
              billPdfUrl={billPdfUrl}
              creditNotPdfUrl={creditNotPdfUrl}
              isCustomerCopy={creditNoteType === 'description'}
              onClose={() => {
                setOpenCreditNoteModal(false);
                setCreditNoteType(null);
              }}
            />
            <CreditNoteType
              open={showCreditType}
              onClose={() => {
                setShowCreditType(false);
                resetAllStates();
                onClose();
              }}
              onGoHome={onGoHome}
              onFirstAction={() => {
                setCreditNoteType('barcode');
                setOpenCreditNoteModal(true);
              }}
              onSecondAction={() => {
                setCreditNoteType('description');
                setOpenCreditNoteModal(true);
              }}
            />
          </ScrollView>
        </View>
      </View>

      <BarcodeDialog
        isOpen={isBarcodeDialogOpen && barcodeDialogTarget !== null}
        onClose={() => {
          setBarcodeDialogTarget(null);
          setIsBarcodeDialogOpen(false);
        }}
        onSubmit={async barcode => {
          if (barcodeDialogTarget === 'billId') {
            setBillId(barcode);
            await handleSubmit(barcode);
          } else if (barcodeDialogTarget === 'itemCode') {
            setItemCode(barcode);
            await handleSearchItems(barcode);
          }
          setBarcodeDialogTarget(null);
          setIsBarcodeDialogOpen(false);
        }}
        barcodeOnly
        title={
          barcodeDialogTarget === 'billId'
            ? 'Scan Bill ID'
            : barcodeDialogTarget === 'itemCode'
              ? 'Scan Product Code'
              : 'Scan Barcode'
        }
        cartItems={[]}
      />
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  backdrop: {
    flex: 1,
  },
  drawer: {
    height: '100%',
    flexDirection: 'column',
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#fff',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000',
    marginLeft: 12,
  },
  closeIconBtn: {
    padding: 8,
    borderRadius: 999,
  },
  scroll: {
    flexGrow: 1,
    flexShrink: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(15, 23, 42, 0.8)',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'column',
  },
  inputWithIcon: {
    position: 'relative',
    width: '100%',
    maxWidth: 320,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    paddingRight: 44,
    fontSize: 16,
    color: '#000',
    backgroundColor: '#fff',
  },
  scanBtn: {
    position: 'absolute',
    right: 8,
    top: '50%',
    marginTop: -18,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 175, 15, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtn: {
    alignSelf: 'flex-start',
    marginTop: 12,
    backgroundColor: '#0064c2',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    marginTop: 8,
  },
  card: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 16,
    backgroundColor: '#fff',
    maxWidth: 400,
  },
  cardText: {
    fontSize: 14,
    color: '#000',
    marginBottom: 4,
  },
  pickerWrap: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#fff',
    maxWidth: 320,
  },
  picker: {
    color: '#000',
  },
  mt16: {
    marginTop: 16,
  },
  itemCard: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    backgroundColor: '#fff',
    maxWidth: 400,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    flex: 1,
    paddingRight: 8,
  },
  removeBtn: {
    padding: 4,
  },
  bold: {
    fontWeight: '600',
  },
  itemFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  priceText: {
    color: '#033c70',
    fontWeight: '700',
    fontSize: 20,
    minWidth: 70,
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    overflow: 'hidden',
  },
  qtyBtn: {
    backgroundColor: '#0064c2',
    paddingHorizontal: 12,
    paddingVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyBtnDisabled: {
    opacity: 0.5,
  },
  qtyInput: {
    width: 48,
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 16,
    color: '#000',
    paddingVertical: 6,
  },
  issueBtn: {
    backgroundColor: '#0064c2',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    maxWidth: 172,
  },
  issueBtnDisabled: {
    opacity: 0.5,
  },
  issueBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
    textAlign: 'center',
  },
});

export default ReturnOrderDrawer;
