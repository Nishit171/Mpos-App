import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { searchProducts } from '../../../services/api/productService';

type BillType = "taxInvoice" | "invoice";

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
  deptNmbr?: string;
  skucounter?: number;
  vatbit?: string;
  productgrpnmbr?: number;
  pluFlag?: string;
  itemHSN?: number;
  qtyMux?: string;
  gstctype?: number;
  baseAmnt?: number;
  status?: string;
  scflag?: number;
  scantype?: string;
  remainingqty?: string;
  size?: string;
}

interface QuickBillingSearchBarProps {
  cartItems: any[];
  onAddToCart: (product: any, quantity?: number) => void;
  onUpdateQuantity: (id: string | number, quantity: number) => void;
  onRemoveFromCart: (id: string | number) => void;
  billType: BillType;
  onScanPress?: () => void;
  onAddProductPress?: () => void;
}

export default function QuickBillingSearchBar({
  cartItems,
  onAddToCart,
  onUpdateQuantity,
  onRemoveFromCart,
  billType,
  onScanPress,
  onAddProductPress,
}: QuickBillingSearchBarProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [barcodeResults, setBarcodeResults] = useState<Product[]>([]);
  const [barcodeValue, setBarcodeValue] = useState<string>('');

  // Search products with debounce
  useEffect(() => {
    if (!searchTerm.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      if (searchTerm === '') {
        setBarcodeResults([]);
        setBarcodeValue('');
      }
      return;
    }

    const timeoutId = setTimeout(() => {
      searchProductsHandler(searchTerm);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  const searchProductsHandler = async (term: string) => {
    setLoading(true);
    try {
      const result = await searchProducts(term);

      // Instrumentation: capture raw backend response + quantity fields.
      // This helps debug cases where stock/remaining quantity becomes incorrect.
      console.log('PRODUCT SEARCH RAW RESPONSE:', {
        term,
        success: result.success,
        rawData: result.data,
      });
      const rawCartItems = result.data?.cartItem;
      if (Array.isArray(rawCartItems)) {
        rawCartItems.slice(0, 10).forEach((item: any) => {
          console.log('PRODUCT SEARCH RESULT:', {
            id: item?.id ?? item?.sku,
            name: item?.name ?? 'No Name',
            quantityFromAPI: item?.quantity ?? item?.remainingqty,
            remainingqtyFromAPI: item?.remainingqty,
            rawItem: item,
          });
        });
      }

      if (
        result.success &&
        result.data &&
        Array.isArray(result.data.cartItem)
      ) {
        const mappedProducts = result.data.cartItem.map(
          (item: any, index: number) => ({
            id: item.id || item.sku || `search_${index}_${Date.now()}`,
            name: item.name || 'No Name',
            price: item.netPrice || item.MRP || 0,
            originalPrice: item.MRP || item.netPrice || 0,
            discount:
              item.MRP &&
              item.netPrice &&
              item.MRP > item.netPrice
                ? `${Math.round(
                    ((item.MRP - item.netPrice) / item.MRP) * 100,
                  )}% OFF`
                : '',
            image: item.plulink || '',
            unit: item.qtyunit || '',
            category: item.deptNmbr || '',
            sku: item.sku || item.id || '',
            deptNmbr: item.deptNmbr || '',
            skucounter: item.skucounter || 0,
            vatbit:
              item.vatbit ||
              '00000000000000000000000000000000',
            productgrpnmbr: item.productgrpnmbr || 0,
            pluFlag: item.pluFlag || 'E',
            itemHSN: item.itemHSN,
            qtyMux: item.qtyMux || '',
            gstctype: item.gstctype || 1,
            baseAmnt: item.baseAmnt || item.price || 0,
            status: item.status || 'success',
            scflag: item.scflag || 0,
            scantype: item.scantype || 'MANUAL',
            remainingqty: item.remainingqty || '0',
            size: item.size || '',
          }),
        );
        console.log(
          'PRODUCT SEARCH MAPPED PRODUCTS:',
          mappedProducts.slice(0, 10).map((p: Product) => ({
          id: p.id,
          name: p.name,
          remainingqty: p.remainingqty,
          price: p.price,
          })),
        );
        setSuggestions(mappedProducts.slice(0, 10));
        setShowSuggestions(true);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    } catch (error) {
      console.error('Error searching products:', error);
      setSuggestions([]);
      setShowSuggestions(false);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (text: string) => {
    setSearchTerm(text);
  };

  const handleSuggestionClick = (product: Product) => {
    // Check if product is out of stock
    const availableQty = Number(product.remainingqty) || 0;
    if (availableQty <= 0) {
      Alert.alert('Out of stock', 'Product is out of stock');
      return;
    }

    const existingCartItem = cartItems.find(
      item => item.id === product.id,
    );
    const currentCartQty = existingCartItem
      ? existingCartItem.quantity
      : 0;
    const newQty = currentCartQty + 1;

    if (newQty > availableQty) {
      Alert.alert(
        'Stock limit',
        `Only ${availableQty} items available in stock`,
      );
      return;
    }

    const cartItem = {
      deptNmbr: product.deptNmbr || "0",
      skucounter: product.skucounter || 0,
      qtyunit: product.unit || "Kg",
      netPrice: product.price,
      MRP: product.originalPrice,
      vatbit: product.vatbit || "00000000000000000000000000000000",
      productgrpnmbr: product.productgrpnmbr || 0,
      pluFlag: product.pluFlag || "E",
      itemHSN: product.itemHSN,
      qtyMux: product.qtyMux || "",
      gstctype: product.gstctype || 1,
      baseAmnt: product.baseAmnt || product.price || 0,
      name: product.name,
      id: product.id,
      scflag: product.scflag || 0,
      sku: product.sku || product.id,
      status: product.status || "success",
      quantity: 1,
      scantype: product.scantype || "MANUAL",
      remainingqty: product.remainingqty || "0",
      imageUrl: product.image || '',
      plulink: product.image || '',
    };
    onAddToCart(cartItem, 1);
    setSearchTerm('');
    setSuggestions([]);
    setShowSuggestions(false);
  };

  return (
    <View style={styles.container}>
      {showSuggestions && suggestions.length > 0 && (
        <Pressable
          style={styles.suggestionsOutsideOverlay}
          onPress={() => setShowSuggestions(false)}
        />
      )}
      <View style={styles.searchBarContainer}>
        <View style={styles.searchInputWrapper}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            value={searchTerm}
            placeholder="Search for products..."
            onChangeText={handleSearchChange}
            onFocus={() => {
              if (suggestions.length > 0) {
                setShowSuggestions(true);
              }
            }}
            style={styles.searchInput}
            placeholderTextColor="#9ca3af"
          />
        </View>
      </View>

      {(onScanPress || onAddProductPress) && (
        <View style={styles.actionButtonsRow}>
          {/* Scan Button */}
          {onScanPress && (
            <Pressable onPress={onScanPress} style={styles.scanButton}>
              <Icon name="qr-code-scanner" size={18} color="#FFAF0F" />
              <Text style={styles.scanText}>Scan</Text>
            </Pressable>
          )}
          {/* Add Product Button */}
          {onAddProductPress && (
            <Pressable
              onPress={onAddProductPress}
              style={styles.addButton}
            >
              <Icon name="add" size={18} color="#0064C2" />
              <Text style={styles.addText}>Add</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Suggestions */}
      {showSuggestions && suggestions.length > 0 && (
        <View style={styles.suggestionsContainer}>
          {loading && (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color="#0064c2" />
              <Text style={styles.loadingText}>Searching...</Text>
            </View>
          )}
          {!loading && (
            <ScrollView keyboardShouldPersistTaps="handled">
              {suggestions.map(product => {
                const availableQty =
                  Number(product.remainingqty) || 0;
                const isOutOfStock = availableQty <= 0;
                const imageUri =
                  product.image && product.image !== '/window.svg'
                    ? product.image
                    : undefined;

                return (
                  <Pressable
                    key={product.id}
                    onPress={() => {
                      if (!isOutOfStock) {
                        handleSuggestionClick(product);
                      }
                    }}
                    style={[
                      styles.suggestionRow,
                      isOutOfStock && styles.suggestionRowDisabled,
                    ]}
                  >
                    <View style={styles.suggestionImageWrapper}>
                      {imageUri ? (
                        <Image
                          source={{ uri: imageUri }}
                          style={styles.suggestionImage}
                          resizeMode="cover"
                        />
                      ) : (
                        <View
                          style={styles.suggestionImagePlaceholder}
                        >
                          <Text
                            style={
                              styles.suggestionImagePlaceholderText
                            }
                          >
                            {String(
                              product.name || '?',
                            ).charAt(0)}
                          </Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.suggestionTextWrapper}>
                      <Text
                        style={styles.suggestionName}
                        numberOfLines={1}
                      >
                        {product.name}
                      </Text>
                      <View style={styles.priceRow}>
                        <Text style={styles.priceText}>
                          ₹
                          {product.price?.toFixed(2) ?? '0.00'}
                        </Text>
                        {product.originalPrice > product.price && (
                          <Text style={styles.originalPriceText}>
                            ₹
                            {product.originalPrice?.toFixed(2) ??
                              ''}
                          </Text>
                        )}
                        {product.discount ? (
                          <View style={styles.discountBadge}>
                            <Text style={styles.discountBadgeText}>
                              {product.discount}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      <View style={styles.metaRow}>
                        <Text style={styles.metaText}>
                          Qty: {availableQty}
                        </Text>
                        {product.unit ? (
                          <Text style={styles.metaText}>
                            • {product.unit}
                          </Text>
                        ) : null}
                        {product.size ? (
                          <Text style={styles.metaText}>
                            • Size: {product.size}
                          </Text>
                        ) : null}
                      </View>
                      {isOutOfStock && (
                        <Text style={styles.outOfStockText}>
                          Out of Stock
                        </Text>
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </View>
      )}

      {/* Barcode search results (kept for parity, but without scanner UI) */}
      {barcodeValue && barcodeResults.length > 0 && (
        <View style={styles.barcodeSection}>
          <View style={styles.barcodeHeader}>
            <View style={styles.barcodeHeaderLeft}>
              <Text style={styles.barcodeIcon}>🔍</Text>
              <Text style={styles.barcodeTitle}>
                Barcode Search Results
              </Text>
              <View style={styles.barcodeBadge}>
                <Text style={styles.barcodeBadgeText}>
                  "{barcodeValue}"
                </Text>
              </View>
            </View>
            <Text style={styles.barcodeCount}>
              {barcodeResults.length} item
              {barcodeResults.length > 1 ? 's' : ''}
            </Text>
          </View>

          <View style={styles.barcodeList}>
            {barcodeResults.map(product => {
              const quantity =
                cartItems.find(
                  item => item.id === product.id,
                )?.quantity || 0;
              const imageUri =
                product.image && product.image !== '/window.svg'
                  ? product.image
                  : undefined;

              return (
                <View
                  key={product.id}
                  style={styles.barcodeRow}
                >
                  <View style={styles.barcodeImageWrapper}>
                    {imageUri ? (
                      <Image
                        source={{ uri: imageUri }}
                        style={styles.barcodeImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <View
                        style={styles.barcodeImagePlaceholder}
                      >
                        <Text
                          style={
                            styles.barcodeImagePlaceholderText
                          }
                        >
                          {String(product.name || '?').charAt(0)}
                        </Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.barcodeTextWrapper}>
                    <Text
                      style={styles.barcodeName}
                      numberOfLines={1}
                    >
                      {product.name}
                    </Text>
                    <View style={styles.priceRow}>
                      <Text style={styles.priceText}>
                        ₹
                        {product.price?.toFixed(2) ?? '0.00'}
                      </Text>
                      {product.originalPrice > product.price && (
                        <Text style={styles.originalPriceText}>
                          ₹
                          {product.originalPrice?.toFixed(2) ??
                            ''}
                        </Text>
                      )}
                      {product.discount ? (
                        <View style={styles.discountBadge}>
                          <Text style={styles.discountBadgeText}>
                            {product.discount}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.barcodeUnitText}>
                      {product.unit || '-'}
                    </Text>
                  </View>
                  <View style={styles.barcodeActions}>
                    {quantity === 0 ? (
                      <Pressable
                        style={styles.barcodeAddButton}
                        onPress={() => handleSuggestionClick(product)}
                      >
                        <Text style={styles.barcodeAddButtonText}>
                          + Add
                        </Text>
                      </Pressable>
                    ) : (
                      <View style={styles.qtyControl}>
                        <Pressable
                          style={[
                            styles.qtyButton,
                            styles.qtyButtonLeft,
                          ]}
                          onPress={() =>
                            onUpdateQuantity(
                              product.id,
                              quantity - 1,
                            )
                          }
                        >
                          <Text style={styles.qtyButtonText}>
                            -
                          </Text>
                        </Pressable>
                        <View
                          style={styles.qtyValueWrapper}
                        >
                          <Text style={styles.qtyValueText}>
                            {quantity}
                          </Text>
                        </View>
                        <Pressable
                          style={[
                            styles.qtyButton,
                            styles.qtyButtonRight,
                          ]}
                          onPress={() =>
                            handleSuggestionClick(product)
                          }
                        >
                          <Text style={styles.qtyButtonText}>
                            +
                          </Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    position: 'relative',
  },
  searchBarContainer: {
    width: '100%',
    marginTop: 8,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    marginTop: 10,
    gap: 10,
  },
  searchIcon: {
    fontSize: 16,
    color: '#9ca3af',
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
    paddingVertical: 2,
  },
  suggestionsContainer: {
    marginTop: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    maxHeight: 280,
    zIndex: 10,
    elevation: 10,
  },
  suggestionsOutsideOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    zIndex: 5,
    elevation: 5,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 13,
    color: '#6b7280',
  },
  suggestionRow: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  suggestionRowDisabled: {
    opacity: 0.6,
  },
  suggestionImageWrapper: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    overflow: 'hidden',
    marginRight: 8,
  },
  suggestionImage: {
    width: '100%',
    height: '100%',
  },
  suggestionImagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionImagePlaceholderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9ca3af',
  },
  suggestionTextWrapper: {
    flex: 1,
    minWidth: 0,
  },
  suggestionName: {
    fontSize: 13,
    fontWeight: '500',
    color: '#111827',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  priceText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
    marginRight: 4,
  },
  originalPriceText: {
    fontSize: 11,
    color: '#9ca3af',
    textDecorationLine: 'line-through',
    marginRight: 4,
  },
  discountBadge: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#ffaf0f',
  },
  discountBadgeText: {
    fontSize: 10,
    color: '#ffffff',
    fontWeight: '600',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 2,
  },
  metaText: {
    fontSize: 11,
    color: '#6b7280',
    marginRight: 4,
  },
  outOfStockText: {
    marginTop: 2,
    fontSize: 11,
    color: '#dc2626',
    fontWeight: '500',
  },
  barcodeSection: {
    marginTop: 12,
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    backgroundColor: '#ffffff',
  },
  barcodeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  barcodeHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  barcodeIcon: {
    fontSize: 16,
    color: '#0064c2',
    marginRight: 6,
  },
  barcodeTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginRight: 6,
  },
  barcodeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: '#f3f4f6',
  },
  barcodeBadgeText: {
    fontSize: 11,
    color: '#6b7280',
  },
  barcodeCount: {
    fontSize: 12,
    color: '#6b7280',
  },
  barcodeList: {
    marginTop: 4,
  },
  barcodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 6,
  },
  barcodeImageWrapper: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: '#e5e7eb',
    overflow: 'hidden',
    marginRight: 8,
  },
  barcodeImage: {
    width: '100%',
    height: '100%',
  },
  barcodeImagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  barcodeImagePlaceholderText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#9ca3af',
  },
  barcodeTextWrapper: {
    flex: 1,
    minWidth: 0,
  },
  barcodeName: {
    fontSize: 13,
    fontWeight: '500',
    color: '#111827',
  },
  barcodeUnitText: {
    marginTop: 2,
    fontSize: 11,
    color: '#6b7280',
  },
  barcodeActions: {
    marginLeft: 8,
    alignItems: 'flex-end',
  },
  barcodeAddButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#0064c2',
  },
  barcodeAddButtonText: {
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
    paddingVertical: 4,
  },
  qtyButtonLeft: {},
  qtyButtonRight: {},
  qtyButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  qtyValueWrapper: {
    minWidth: 32,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  qtyValueText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  scanButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255,175,15,0.10)',
    gap: 8,
  },
  scanText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '500',
  },
  addButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(0,100,194,0.05)',
    gap: 8,
  },
  addText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '500',
  },
});

