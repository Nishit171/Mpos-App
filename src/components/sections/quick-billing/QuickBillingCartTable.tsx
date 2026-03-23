import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  Pressable,
  TextInput,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { BASE_URL } from '../../../services/constants/config';

interface QuickBillingCartTableProps {
  cartItems: any[];
  onUpdateQuantity: (id: string | number, quantity: number) => void;
  onUpdatePrice: (id: string | number, newPrice: number) => void;
  onRemoveFromCart: (id: string | number) => void;
  onClearCart: () => void;
}

export default function QuickBillingCartTable({
  cartItems,
  onUpdateQuantity,
  onUpdatePrice,
  onRemoveFromCart,
  onClearCart,
}: QuickBillingCartTableProps) {
  const [editingPriceId, setEditingPriceId] = useState<string | number | null>(
    null,
  );
  const [editingPriceValue, setEditingPriceValue] = useState('');

  const getEffectivePrice = (item: any) => {
    return Number(item?.netPrice) || 0;
  };

  const resolveImageUrl = (item: any) => {
    const rawUrl = item?.imageUrl || item?.plulink || '';
    if (!rawUrl || rawUrl === '/window.svg') return '';
    if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
      return rawUrl;
    }
    if (rawUrl.startsWith('/')) {
      return `${BASE_URL}${rawUrl}`;
    }
    return `${BASE_URL}/${rawUrl}`;
  };

  const beginPriceEdit = (item: any) => {
    setEditingPriceId(item.id);
    setEditingPriceValue(getEffectivePrice(item).toFixed(2));
  };

  const commitPriceEdit = (item: any) => {
    if (editingPriceId !== item.id) return;
    const parsedPrice = Number(editingPriceValue);
    if (!Number.isNaN(parsedPrice) && parsedPrice >= 0) {
      onUpdatePrice(item.id, parsedPrice);
    }
    setEditingPriceId(null);
    setEditingPriceValue('');
  };

  const totalItems = cartItems.reduce(
    (sum, item) => sum + (item.quantity || 0),
    0,
  );
  const subtotal = cartItems.reduce(
    (sum, item) => sum + getEffectivePrice(item) * (item.quantity || 0),
    0,
  );

  if (!cartItems || cartItems.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconCircle}>
          <Text style={styles.emptyIconText}>🛒</Text>
        </View>
        <Text style={styles.emptyTitle}>Your cart is empty</Text>
        <Text style={styles.emptySubtitle}>Add products to get started</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerIcon}>🛒</Text>
          <Text style={styles.headerTitle}>Shopping Cart</Text>
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>
              {totalItems} {totalItems === 1 ? 'item' : 'items'}
            </Text>
          </View>
        </View>
        <Pressable onPress={onClearCart} style={styles.clearButton}>
          <Text style={styles.clearButtonText}>Clear All</Text>
        </Pressable>
      </View>

      <FlatList
        data={cartItems}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={styles.listContent}
        scrollEnabled={false}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => {
          const lineTotal = getEffectivePrice(item) * (item.quantity || 0);
          const imageUri = resolveImageUrl(item) || undefined;
          const isEditingPrice = editingPriceId === item.id;

          return (
            <View style={styles.itemCard}>
              {/* Main row: image, name, price/edit/unit, qty stepper on right */}
              <View style={styles.mainRow}>
                <View style={styles.leftColumn}>
                  <View style={styles.productImageWrapper}>
                    {imageUri ? (
                      <Image
                        source={{ uri: imageUri }}
                        style={styles.productImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.productImagePlaceholder}>
                        <Text style={styles.productImagePlaceholderText}>
                          {String(item.name || '?').charAt(0)}
                        </Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.textColumn}>
                    <Text style={styles.productName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <View style={styles.priceLine}>
                      {isEditingPrice ? (
                        <TextInput
                          style={styles.priceInput}
                          value={editingPriceValue}
                          onChangeText={value =>
                            setEditingPriceValue(
                              value
                                .replace(/[^0-9.]/g, '')
                                .replace(/(\..*)\./g, '$1'),
                            )
                          }
                          keyboardType="decimal-pad"
                          returnKeyType="done"
                          autoFocus
                          onSubmitEditing={() => commitPriceEdit(item)}
                          onBlur={() => commitPriceEdit(item)}
                        />
                      ) : (
                        <>
                          <Text style={styles.priceText}>
                            ₹{getEffectivePrice(item).toFixed(2)}
                          </Text>
                          <Pressable
                            onPress={() => beginPriceEdit(item)}
                            style={styles.pencilButton}
                          >
                            <Icon name="edit" size={14} color="#6b7280" />
                          </Pressable>
                          <Text style={styles.unitText}>
                            {item.qtyunit || '-'}
                          </Text>
                        </>
                      )}
                    </View>
                  </View>
                </View>

                <View style={styles.qtyControl}>
                  <Pressable
                    onPress={() => {
                      if ((item.quantity || 0) <= 1) {
                        onRemoveFromCart(item.id);
                      } else {
                        onUpdateQuantity(item.id, (item.quantity || 0) - 1);
                      }
                    }}
                    style={styles.qtyButton}
                  >
                    <Text style={styles.qtyButtonText}>-</Text>
                  </Pressable>
                  <View style={styles.qtyValueWrapper}>
                    <Text style={styles.qtyValueText}>{item.quantity}</Text>
                  </View>
                  <Pressable
                    onPress={() =>
                      onUpdateQuantity(item.id, (item.quantity || 0) + 1)
                    }
                    style={styles.qtyButton}
                  >
                    <Text style={styles.qtyButtonText}>+</Text>
                  </Pressable>
                </View>
              </View>

              {/* Total + Delete row */}
              <View style={styles.bottomRow}>
                <Text style={styles.lineTotalText}>
                  Total: ₹{lineTotal.toFixed(2)}
                </Text>
                <Pressable
                  onPress={() => onRemoveFromCart(item.id)}
                  style={styles.removeButton}
                >
                  <Icon name="delete-outline" size={18} color="#ef4444" />
                </Pressable>
              </View>
            </View>
          );
        }}
      />

      {/* Footer Summary */}
      <View style={styles.footer}>
        <Text style={styles.footerLabel}>Subtotal:</Text>
        <Text style={styles.footerValue}>
          ₹{subtotal.toFixed(2)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb', // gray-200
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#f9fafb', // gray-50
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    fontSize: 14,
    marginRight: 4,
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
    marginRight: 6,
  },
  headerBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: '#e5e7eb',
  },
  headerBadgeText: {
    fontSize: 11,
    color: '#6b7280',
  },
  clearButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  clearButtonText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#dc2626',
  },
  listContent: {
    paddingHorizontal: 0,
    paddingVertical: 4,
  },
  itemCard: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#ffffff',
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  leftColumn: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  productImageWrapper: {
    width: 36,
    height: 36,
    borderRadius: 6,
    backgroundColor: '#f3f4f6',
    overflow: 'hidden',
    marginRight: 10,
  },
  productName: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '500',
    color: '#111827',
  },
  textColumn: {
    flex: 1,
  },
  priceLine: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  priceText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  pencilButton: {
    padding: 4,
  },
  priceInput: {
    minWidth: 90,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
    backgroundColor: '#ffffff',
  },
  unitText: {
    fontSize: 12,
    color: '#6b7280',
    marginLeft: 6,
  },
  qtyControl: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0064C2',
    borderRadius: 6,
    overflow: 'hidden',
    height: 28,
  },
  qtyButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  qtyValueWrapper: {
    minWidth: 32,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  qtyValueText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  bottomRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lineTotalText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0064C2',
  },
  removeButton: {
    padding: 4,
    borderRadius: 999,
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  productImagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productImagePlaceholderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9ca3af',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  footerLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#374151',
  },
  footerValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  emptyContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyIconText: {
    fontSize: 28,
    color: '#9ca3af',
  },
  emptyTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6b7280',
  },
  emptySubtitle: {
    marginTop: 4,
    fontSize: 11,
    color: '#9ca3af',
  },
});

