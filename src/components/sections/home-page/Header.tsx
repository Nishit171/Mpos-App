import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useCart } from '../../../context/cart-context';
import { useAuth } from '../../../context/auth-context';
import { saveUpi } from '../../../services/api/orderService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Button } from '../ui/button';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Input } from '../ui/input';

interface HeaderProps {
  onCartClick?: () => void;
  user?: { userName?: string; email?: string };
  logout?: () => void;
  onReturnOrderClick?: () => void;
  onUpiClick?: () => void;
  onBackClick?: () => void;
}

export default function Header({
  onCartClick,
  user,
  logout,
  onReturnOrderClick,
  onUpiClick,
  onBackClick,
}: HeaderProps) {
  const { cart } = useCart();
  const { user: authUser, logout: authLogout } = useAuth();
  const totalItems = cart.reduce((sum: number, item: any) => sum + item.quantity, 0);
  const [displayUserName, setDisplayUserName] = useState<string>('');
  const [displayInitial, setDisplayInitial] = useState<string>('');
  const [displayEmail, setDisplayEmail] = useState<string>('');
  const [showUpiModal, setShowUpiModal] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showUpiForm, setShowUpiForm] = useState(false);
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
        error:
          'Invalid UPI ID format. Use format: username@handle (e.g., name@paytm)',
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
    const loadUserData = async () => {
      const currentUser = user || authUser;
      if (currentUser && (currentUser as any).userName) {
        const userName = (currentUser as any).userName;
        setDisplayUserName(userName);
        setDisplayInitial(userName.charAt(0).toUpperCase());
        await AsyncStorage.setItem('userName', userName);
        if ((currentUser as any).email) {
          setDisplayEmail((currentUser as any).email);
          await AsyncStorage.setItem('userEmail', (currentUser as any).email);
        }
      } else {
        try {
          const storedName = await AsyncStorage.getItem('userName');
          const storedEmail = await AsyncStorage.getItem('userEmail');
          if (storedName) {
            setDisplayUserName(storedName);
            setDisplayInitial(storedName.charAt(0).toUpperCase());
          } else {
            setDisplayUserName('');
            setDisplayInitial('');
          }
          if (storedEmail) {
            setDisplayEmail(storedEmail);
          } else {
            setDisplayEmail('');
          }
        } catch (error) {
          console.warn('Failed to load user data from storage', error);
        }
      }
      try {
        const storedUpi = await AsyncStorage.getItem('userUpiId');
        if (storedUpi) setSavedUpiId(storedUpi);
      } catch (error) {
        console.warn('Failed to load UPI ID from storage', error);
      }
    };
    loadUserData();
  }, [user, authUser]);

  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem('userName');
      await AsyncStorage.removeItem('userEmail');
    } catch (error) {
      console.warn('Failed to remove user data from storage', error);
    }
    if (logout) {
      logout();
    } else if (authLogout) {
      await authLogout();
    }
  };

  const handleReturnClick = () => {
    if (onReturnOrderClick) onReturnOrderClick();
  };

  const handleUpiClick = () => {
    setShowUpiForm(true);
    setShowUserMenu(false);
  };

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
        setUpiId('');
        setSavedUpiId(upiId.trim());
        await AsyncStorage.setItem('userUpiId', upiId.trim());
        setTimeout(() => {
          setShowUpiForm(false);
          setShowUpiModal(false);
        }, 1200);
      } else {
        setUpiMessage(result.data?.message || 'Failed to save UPI ID');
      }
    } catch (error) {
      setUpiMessage('Error saving UPI ID');
    } finally {
      setUpiLoading(false);
    }
  };

  const currentUser = user || authUser;

  return (
    <View style={styles.header}>
      <View style={styles.headerContent}>
        {/* Logo */}
        <View style={styles.logoContainer}>
          <Image
            source={{
              uri: 'https://apeiros.blob.core.windows.net/store-images/lume_logo.png',
            }}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        {/* Right side actions */}
        <View style={styles.actionsContainer}>
          {/* Return Order Button */}
          {onReturnOrderClick && (
            <Pressable
              onPress={handleReturnClick}
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

          {/* User Profile */}
          {currentUser && (
            <Pressable
              onPress={() => setShowUserMenu(!showUserMenu)}
              style={styles.userButton}
            >
              <Avatar style={styles.avatar}>
                <AvatarFallback>
                  {displayInitial ? (
                    <Text style={styles.avatarInitial}>{displayInitial}</Text>
                  ) : (
                    <Icon name="person" size={16} color="#0064C2" />
                  )}
                </AvatarFallback>
              </Avatar>
            </Pressable>
          )}
        </View>
      </View>

      {/* User Menu Modal */}
      <Modal
        visible={showUserMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowUserMenu(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowUserMenu(false)}
        >
          <View style={styles.userMenu}>
            {/* User Info */}
            <View style={styles.userInfo}>
              <View style={styles.userInfoHeader}>
                <Avatar style={styles.userAvatar}>
                  <AvatarFallback>
                    {displayInitial || <Icon name="person" size={20} color="#374151" />}
                  </AvatarFallback>
                </Avatar>
                <View style={styles.userDetails}>
                  <Text style={styles.userName}>
                    {displayUserName || 'User'}
                  </Text>
                  {displayEmail && (
                    <Text style={styles.userEmail}>{displayEmail}</Text>
                  )}
                </View>
              </View>
              {savedUpiId && (
                <View style={styles.upiBadge}>
                  <Image
                    source={require('../../../assets/upii.png')}
                    style={styles.upiIcon}
                    resizeMode="contain"
                  />
                  <Text style={styles.upiLabel}>UPI:</Text>
                  <Text style={styles.upiValue}>{savedUpiId}</Text>
                </View>
              )}
            </View>

            {/* Menu Items */}
            <View style={styles.menuSeparator} />
            <Pressable onPress={handleUpiClick} style={styles.menuItem}>
              <Image
                source={require('../../../assets/upii.png')}
                style={styles.menuIcon}
                resizeMode="contain"
              />
              <Text style={styles.menuItemText}>Set UPI</Text>
            </Pressable>
            <View style={styles.menuSeparator} />
            <Pressable onPress={handleLogout} style={styles.menuItem}>
              <Icon name="logout" size={20} color="#dc2626" />
              <Text style={[styles.menuItemText, styles.logoutText]}>
                Logout
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* UPI Modal */}
      <Modal
        visible={showUpiModal || showUpiForm}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowUpiModal(false);
          setShowUpiForm(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.upiModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Set UPI ID</Text>
              <Pressable
                onPress={() => {
                  setShowUpiModal(false);
                  setShowUpiForm(false);
                }}
                style={styles.closeButton}
              >
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
              {upiError ? (
                <Text style={styles.errorText}>{upiError}</Text>
              ) : null}

              <Pressable
                onPress={handleSaveUpi}
                disabled={upiLoading || !upiId || !!upiError}
                style={[
                  styles.saveButton,
                  (upiLoading || !upiId || !!upiError) &&
                    styles.saveButtonDisabled,
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
  header: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    height: 64,
  },
  logoContainer: {
    justifyContent: 'center',
  },
  logo: {
    height: 40,
    width: 120,
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  userButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#0064C2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  userMenu: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  userInfo: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
  },
  userInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  userAvatar: {
    width: 36,
    height: 36,
    backgroundColor: '#e5e7eb',
    marginRight: 12,
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 12,
    color: '#6b7280',
  },
  upiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fde68a',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginTop: 8,
  },
  upiIcon: {
    width: 16,
    height: 16,
    marginRight: 4,
  },
  upiLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400e',
    marginRight: 4,
  },
  upiValue: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#92400e',
  },
  menuSeparator: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  menuIcon: {
    width: 20,
    height: 20,
    marginRight: 12,
  },
  menuItemText: {
    fontSize: 14,
    color: '#374151',
  },
  logoutText: {
    color: '#dc2626',
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
  closeButton: {
    padding: 4,
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
