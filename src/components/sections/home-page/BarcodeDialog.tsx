import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  Platform,
} from 'react-native';
import { Camera, useCameraDevice, useCodeScanner } from 'react-native-vision-camera';
import { check, request, PERMISSIONS, RESULTS, PermissionStatus } from 'react-native-permissions';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { getMultipleProducts } from '../../../services/api/productService';

const FALLBACK_IMAGE = require('../../../assets/noImage.png');

interface Product {
  id: string;
  name: string;
  price: number;
  originalPrice: number;
  discount: string;
  image: string;
  unit: string;
  category: string;
  sku?: string;
  qtyMux?: string;
  remainingqty?: string;
}

interface BarcodeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (barcode: string) => void;
  barcodeOnly?: boolean;
  title?: string;
  cartItems?: any[];
  onAddToCart?: (product: any, quantity?: number) => void;
  onUpdateQuantity?: (id: string | number, quantity: number) => void;
  onRemoveFromCart?: (id: string | number) => void;
  autoAdd?: boolean;
}

type ScanState = 'idle' | 'scanning' | 'processing' | 'success' | 'error';

export default function BarcodeDialog({
  isOpen,
  onClose,
  onSubmit,
  barcodeOnly = false,
  title,
  cartItems = [],
  onAddToCart,
  onUpdateQuantity,
  onRemoveFromCart,
  autoAdd = false,
}: BarcodeDialogProps) {
  const [barcode, setBarcode] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [showScanner, setShowScanner] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [shouldAutoAdd, setShouldAutoAdd] = useState(false);
  const [scanLocked, setScanLocked] = useState(false);
  const scanLockedRef = useRef(false);
  const [cameraPermission, setCameraPermission] = useState<PermissionStatus | null>(null);

  const device = useCameraDevice('back');
  const cameraRef = useRef<Camera>(null);

  const codeScanner = useCodeScanner({
    codeTypes: ['ean-13', 'ean-8', 'upc-a', 'upc-e', 'code-128', 'qr'],
    onCodeScanned: (codes: any[]) => {
      if (codes.length > 0 && scanState === 'scanning') {
        console.log('SCANNER RAW RESULT:', codes);
        const scannedCode = codes[0].value;
        console.log('SCANNED BARCODE VALUE:', scannedCode);
        if (scannedCode && scannedCode.length >= 4) {
          handleScanSuccess(scannedCode);
        }
      }
    },
  });

  // Camera permission handling using react-native-permissions
  useEffect(() => {
    const ensureCameraPermission = async () => {
      const permission =
        Platform.OS === 'ios' ? PERMISSIONS.IOS.CAMERA : PERMISSIONS.ANDROID.CAMERA;

      try {
        const current = await check(permission);
        if (current === RESULTS.GRANTED || current === RESULTS.LIMITED) {
          setCameraPermission(current);
          return;
        }

        const result = await request(permission);
        setCameraPermission(result);

        if (result !== RESULTS.GRANTED && result !== RESULTS.LIMITED) {
          Alert.alert(
            'Camera permission required',
            'Please enable camera access in settings to scan barcodes.',
          );
        }
      } catch (err) {
        console.warn('Failed to request camera permission:', err);
        setCameraPermission(null);
      }
    };

    if (isOpen) {
      ensureCameraPermission();
    }
  }, [isOpen]);

  const resetState = useCallback(() => {
    setBarcode('');
    setProducts([]);
    setError(null);
    setHasSearched(false);
    setScanState('idle');
    setLoading(false);
    setShowScanner(false);
    setTorchEnabled(false);
    setShouldAutoAdd(false);
    setScanLocked(false);
    scanLockedRef.current = false;
  }, []);

  const handleScanSuccess = useCallback(
    (decodedText: string) => {
      if (scanLockedRef.current) return;
      scanLockedRef.current = true;
      setScanLocked(true);
      setTimeout(() => {
        scanLockedRef.current = false;
        setScanLocked(false);
      }, 500);

      console.log('BARCODE RECEIVED:', decodedText);
      const processedBarcode = decodedText.includes('ST')
        ? decodedText.split('ST')[0]
        : decodedText;
      console.log('BARCODE AFTER PROCESSING:', processedBarcode);
      setScanState('success');
      setBarcode(processedBarcode);
      setShowScanner(false);
      if (barcodeOnly) {
        onSubmit(processedBarcode);
        onClose();
        return;
      }
      // Immediately kick off barcode lookup; duplicates are handled by `scanLockedRef`.
      searchProductsByBarcode(processedBarcode, autoAdd);
    },
    [autoAdd, barcodeOnly, onSubmit, onClose],
  );

  const searchProductsByBarcode = async (
    barcodeData: string,
    autoAdd: boolean = false,
  ) => {
    setLoading(true);
    setError(null);
    // For single-result scans we will auto-add and immediately close, so
    // avoid showing the suggestions/no-results UI.
    setHasSearched(false);

    try {
      const result = await getMultipleProducts([barcodeData]);
      if (
        result.success &&
        result.data &&
        result.data.status === 'success' &&
        Array.isArray(result.data.cartItem)
      ) {
        const mappedProducts = result.data.cartItem.map((item: any, index: number) => ({
          id: item.id || item.sku || `barcode_${index}_${Date.now()}`,
          name: item.name || 'No Name',
          price: item.netPrice || item.MRP || 0,
          originalPrice: item.MRP || item.netPrice || 0,
          discount:
            item.MRP && item.netPrice && item.MRP > item.netPrice
              ? `${Math.round(((item.MRP - item.netPrice) / item.MRP) * 100)}% OFF`
              : '',
          image: item.plulink || '',
          unit: item.qtyunit || '',
          category: item.deptNmbr || '',
          sku: item.sku || item.id || '',
          qtyMux: item.qtyMux || '',
          remainingqty: item.remainingqty || '0',
        }));
        // POS behavior: when exactly one product matches, auto-add immediately
        // and never render the suggestions list UI.
        if (mappedProducts.length === 1) {
          const product = mappedProducts[0];
          setShouldAutoAdd(false);
          setProducts([]);
          console.log('BARCODE AUTO ADD:', {
            productId: product.id,
            productName: product.name,
            barcode: barcodeData,
          });

          handleAddToCart(product, { closeDelayMs: 0 });
          return;
        }

        // Multiple matches: show suggestions list for manual selection.
        setProducts(mappedProducts);
        setError(null);
        setShouldAutoAdd(false);
        setHasSearched(true);
      } else {
        setProducts([]);
        setError('No products found for this barcode.');
        setHasSearched(true);
      }
    } catch (error) {
      console.error('Barcode search error:', error);
      setProducts([]);
      setError('Failed to search products. Please try again later.');
      setHasSearched(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = () => {
    if (!barcode.trim()) return;
    if (barcodeOnly) {
      onSubmit(barcode.trim());
      onClose();
      return;
    }
    searchProductsByBarcode(barcode.trim());
  };

  const handleAddToCart = useCallback(
    (product: Product, opts: { closeDelayMs?: number } = {}) => {
      if (!onAddToCart) return;
    const cartItem = {
      id: product.id,
      name: product.name,
      sku: product.sku || product.id,
      qtyunit: product.unit,
      MRP: product.originalPrice,
      netPrice: product.price,
      quantity: 1,
      qtyMux: product.qtyMux || '',
      remainingqty: product.remainingqty || '0',
      imageUrl: product.image || '',
      plulink: product.image || '',
      };
      onAddToCart(cartItem, 1);
      const closeDelayMs = opts.closeDelayMs ?? 300;
      setTimeout(() => {
        resetState();
        onClose();
      }, closeDelayMs);
    },
    [onAddToCart, resetState, onClose],
  );

  useEffect(() => {
    if (shouldAutoAdd && products.length > 0 && !loading) {
      const product = products[0];
      handleAddToCart(product);
      setShouldAutoAdd(false);
    }
  }, [shouldAutoAdd, products, loading, handleAddToCart]);

  const handleRemoveFromCart = (productId: string) => {
    if (!onUpdateQuantity || !onRemoveFromCart) return;
    const cartItem = cartItems.find(item => item.id === productId);
    if (cartItem && cartItem.quantity > 1) {
      onUpdateQuantity(productId, cartItem.quantity - 1);
    } else {
      onRemoveFromCart(productId);
    }
  };

  const getItemQuantity = (itemId: string) => {
    const item = cartItems.find(item => item.id === itemId);
    return item ? item.quantity : 0;
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const toggleTorch = async () => {
    if (cameraRef.current && device) {
      try {
        // react-native-vision-camera torch is controlled via device prop
        // For now, we'll just toggle the state - actual torch control requires device switching
        setTorchEnabled(!torchEnabled);
      } catch (err) {
        console.warn('Failed to toggle torch:', err);
      }
    }
  };

  useEffect(() => {
    if (isOpen) {
      setShowScanner(true);
      setScanState('scanning');
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      resetState();
    }
  }, [isOpen, resetState]);

  if (!isOpen) return null;

  if (cameraPermission !== null && cameraPermission !== RESULTS.GRANTED && cameraPermission !== RESULTS.LIMITED) {
  return (
      <Modal visible={isOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.errorText}>
              Camera permission is required to use the barcode scanner. Please enable it in your
              device settings.
            </Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    );
  }

  if (!device) {
    return (
      <Modal visible={isOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.errorText}>
              Camera not available. Please check permissions.
            </Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={isOpen} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>{title ?? 'Scan Barcode'}</Text>
            <Pressable onPress={handleClose} style={styles.closeIcon}>
              <Icon name="close" size={24} color="#9ca3af" />
            </Pressable>
          </View>

          {/* Scanner/Manual Entry Tabs */}
          <View style={styles.tabs}>
            <Pressable
              onPress={() => {
                setShowScanner(true);
                setError(null);
                setScanState('scanning');
              }}
              style={[styles.tab, showScanner && styles.tabActive]}
            >
              <Text
                style={[styles.tabText, showScanner && styles.tabTextActive]}
            >
              Scanner
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setShowScanner(false);
                setScanState('idle');
              }}
              style={[styles.tab, !showScanner && styles.tabActive]}
            >
              <Text
                style={[styles.tabText, !showScanner && styles.tabTextActive]}
            >
              Manual entry
              </Text>
            </Pressable>
          </View>

          {/* Scanner View */}
          {showScanner ? (
            <View style={styles.scannerContainer}>
              <View style={styles.cameraWrapper}>
                <Camera
                  ref={cameraRef}
                  style={styles.camera}
                  device={device}
                  isActive={showScanner && isOpen}
                  codeScanner={codeScanner}
                />
                {scanState === 'scanning' && (
                  <>
                    <Pressable
                      onPress={toggleTorch}
                      style={styles.torchButton}
                    >
                      <Icon
                        name={torchEnabled ? 'flash-on' : 'flash-off'}
                        size={24}
                        color={torchEnabled ? '#ffaf0f' : '#ffffff'}
                      />
                    </Pressable>
                    <View style={styles.scanLine} />
                  </>
                )}
              </View>
              {scanState === 'success' && (
                <View style={styles.successContainer}>
                  <Text style={styles.successText}>
                    ✅ Barcode scanned successfully!
                  </Text>
                  <Text style={styles.barcodeText}>Code: {barcode}</Text>
                </View>
              )}
              {scanState === 'error' && error && (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>❌ {error}</Text>
                  <Pressable
                    onPress={() => {
                      setShowScanner(true);
                      setScanState('scanning');
                      setError(null);
                    }}
                    style={styles.retryButton}
                  >
                    <Text style={styles.retryButtonText}>🔄 Try Again</Text>
                  </Pressable>
                </View>
              )}
            </View>
          ) : (
            /* Manual Entry Form */
            <View style={styles.formContainer}>
              <Text style={styles.label}>
                Enter Barcode or Tap Scanner to Scan
              </Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                    value={barcode}
                  onChangeText={setBarcode}
                    placeholder="Enter barcode number or use scanner"
                  placeholderTextColor="#9ca3af"
                    autoFocus
                  />
                <Pressable
                  onPress={() => {
                    setShowScanner(true);
                    setScanState('scanning');
                  }}
                  style={styles.scannerIconButton}
                >
                  <Icon name="qr-code-scanner" size={20} color="#ffaf0f" />
                </Pressable>
              </View>
              <View style={styles.buttonRow}>
                <Pressable
                  onPress={handleClose}
                  style={[styles.button, styles.cancelButton]}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={handleSubmit}
                  disabled={loading || !barcode.trim()}
                  style={[
                    styles.button,
                    styles.submitButton,
                    (loading || !barcode.trim()) && styles.buttonDisabled,
                  ]}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.submitButtonText}>
                      {barcodeOnly ? 'Use this code' : 'Search'}
                    </Text>
                  )}
                </Pressable>
              </View>
            </View>
          )}

          {/* Search Results Section */}
          {!barcodeOnly && hasSearched && (
            <ScrollView style={styles.resultsContainer}>
              {loading && (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#0064c2" />
                  <Text style={styles.loadingText}>Searching products...</Text>
                </View>
              )}

              {error && !loading && !showScanner && (
                <View style={styles.noResultsContainer}>
                  <Icon name="error-outline" size={64} color="#ef4444" />
                  <Text style={styles.noResultsTitle}>Search Failed</Text>
                  <Text style={styles.noResultsText}>{error}</Text>
                </View>
              )}

              {!loading && products.length === 0 && !error && (
                <View style={styles.noResultsContainer}>
                  <Icon name="search-off" size={64} color="#d1d5db" />
                  <Text style={styles.noResultsTitle}>No Products Found</Text>
                  <Text style={styles.noResultsText}>
                    We couldn't find any products matching barcode "{barcode}"
                  </Text>
                </View>
              )}

              {!loading && products.length > 0 && (
                <View style={styles.productsList}>
                  {products.map(item => {
                    const quantity = getItemQuantity(item.id);
                    return (
                      <View key={item.id} style={styles.productRow}>
                        <Image
                          source={
                            item.image && item.image !== '/window.svg'
                              ? { uri: item.image }
                              : FALLBACK_IMAGE
                          }
                          style={styles.productImage}
                          resizeMode="cover"
                        />
                        <View style={styles.productInfo}>
                          <Text style={styles.productName} numberOfLines={1}>
                            {item.name || 'No Name'}
                          </Text>
                          <View style={styles.priceRow}>
                            <Text style={styles.priceText}>
                              ₹{item.price?.toFixed(2) ?? '0.00'}
                            </Text>
                            {item.originalPrice > item.price && (
                              <Text style={styles.originalPriceText}>
                                ₹{item.originalPrice?.toFixed(2) ?? ''}
                              </Text>
                            )}
                            {item.discount && (
                              <View style={styles.discountBadge}>
                                <Text style={styles.discountBadgeText}>
                                {item.discount}
                                </Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.unitText}>{item.unit || '-'}</Text>
                        </View>
                        <View style={styles.productActions}>
                          {quantity === 0 ? (
                            <Pressable
                              onPress={() => handleAddToCart(item)}
                              style={styles.addButton}
                            >
                              <Icon name="add" size={16} color="#ffffff" />
                              <Text style={styles.addButtonText}>Add</Text>
                            </Pressable>
                          ) : (
                            <View style={styles.qtyControl}>
                              <Pressable
                                onPress={() => handleRemoveFromCart(item.id)}
                                style={styles.qtyButton}
                              >
                                <Icon name="remove" size={16} color="#ffffff" />
                              </Pressable>
                              <Text style={styles.qtyValue}>{quantity}</Text>
                              <Pressable
                                onPress={() => handleAddToCart(item)}
                                style={styles.qtyButton}
                              >
                                <Icon name="add" size={16} color="#ffffff" />
                              </Pressable>
                            </View>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 600,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
  },
  closeIcon: {
    padding: 4,
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
  },
  tabActive: {
    backgroundColor: '#0064c2',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
    textAlign: 'center',
  },
  tabTextActive: {
    color: '#ffffff',
  },
  scannerContainer: {
    padding: 16,
    gap: 16,
  },
  cameraWrapper: {
    width: '100%',
    height: 400,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f3f4f6',
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  torchButton: {
    position: 'absolute',
    top: 16,
    left: 16,
    zIndex: 10,
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    height: 4,
    backgroundColor: '#0064c2',
    shadowColor: '#0064c2',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
  },
  successContainer: {
    backgroundColor: '#d1fae5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 8,
    padding: 12,
  },
  successText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#065f46',
    marginBottom: 4,
  },
  barcodeText: {
    fontSize: 12,
    color: '#047857',
  },
  errorContainer: {
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 8,
    padding: 12,
  },
  errorText: {
    fontSize: 14,
    color: '#991b1b',
    marginBottom: 8,
  },
  retryButton: {
    marginTop: 8,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#dc2626',
    textDecorationLine: 'underline',
  },
  formContainer: {
    padding: 16,
    gap: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: '#ffffff',
  },
  input: {
    flex: 1,
    height: 44,
    fontSize: 14,
    color: '#111827',
  },
  scannerIconButton: {
    padding: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  submitButton: {
    backgroundColor: '#0064c2',
  },
  submitButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  resultsContainer: {
    maxHeight: 400,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6b7280',
  },
  noResultsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  noResultsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
  },
  noResultsText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    maxWidth: 300,
  },
  productsList: {
    gap: 8,
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  productImage: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: '#e5e7eb',
    marginRight: 12,
  },
  productInfo: {
    flex: 1,
    minWidth: 0,
  },
  productName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 4,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  priceText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginRight: 8,
  },
  originalPriceText: {
    fontSize: 12,
    color: '#9ca3af',
    textDecorationLine: 'line-through',
    marginRight: 8,
  },
  discountBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#ffaf0f',
  },
  discountBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#ffffff',
  },
  unitText: {
    fontSize: 12,
    color: '#6b7280',
  },
  productActions: {
    marginLeft: 8,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#0064c2',
  },
  addButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  qtyControl: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0064c2',
    borderRadius: 8,
    overflow: 'hidden',
  },
  qtyButton: {
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  qtyValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
    paddingHorizontal: 12,
    minWidth: 32,
    textAlign: 'center',
  },
  closeButton: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#0064c2',
    borderRadius: 8,
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
});
