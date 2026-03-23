import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
  Modal,
  TextInput,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { saveUpi } from '../../../services/api/orderService';
import { Input } from '../ui/input';

const MAX_ORDERS = 5;

export interface Order {
  id: string;
  name: string;
  phone: string;
}

interface OrderTabsProps {
  orders: Order[];
  activeOrderId: string;
  onAddOrder: () => void;
  onRemoveOrder: (id: string) => void;
  onSwitchOrder: (id: string) => void;
  onUpdateOrderInfo: (id: string, name: string, phone: string) => void;
  loadingTabAction?: boolean;
  onReturnOrderClick?: () => void;
  disableAddOrder?: boolean;
  onUpiClick?: () => void;
  isIframeMode?: boolean;
  onBackClick?: () => void;
}

export default function OrderTabs({
  orders,
  activeOrderId,
  onAddOrder,
  onRemoveOrder,
  onSwitchOrder,
  onUpdateOrderInfo,
  loadingTabAction,
  onReturnOrderClick,
  disableAddOrder = false,
  onUpiClick,
  isIframeMode = false,
  onBackClick,
}: OrderTabsProps) {
  const [upiOpen, setUpiOpen] = useState(false);
  const [upiId, setUpiId] = useState('');
  const [upiLoading, setUpiLoading] = useState(false);
  const [upiMessage, setUpiMessage] = useState<string | null>(null);
  const [savedUpiId, setSavedUpiId] = useState<string>('');
  const [upiError, setUpiError] = useState<string>('');

  const validateUpiId = (upi: string): { isValid: boolean; error: string } => {
    if (!upi || upi.trim() === '') {
      return { isValid: false, error: '' };
    }
    const upiRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/;
    if (!upiRegex.test(upi.trim())) {
      return {
        isValid: false,
        error: 'Invalid UPI ID format. Use format: username@handle (e.g., name@paytm)',
      };
    }
    if (upi.trim().length < 5 || upi.trim().length > 100) {
      return {
        isValid: false,
        error: 'UPI ID must be between 5 and 100 characters',
      };
    }
    return { isValid: true, error: '' };
  };

  useEffect(() => {
    const loadUpiId = async () => {
      try {
        const storedUpi = await AsyncStorage.getItem('userUpiId');
        if (storedUpi) setSavedUpiId(storedUpi);
      } catch (error) {
        console.warn('Failed to load UPI ID from storage', error);
      }
    };
    loadUpiId();
  }, []);

  const handleSaveUpi = async () => {
    const validation = validateUpiId(upiId);
    if (!validation.isValid) {
      setUpiError(validation.error);
      setUpiMessage(null);
      return;
    }

    try {
      setUpiLoading(true);
      setUpiMessage(null);
      setUpiError('');
      const result = await saveUpi({ upiId: upiId.trim() });
      if (
        result.success &&
        result.data &&
        typeof result.data.resMessage === 'string' &&
        result.data.resMessage.toLowerCase().includes('success')
      ) {
        setUpiMessage('UPI ID saved successfully!');
        setSavedUpiId(upiId.trim());
        await AsyncStorage.setItem('userUpiId', upiId.trim());
        setUpiId('');
        setTimeout(() => setUpiOpen(false), 1200);
      } else {
        setUpiMessage(result.data?.message || 'Failed to save UPI ID');
      }
    } catch (error) {
      setUpiMessage('Error saving UPI ID');
    } finally {
      setUpiLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.tabsRow}>
        {/* Order Tabs - Scrollable */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabsScrollView}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.tabsContent}
        >
          {orders.map((order, idx) => {
            const isActive = order.id === activeOrderId;
            return (
              <Pressable
                key={order.id}
                onPress={() => !loadingTabAction && onSwitchOrder(order.id)}
                disabled={loadingTabAction}
                style={[
                  styles.tab,
                  isActive && styles.tabActive,
                  loadingTabAction && styles.tabDisabled,
                ]}
              >
                <Text
                  style={[styles.tabText, isActive && styles.tabTextActive]}
                  numberOfLines={1}
                >
                  {order.name || `Order ${idx + 1}`}
                </Text>
                {orders.length > 1 && (
                  <Pressable
                    onPress={e => {
                      e.stopPropagation();
                      if (!loadingTabAction) onRemoveOrder(order.id);
                    }}
                    disabled={loadingTabAction}
                    style={styles.tabCloseButton}
                  >
                    <Icon name="close" size={14} color="#dc2626" />
                  </Pressable>
                )}
              </Pressable>
            );
          })}
          {/* Add Order Button */}
          {orders.length < MAX_ORDERS && !disableAddOrder && (
            <Pressable
              onPress={onAddOrder}
              disabled={loadingTabAction}
              style={[styles.addTabButton, loadingTabAction && styles.addTabButtonDisabled]}
            >
              {loadingTabAction ? (
                <ActivityIndicator size="small" color="#0064c2" />
              ) : (
                <Icon name="add" size={16} color="#0064c2" />
              )}
            </Pressable>
          )}
        </ScrollView>

        {/* Right side buttons */}
        <View style={styles.rightButtons}>
          {/* Back Button */}
          {onBackClick && (
            <Pressable
              onPress={onBackClick}
              disabled={loadingTabAction}
              style={styles.backButton}
            >
              <Icon name="close" size={20} color="#dc2626" />
            </Pressable>
          )}
          {/* Return Order Button and UPI - Only show in iframe mode */}
          {isIframeMode && (
            <>
              {onReturnOrderClick && (
                <Pressable
                  onPress={onReturnOrderClick}
                  disabled={loadingTabAction}
                  style={styles.returnButton}
                >
                  <Image
                    source={require('../../../assets/ret.png')}
                    style={styles.returnIcon}
                    resizeMode="contain"
                  />
                  <Text style={styles.returnText}>RETURN</Text>
                </Pressable>
              )}
              {/* UPI Button */}
              <Pressable
                onPress={() => setUpiOpen(true)}
                disabled={loadingTabAction}
                style={styles.upiButton}
              >
                <Image
                  source={require('../../../assets/upii.png')}
                  style={styles.upiIcon}
                  resizeMode="contain"
                />
                {savedUpiId ? (
                  <Text style={styles.upiText} numberOfLines={1}>
                    {savedUpiId.length > 8
                      ? `${savedUpiId.substring(0, 6)}...`
                      : savedUpiId}
                  </Text>
                ) : (
                  <Text style={styles.upiText}>Set UPI</Text>
                )}
              </Pressable>
            </>
          )}
        </View>
      </View>

      {/* UPI Modal */}
      <Modal
        visible={upiOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setUpiOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.upiModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Set UPI ID</Text>
              <Pressable onPress={() => setUpiOpen(false)}>
                <Icon name="close" size={24} color="#6b7280" />
              </Pressable>
            </View>

            {savedUpiId && (
              <View style={styles.currentUpiContainer}>
                <Text style={styles.currentUpiLabel}>Current UPI ID:</Text>
                <Text style={styles.currentUpiValue}>{savedUpiId}</Text>
              </View>
            )}

            <View style={styles.upiForm}>
              <Text style={styles.inputLabel}>Enter UPI ID</Text>
              <TextInput
                style={[styles.input, upiError ? styles.inputError : null]}
                placeholder="example@paytm"
                value={upiId}
                onChangeText={value => {
                  setUpiId(value);
                  const validation = validateUpiId(value);
                  setUpiError(validation.error);
                  if (validation.error) {
                    setUpiMessage(null);
                  }
                }}
                editable={!upiLoading}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {upiError ? <Text style={styles.errorText}>{upiError}</Text> : null}

              <Pressable
                onPress={handleSaveUpi}
                disabled={upiLoading || !upiId || !!upiError}
                style={[
                  styles.saveButton,
                  (upiLoading || !upiId || !!upiError) && styles.saveButtonDisabled,
                ]}
              >
                {upiLoading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.saveButtonText}>Save</Text>
                )}
              </Pressable>

              {upiMessage && (
                <Text
                  style={[
                    styles.messageText,
                    upiMessage.includes('success')
                      ? styles.successText
                      : styles.errorText,
                  ]}
                >
                  {upiMessage}
                </Text>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  tabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 64,
    gap: 12,
  },
  tabsScrollView: {
    flex: 1,
  },
  tabsContent: {
    alignItems: 'center',
    gap: 8,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    height: 40,
    gap: 4,
  },
  tabActive: {
    backgroundColor: 'rgba(0, 100, 194, 0.1)',
    borderColor: '#0064c2',
  },
  tabDisabled: {
    opacity: 0.6,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    maxWidth: 120,
  },
  tabTextActive: {
    color: '#033c70',
  },
  tabCloseButton: {
    padding: 4,
  },
  addTabButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 100, 194, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addTabButtonDisabled: {
    opacity: 0.5,
  },
  rightButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  returnButton: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    width: 64,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  returnIcon: {
    height: 24,
    width: 24,
  },
  returnText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fb923c',
    marginTop: 2,
  },
  upiButton: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#e0f2fe',
    borderWidth: 1,
    borderColor: '#93c5fd',
    height: 40,
    minWidth: 60,
  },
  upiIcon: {
    width: 16,
    height: 16,
  },
  upiText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#1e40af',
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  upiModal: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
  },
  currentUpiContainer: {
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  currentUpiLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  currentUpiValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  upiForm: {
    gap: 12,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#ffffff',
  },
  inputError: {
    borderColor: '#dc2626',
  },
  errorText: {
    fontSize: 12,
    color: '#dc2626',
  },
  saveButton: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  messageText: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  successText: {
    color: '#059669',
  },
});
