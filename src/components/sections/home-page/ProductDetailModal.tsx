import React from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  Image,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useCart } from '../../../context/cart-context';

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
  description?: string;
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
  scflag?: number;
  status?: string;
  scantype?: string;
  remainingqty?: string;
}

interface ProductDetailModalProps {
  open: boolean;
  product: Product | null;
  onClose: () => void;
  onAddToCart: (product: any, quantity?: number) => void;
  onUpdateQuantity?: (id: string | number, quantity: number) => void;
  onRemoveFromCart?: (id: string | number) => void;
}

export default function ProductDetailModal({
  open,
  product,
  onClose,
  onAddToCart,
  onUpdateQuantity,
  onRemoveFromCart,
}: ProductDetailModalProps) {
  const { cart } = useCart();

  if (!open || !product) return null;

  const getItemQuantity = (itemId: string) => {
    const item = cart.find((item: any) => item.id === itemId);
    return item ? item.quantity : 0;
  };

  const quantity = getItemQuantity(product.id);

  const handleAddToCart = () => {
    const cartItem = {
      deptNmbr: product.deptNmbr || '0',
      skucounter: product.skucounter || 0,
      qtyunit: product.unit || 'Kg',
      netPrice: product.price,
      MRP: product.originalPrice,
      vatbit: product.vatbit || '00000000000000000000000000000000',
      productgrpnmbr: product.productgrpnmbr || 0,
      pluFlag: product.pluFlag || 'E',
      itemHSN: product.itemHSN || 1221,
      qtyMux: product.qtyMux || '',
      gstctype: product.gstctype || 1,
      baseAmnt: product.baseAmnt || product.price || 0,
      name: product.name,
      id: product.id,
      scflag: product.scflag || 0,
      sku: product.sku || product.id,
      status: product.status || 'success',
      quantity: 1,
      scantype: product.scantype || 'MANUAL',
      imageUrl: product.image || '',
      plulink: product.image || '',
    };
    onAddToCart(cartItem, 1);
  };

  const handleIncreaseQuantity = () => {
    if (quantity === 0) {
      handleAddToCart();
    } else if (onUpdateQuantity) {
      onUpdateQuantity(product.id, quantity + 1);
    }
  };

  const handleDecreaseQuantity = () => {
    if (quantity > 1 && onUpdateQuantity) {
      onUpdateQuantity(product.id, quantity - 1);
    } else if (onRemoveFromCart) {
      onRemoveFromCart(product.id);
    }
  };

  const discountPercentage =
    product.originalPrice > product.price
      ? Math.round(
          ((product.originalPrice - product.price) / product.originalPrice) * 100,
        )
      : 0;

  const imageSource =
    product.image && product.image !== '/window.svg'
      ? { uri: product.image }
      : FALLBACK_IMAGE;

  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.modal} onPress={e => e.stopPropagation()}>
          {/* Close Button */}
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Icon name="close" size={20} color="#6b7280" />
          </Pressable>

          {/* Scrollable Content */}
          <ScrollView
            style={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Product Image */}
            <View style={styles.imageContainer}>
              {discountPercentage > 0 && (
                <View style={styles.discountBadge}>
                  <Text style={styles.discountBadgeText}>
                    {discountPercentage}% OFF
                  </Text>
                </View>
              )}
              <Image source={imageSource} style={styles.productImage} resizeMode="contain" />
            </View>

            {/* Product Details */}
            <View style={styles.detailsContainer}>
              {/* Header */}
              <View style={styles.header}>
                <Text style={styles.productName} numberOfLines={2}>
                  {product.name}
                </Text>
                <Pressable style={styles.favoriteButton}>
                  <Icon name="favorite-border" size={20} color="#9ca3af" />
                </Pressable>
              </View>

              {/* Price Section */}
              <View style={styles.priceSection}>
                <View style={styles.priceRow}>
                  <Text style={styles.priceText}>
                    ₹{product.price?.toFixed(2)}
                  </Text>
                  {product.originalPrice > product.price && (
                    <Text style={styles.originalPriceText}>
                      ₹{product.originalPrice?.toFixed(2)}
                    </Text>
                  )}
                </View>
                <Text style={styles.unitText}>
                  Unit: <Text style={styles.unitValue}>{product.unit || '-'}</Text>
                </Text>
              </View>

              {/* Description */}
              {product.description && (
                <Text style={styles.description} numberOfLines={3}>
                  {product.description}
                </Text>
              )}

              {/* Quantity Controls */}
              <View style={styles.quantitySection}>
                {quantity === 0 ? (
                  <Pressable
                    onPress={handleAddToCart}
                    disabled={product.remainingqty === '0'}
                    style={[
                      styles.addToCartButton,
                      product.remainingqty === '0' && styles.addToCartButtonDisabled,
                    ]}
                  >
                    <Icon name="shopping-cart" size={18} color="#ffffff" />
                    <Text style={styles.addToCartText}>Add to Cart</Text>
                  </Pressable>
                ) : (
                  <View style={styles.quantityControl}>
                    <Pressable
                      onPress={handleDecreaseQuantity}
                      style={styles.qtyButton}
                    >
                      <Icon name="remove" size={20} color="#ffffff" />
                    </Pressable>
                    <Text style={styles.qtyValue}>{quantity}</Text>
                    <Pressable
                      onPress={handleIncreaseQuantity}
                      style={styles.qtyButton}
                    >
                      <Icon name="add" size={20} color="#ffffff" />
                    </Pressable>
                  </View>
                )}
              </View>
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
  },
  modal: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 600,
    maxHeight: '95%',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 20,
    padding: 6,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
  },
  scrollContent: {
    flex: 1,
  },
  imageContainer: {
    width: '100%',
    height: 200,
    backgroundColor: '#f9fafb',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  discountBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    zIndex: 10,
    backgroundColor: '#ffaf0f',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  discountBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  productImage: {
    width: '100%',
    height: '100%',
    padding: 12,
  },
  detailsContainer: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 12,
  },
  productName: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    lineHeight: 28,
  },
  favoriteButton: {
    padding: 4,
    borderRadius: 20,
  },
  priceSection: {
    marginBottom: 12,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
    gap: 8,
  },
  priceText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#033c70',
  },
  originalPriceText: {
    fontSize: 14,
    color: '#94a3b8',
    textDecorationLine: 'line-through',
  },
  unitText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748b',
  },
  unitValue: {
    color: '#111827',
    fontWeight: '600',
  },
  description: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    marginBottom: 16,
  },
  quantitySection: {
    marginTop: 'auto',
    paddingTop: 16,
  },
  addToCartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0064c2',
    borderRadius: 8,
    paddingVertical: 12,
    shadowColor: '#0064c2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  addToCartButtonDisabled: {
    opacity: 0.5,
  },
  addToCartText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0064c2',
    borderRadius: 8,
    overflow: 'hidden',
    shadowColor: '#0064c2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  qtyButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    paddingHorizontal: 16,
    minWidth: 50,
    textAlign: 'center',
  },
});
