import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { v4 as uuidv4 } from 'uuid';

import QuickBillingSearchBar from './QuickBillingSearchBar';
import QuickBillingCartTable from './QuickBillingCartTable';
import QuickBillingCheckout, { PaymentMethodData } from './QuickBillingCheckout';
import QuickBillingCustomerInfo from './QuickBillingCustomerInfo';
import Header from '../home-page/Header';
import Footer from '../home-page/Footer';
import BarcodeDialog from '../home-page/BarcodeDialog';
import QuickBillingAddProductDialog from './QuickBillingAddProductDialog';
import { useCart } from '../../../context/cart-context';
import { useAuth } from '../../../context/auth-context';
import { refreshCart } from '../../../services/api/orderService';
import {
  getAllHoldBills,
  getHoldOrderDetails,
  removeHoldOrder,
  smartSaveHoldOrder,
} from '../../../services/api/holdOrderService';

type BillType = 'taxInvoice' | 'invoice';

type Product = {
  id: string;
  name: string;
  price: number;
  originalPrice: number;
  discount: string;
  image: string;
  unit: string;
  category: string;
  description?: string;
};

type Order = {
  id: string;
  name: string;
  phone: string;
};

type OrderWithCart = Order & {
  cart: any[];
  selectedCategory: string | null;
  holdOrderId?: number;
};

interface QuickBillingHomePageProps {
  hideHeader?: boolean;
  onBackClick?: () => void;
}

interface OrderTabsBarProps {
  orders: OrderWithCart[];
  activeOrderId: string;
  onAddOrder: () => void;
  onRemoveOrder: (id: string) => void;
  onSwitchOrder: (id: string) => void;
  loadingTabAction: boolean;
}

const OrderTabsBar: React.FC<OrderTabsBarProps> = ({
  orders,
  activeOrderId,
  onAddOrder,
  onRemoveOrder,
  onSwitchOrder,
  loadingTabAction,
}) => {
  return (
    <View style={styles.tabsContainer}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsScrollContent}
      >
        {orders.map((order, index) => {
          const isActive = order.id === activeOrderId;
          const label = order.name || `Order ${index + 1}`;
          return (
            <View
              key={order.id}
              style={[styles.tabItem, isActive && styles.tabItemActive]}
            >
              <Pressable
                onPress={() => onSwitchOrder(order.id)}
                style={styles.tabPressable}
              >
                <Text
                  style={[styles.tabText, isActive && styles.tabTextActive]}
                  numberOfLines={1}
                >
                  {label}
                </Text>
              </Pressable>
              {orders.length > 1 && (
                <Pressable
                  onPress={() => onRemoveOrder(order.id)}
                  style={styles.tabCloseButton}
                >
                  <Text style={styles.tabCloseText}>×</Text>
                </Pressable>
              )}
            </View>
          );
        })}
        <Pressable
          onPress={onAddOrder}
          disabled={loadingTabAction}
          style={[styles.addTabButton, loadingTabAction && styles.addTabButtonDisabled]}
        >
          <Text style={styles.addTabButtonText}>+ New</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
};

export default function QuickBillingHomePage(
  props: QuickBillingHomePageProps = {},
) {
  const { hideHeader = false } = props; // kept for API compatibility, not used in RN layout

  const [orders, setOrders] = useState<OrderWithCart[]>([]);
  const [activeOrderId, setActiveOrderId] = useState<string>('');
  const { setCart, cart, cartLoaded } = useCart();
  const [refreshedCart, setRefreshedCart] = useState<any>(null);
  const [loadingTabAction, setLoadingTabAction] = useState(false);
  const [isRefreshingCart, setIsRefreshingCart] = useState(false);

  // Shared payment state
  const [selectedPaymentMethods, setSelectedPaymentMethods] = useState<
    PaymentMethodData[]
  >([]);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [paymentResponse, setPaymentResponse] = useState<any>(null);

  const [billType, setBillType] = useState<BillType>('taxInvoice');
  const [showBarcodeDialog, setShowBarcodeDialog] = useState(false);
  const [showAddProductDialog, setShowAddProductDialog] = useState(false);
  const { user, logout } = useAuth();

  // Load billType from AsyncStorage on mount
  useEffect(() => {
    const loadBillType = async () => {
      try {
        const saved = await AsyncStorage.getItem('quickBilling_billType');
        if (saved === 'invoice' || saved === 'taxInvoice') {
          setBillType(saved);
        }
      } catch (error) {
        console.warn('Failed to load bill type from storage', error);
      }
    };
    loadBillType();
  }, []);

  // Persist billType in AsyncStorage
  useEffect(() => {
    AsyncStorage.setItem('quickBilling_billType', billType).catch(error => {
      console.warn('Failed to save bill type to storage', error);
    });
  }, [billType]);

  // On mount, load orders from backend or create default
  useEffect(() => {
    if (!cartLoaded) return;

    async function fetchHoldOrders() {
      try {
        const bills = await getAllHoldBills();
        if (bills && bills.length > 0) {
          const ordersWithDetails = await Promise.all(
            bills.map(async (bill: { id: number; billReference: string }) => {
              const details = await getHoldOrderDetails({
                holdOrderId: bill.id,
                billReference: bill.billReference,
              });
              return {
                id: bill.id.toString(),
                name: bill.billReference,
                phone: '',
                cart: details?.cartItem || [],
                selectedCategory: null,
                holdOrderId: bill.id,
              } as OrderWithCart;
            }),
          );
          setOrders(ordersWithDetails);
          setActiveOrderId(ordersWithDetails[0].id);
          setCart(ordersWithDetails[0].cart || []);
        } else {
          // Use current cart state, but don't include cart in deps to avoid loop
          const currentCart = cart;
          const newOrder: OrderWithCart = {
            id: uuidv4(),
            name: '',
            phone: '',
            cart: currentCart,
            selectedCategory: null,
          };
          setOrders([newOrder]);
          setActiveOrderId(newOrder.id);
        }
      } catch (err) {
        // Use current cart state, but don't include cart in deps to avoid loop
        const currentCart = cart;
        const newOrder: OrderWithCart = {
          id: uuidv4(),
          name: '',
          phone: '',
          cart: currentCart,
          selectedCategory: null,
        };
        setOrders([newOrder]);
        setActiveOrderId(newOrder.id);
      }
    }

    fetchHoldOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartLoaded]); // Removed cart and setCart from deps to prevent infinite loop

  // Persist orders in AsyncStorage (for potential future use)
  useEffect(() => {
    if (orders.length > 0) {
      AsyncStorage.setItem('pos_orders', JSON.stringify(orders)).catch(
        error => {
          console.warn('Failed to save orders to storage', error);
        },
      );
    }
  }, [orders]);

  // Ensure activeOrderId is always valid
  useEffect(() => {
    if (
      orders.length > 0 &&
      !orders.find((o: OrderWithCart) => o.id === activeOrderId)
    ) {
      setActiveOrderId(orders[0].id);
    }
  }, [orders, activeOrderId]);

  const activeOrder = orders.find(
    (o: OrderWithCart) => o.id === activeOrderId,
  );

  // Tab switch: always update or create hold order by name, then switch
  const handleSwitchOrder = async (id: string) => {
    if (loadingTabAction) return;
    setLoadingTabAction(true);

    const currentOrder = orders.find(o => o.id === activeOrderId);

    if (currentOrder && currentOrder.cart && currentOrder.cart.length > 0) {
      const billReference =
        currentOrder.name || `Order ${orders.indexOf(currentOrder) + 1}`;
      try {
        const saveResponse = await smartSaveHoldOrder({
          billReference,
          cartItem: currentOrder.cart,
        });
        setOrders(prev =>
          prev.map(o =>
            o.id === activeOrderId
              ? { ...o, holdOrderId: saveResponse.holdOrderId }
              : o,
          ),
        );
      } catch (err) {
        console.error('Failed to save current order before switching:', err);
      }
    }

    setActiveOrderId(id);

    const targetOrder = orders.find(o => o.id === id);
    if (targetOrder && targetOrder.holdOrderId) {
      try {
        const details = await getHoldOrderDetails({
          holdOrderId: targetOrder.holdOrderId,
          billReference: targetOrder.name,
        });
        if (details && details.cartItem) {
          setOrders(prev =>
            prev.map(o =>
              o.id === id ? { ...o, cart: details.cartItem } : o,
            ),
          );
          setCart(details.cartItem);
        } else {
          setCart([]);
        }
      } catch (err) {
        console.error('Failed to fetch order details:', err);
        setCart([]);
      }
    } else {
      setCart([]);
    }

    setLoadingTabAction(false);
  };

  // Add tab: always update or create hold order by name, then add new tab
  const handleAddOrder = async () => {
    if (loadingTabAction) return;
    setLoadingTabAction(true);

    const currentOrder = orders.find(o => o.id === activeOrderId);

    try {
      if (currentOrder && currentOrder.cart && currentOrder.cart.length > 0) {
        const billReference =
          currentOrder.name || `Order ${orders.indexOf(currentOrder) + 1}`;
        const saveResponse = await smartSaveHoldOrder({
          billReference,
          cartItem: currentOrder.cart,
        });
        setOrders(prev =>
          prev.map(o =>
            o.id === activeOrderId
              ? { ...o, holdOrderId: saveResponse.holdOrderId }
              : o,
          ),
        );
        setOrders(prev =>
          prev.map(o =>
            o.id === activeOrderId ? { ...o, cart: [] } : o,
          ),
        );
      }
      const newOrder: OrderWithCart = {
        id: uuidv4(),
        name: '',
        phone: '',
        cart: [],
        selectedCategory: null,
      };
      setOrders([...orders, newOrder]);
      setActiveOrderId(newOrder.id);
      setCart([]);
    } catch (error) {
      console.error('Error adding new order:', error);
    } finally {
      setLoadingTabAction(false);
    }
  };

  // Product add/remove/qty change: only update local state
  const updateActiveOrderCartItem = (id: string | number, quantity: number) => {
    setOrders(prev =>
      prev.map(o => {
        if (o.id === activeOrderId) {
          const item = o.cart.find((item: any) => item.id === id);
          if (item) {
            // Check if item has remainingqty and validate
            const availableQty = Number(item.remainingqty) || 0;
            if (availableQty > 0 && quantity > availableQty) {
              Alert.alert('Quantity exceeded', 'Quantity KHATAM ho gyi he');
              return o; // Don't update if exceeds available quantity
            }
          }
          const updatedCart = o.cart.map((item: any) =>
            item.id === id
              ? { ...item, quantity: Math.max(1, quantity) }
              : item,
          );
          const updatedOrder = { ...o, cart: updatedCart };
          if (o.id === activeOrderId) {
            setCart(updatedCart);
          }
          return updatedOrder;
        }
        return o;
      }),
    );
  };

  const updateActiveOrderItemPrice = (
    id: string | number,
    newPrice: number,
  ) => {
    setOrders(prev =>
      prev.map(o => {
        if (o.id !== activeOrderId) return o;
        const updatedCart = o.cart.map((item: any) =>
          item.id === id
            ? { ...item, netPrice: newPrice, priceEdited: true }
            : item,
        );
        setCart(updatedCart);
        return { ...o, cart: updatedCart };
      }),
    );
  };

  const removeFromActiveOrderCart = (id: string | number) => {
    setOrders(prev =>
      prev.map(o => {
        if (o.id === activeOrderId) {
          const updatedCart = o.cart.filter((item: any) => item.id !== id);
          const updatedOrder = { ...o, cart: updatedCart };
          if (o.id === activeOrderId) {
            setCart(updatedCart);
          }
          return updatedOrder;
        }
        return o;
      }),
    );
  };

  const addToActiveOrderCart = (product: any, quantity: number = 1) => {
    setOrders(prev =>
      prev.map(o => {
        if (o.id === activeOrderId) {
          const existingItem = o.cart.find(
            (item: any) => item.id === product.id,
          );
          let updatedCart;
          if (existingItem) {
            // Check if adding would exceed available quantity
            const availableQty =
              Number(existingItem.remainingqty) ||
              Number(product.remainingqty) ||
              0;
            const newQty = existingItem.quantity + quantity;
            if (availableQty > 0 && newQty > availableQty) {
              Alert.alert('Quantity exceeded', 'Quantity KHATAM ho gyi he');
              return o; // Don't update if exceeds available quantity
            }
            updatedCart = o.cart.map((item: any) =>
              item.id === product.id
                ? { ...item, quantity: item.quantity + quantity }
                : item,
            );
          } else {
            // Generate random HSN if not provided (for Invoice type)
            const generateRandomHSN = () => {
              return Math.floor(10000000 + Math.random() * 90000000);
            };

            const cartItem = {
              deptNmbr: product.deptNmbr || '0',
              skucounter: product.skucounter || 0,
              qtyunit: product.qtyunit || product.unit,
              netPrice: product.netPrice || product.price,
              MRP: product.MRP || product.originalPrice,
              vatbit:
                product.vatbit ||
                '00000000000000000000000000000000',
              productgrpnmbr: product.productgrpnmbr || 0,
              pluFlag: product.pluFlag || 'E',
              // For Invoice type, use generated HSN if not provided, otherwise use product HSN
              itemHSN:
                billType === 'invoice' && !product.itemHSN
                  ? generateRandomHSN()
                  : product.itemHSN || generateRandomHSN(),
              qtyMux: product.qtyMux || '',
              // For Invoice type, always set gstctype to 1 (which typically means no GST)
              gstctype:
                billType === 'invoice'
                  ? 1
                  : product.gstctype || 1,
              baseAmnt:
                product.baseAmnt ||
                product.netPrice ||
                product.price ||
                0,
              name: product.name,
              id: product.id,
              scflag: product.scflag || 0,
              sku: product.sku || product.id,
              status: product.status || 'success',
              quantity,
              scantype: product.scantype || 'MANUAL',
              remainingqty: product.remainingqty || '0',
              imageUrl: product.imageUrl || product.plulink || product.image || '',
              plulink: product.plulink || product.imageUrl || product.image || '',
            };
            updatedCart = [...o.cart, cartItem];
          }
          const updatedOrder = { ...o, cart: updatedCart };
          if (o.id === activeOrderId) {
            setCart(updatedCart);
          }
          return updatedOrder;
        }
        return o;
      }),
    );
  };

  // Refresh cart to get updated totals and discounts
  const handleRefreshCart = async () => {
    const current = orders.find(o => o.id === activeOrderId);
    if (!current || !current.cart || current.cart.length === 0) {
      setRefreshedCart(null);
      return;
    }

    setIsRefreshingCart(true);
    try {
      const input = {
        cartItem: current.cart.map((item: any) => ({
          ...item,
          qtyMux: item.qtyMux || '',
        })),
      };
      const result = await refreshCart(input);
      if (result.success && result.data && result.data.cartItem) {
        setRefreshedCart(result.data);
        setCart(result.data.cartItem);
      }
    } catch (error) {
      console.error('Failed to refresh cart:', error);
      Alert.alert(
        'Error',
        'Failed to refresh cart. Please try again.',
      );
    } finally {
      setIsRefreshingCart(false);
    }
  };

  // Auto-refresh cart when cart items change
  useEffect(() => {
    const current = orders.find(o => o.id === activeOrderId);
    // Only refresh if cart has items, otherwise explicitly set to null
    if (current && current.cart && current.cart.length > 0) {
      const refreshCartData = async () => {
        setIsRefreshingCart(true);
        try {
          const input = {
            cartItem: current.cart.map((item: any) => ({
              ...item,
              qtyMux: item.qtyMux || '',
            })),
          };
          const result = await refreshCart(input);
          if (result.success && result.data && result.data.cartItem) {
            setRefreshedCart(result.data);
            setCart(result.data.cartItem);
          }
        } catch (error) {
          console.error('Failed to refresh cart:', error);
        } finally {
          setIsRefreshingCart(false);
        }
      };
      refreshCartData();
    } else {
      // Explicitly clear refreshedCart when cart is empty
      setRefreshedCart(null);
      // Also clear cart context to ensure it's empty
      if (!current || !current.cart || current.cart.length === 0) {
        setCart([]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrderId, orders]); // Removed setCart from deps - it's stable and doesn't need to be in deps

  // Clear current order's cart (called after checkout)
  const clearCurrentOrderCart = async () => {
    const currentOrder = orders.find(o => o.id === activeOrderId);
    if (currentOrder && currentOrder.holdOrderId) {
      try {
        await removeHoldOrder({ holdOrderId: currentOrder.holdOrderId });
      } catch (err) {
        console.error('Failed to remove hold order:', err);
      }
      setOrders(prev =>
        prev.map(o =>
          o.id === activeOrderId
            ? {
                ...o,
                holdOrderId: undefined,
                cart: [],
                name: '',
                phone: '',
              }
            : o,
        ),
      );
    } else {
      setOrders(prev =>
        prev.map(o =>
          o.id === activeOrderId
            ? { ...o, cart: [], name: '', phone: '' }
            : o,
        ),
      );
    }
    setCart([]);
    // Clear refreshedCart to reset all amounts
    setRefreshedCart(null);
    // Clear payment methods when cart is cleared
    setSelectedPaymentMethods([]);
    setOrderId(null);
    setPaymentResponse(null);

    try {
      await Promise.all([
        AsyncStorage.removeItem('cart'),
        AsyncStorage.removeItem('pos_orders'),
      ]);
    } catch (error) {
      console.warn('Failed to clear stored cart/orders', error);
    }
  };

  const handleRemoveOrder = async (id: string) => {
    const orderToRemove = orders.find(o => o.id === id);
    if (orderToRemove && orderToRemove.holdOrderId) {
      try {
        await removeHoldOrder({ holdOrderId: orderToRemove.holdOrderId });
      } catch (err) {
        console.error('Failed to remove hold order:', err);
      }
    }
    const idx = orders.findIndex(o => o.id === id);
    if (idx === -1) return;
    const newOrders = orders.filter(o => o.id !== id);
    setOrders(newOrders);

    if (activeOrderId === id && newOrders.length > 0) {
      const newActiveOrderId =
        newOrders[Math.max(0, idx - 1)].id;
      setActiveOrderId(newActiveOrderId);

      const newActiveOrder = newOrders.find(
        o => o.id === newActiveOrderId,
      );
      if (newActiveOrder && Array.isArray(newActiveOrder.cart)) {
        setCart(newActiveOrder.cart);
      } else {
        setCart([]);
      }
    }
  };

  const handleUpdateOrderInfo = (
    id: string,
    name: string,
    phone: string,
  ) => {
    setOrders((prev: OrderWithCart[]) =>
      prev.map((o: OrderWithCart) =>
        o.id === id ? { ...o, name, phone } : o,
      ),
    );
  };

  const handleUpdateCustomerInfo = (name: string, phone: string) => {
    if (activeOrderId) {
      handleUpdateOrderInfo(activeOrderId, name, phone);
    }
  };

  // Don't render anything until orders are loaded
  if (orders.length === 0 || !activeOrderId) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Quick Billing Loaded</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Header
        user={user ? { userName: (user as any).userName, email: (user as any).email } : undefined}
        logout={logout}
        onReturnOrderClick={() => {
          // Handle return order click
        }}
        onBackClick={props.onBackClick}
      />
      <View style={styles.content}>
        <OrderTabsBar
          orders={orders}
          activeOrderId={activeOrderId}
          onAddOrder={handleAddOrder}
          onRemoveOrder={handleRemoveOrder}
          onSwitchOrder={handleSwitchOrder}
          loadingTabAction={loadingTabAction}
        />

        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
        >
          {activeOrder && (
            <View style={styles.sectionContainer}>
              <View style={styles.customerSection}>
                <QuickBillingCustomerInfo
                  name={activeOrder.name}
                  phone={activeOrder.phone}
                  billType={billType}
                  onUpdateInfo={handleUpdateCustomerInfo}
                  onBillTypeChange={newBillType => {
                    setBillType(newBillType);
                  }}
                />
              </View>
            </View>
          )}

          <View style={styles.sectionContainer}>
            <View style={styles.searchSection}>
              <QuickBillingSearchBar
                cartItems={activeOrder?.cart || []}
                onAddToCart={addToActiveOrderCart}
                onUpdateQuantity={updateActiveOrderCartItem}
                onRemoveFromCart={removeFromActiveOrderCart}
                billType={billType}
                onScanPress={() => setShowBarcodeDialog(true)}
                onAddProductPress={() => setShowAddProductDialog(true)}
              />
            </View>
          </View>

          <View style={styles.sectionContainer}>
            <QuickBillingCartTable
              cartItems={activeOrder?.cart || []}
              onUpdateQuantity={updateActiveOrderCartItem}
              onUpdatePrice={updateActiveOrderItemPrice}
              onRemoveFromCart={removeFromActiveOrderCart}
              onClearCart={clearCurrentOrderCart}
            />
          </View>

          <View style={styles.sectionContainer}>
            <QuickBillingCheckout
              cartItems={
                refreshedCart?.cartItem || activeOrder?.cart || []
              }
              refreshedCart={refreshedCart}
              clearCurrentOrderCart={clearCurrentOrderCart}
              customerName={activeOrder?.name || ''}
              customerPhone={activeOrder?.phone || ''}
              billType={billType}
              onPaymentComplete={() => {
                // Cart is already cleared in clearCurrentOrderCart
              }}
              onCartRefreshed={refreshedData => {
                setRefreshedCart(refreshedData);
              }}
              selectedPaymentMethods={selectedPaymentMethods}
              onPaymentMethodsChange={setSelectedPaymentMethods}
              orderId={orderId}
              onOrderIdChange={setOrderId}
              paymentResponse={paymentResponse}
              onPaymentResponseChange={setPaymentResponse}
            />
          </View>
        </ScrollView>
      </View>
      <Footer />

      {/* Barcode Scanner Dialog */}
      <BarcodeDialog
        isOpen={showBarcodeDialog}
        onClose={() => setShowBarcodeDialog(false)}
        onSubmit={(barcode) => {
          // Handle barcode submission if needed
          console.log('Barcode submitted:', barcode);
        }}
        cartItems={activeOrder?.cart || []}
        onAddToCart={addToActiveOrderCart}
        onUpdateQuantity={updateActiveOrderCartItem}
        onRemoveFromCart={removeFromActiveOrderCart}
        autoAdd={false}
      />

      {/* Add Product Dialog */}
      <QuickBillingAddProductDialog
        isOpen={showAddProductDialog}
        onClose={() => setShowAddProductDialog(false)}
        onSubmit={(product) => {
          addToActiveOrderCart(product, 1);
          setShowAddProductDialog(false);
        }}
        billType={billType}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f3f4f6', // gray-100 equivalent
  },
  content: {
    flex: 1,
    paddingTop: 16,
    paddingLeft: 16,
    paddingRight: 16,
  },
  tabsContainer: {
    marginBottom: 12,
  },
  tabsScrollContent: {
    alignItems: 'center',
  },
  tabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e5e7eb', // gray-200
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
  },
  tabItemActive: {
    backgroundColor: '#0064c2',
  },
  tabPressable: {
    maxWidth: 140,
  },
  tabText: {
    fontSize: 13,
    color: '#111827', // gray-900
  },
  tabTextActive: {
    color: '#ffffff',
    fontWeight: '600',
  },
  tabCloseButton: {
    marginLeft: 6,
    paddingHorizontal: 4,
  },
  tabCloseText: {
    fontSize: 14,
    color: '#4b5563', // gray-600
  },
  addTabButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db', // gray-300
  },
  addTabButtonDisabled: {
    opacity: 0.5,
  },
  addTabButtonText: {
    fontSize: 13,
    color: '#0064c2',
    fontWeight: '600',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  sectionContainer: {
    marginBottom: 16,
  },
  customerSection: {
    width: '100%',
    zIndex: 10,
    elevation: 10,
  },
  searchSection: {
    padding: 12,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    zIndex: 1,
    elevation: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280', // gray-500
  },
});
