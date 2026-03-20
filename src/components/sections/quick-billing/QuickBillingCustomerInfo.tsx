import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { searchCustomers } from '../../../services/api/customerService';
import { getGst, saveGst } from '../../../services/api/orderService';

interface Customer {
  id: number;
  firstName: string;
  lastName: string;
  mobileNum: string;
  emailId: string;
  organizationId: number;
  count: number;
  lastUpdatedDateTime: string;
}

type BillType = 'taxInvoice' | 'invoice';

interface QuickBillingCustomerInfoProps {
  name: string;
  phone: string;
  billType: BillType;
  onUpdateInfo: (name: string, phone: string) => void;
  onBillTypeChange: (billType: BillType) => void;
}

export default function QuickBillingCustomerInfo({
  name,
  phone,
  billType,
  onUpdateInfo,
  onBillTypeChange,
}: QuickBillingCustomerInfoProps) {
  const [suggestions, setSuggestions] = useState<Customer[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeField, setActiveField] = useState<'name' | 'phone' | null>(
    null,
  );
  const [showBillTypeDropdown, setShowBillTypeDropdown] =
    useState(false);
  const [showGstDialog, setShowGstDialog] = useState(false);
  const [gstInput, setGstInput] = useState('');
  const [gstLoading, setGstLoading] = useState(false);
  const [checkingGst, setCheckingGst] = useState(false);

  const searchCustomersHandler = async (
    searchName: string,
    searchPhone: string,
  ) => {
    if (
      (!searchName || searchName.length < 2) &&
      (!searchPhone || searchPhone.length < 3)
    ) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setIsLoading(true);
    try {
      const result = await searchCustomers(searchName, searchPhone);
      if (result.success && result.data?.customers) {
        setSuggestions(result.data.customers);
        setShowSuggestions(result.data.customers.length > 0);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    } catch (error) {
      console.error('Error searching customers:', error);
      setSuggestions([]);
      setShowSuggestions(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNameChange = (text: string) => {
    onUpdateInfo(text, phone);
    setActiveField('name');
    setTimeout(() => {
      searchCustomersHandler(text, phone);
    }, 300);
  };

  const handlePhoneChange = (text: string) => {
    let value = text.replace(/\D/g, '');
    if (value.length > 10) {
      return;
    }
    if (value === '' || /^[6-9]/.test(value)) {
      onUpdateInfo(name, value);
      setActiveField('phone');
      setTimeout(() => {
        searchCustomersHandler(name, value);
      }, 300);
    }
  };

  const handleSuggestionClick = (customer: Customer) => {
    const fullName = `${customer.firstName} ${customer.lastName}`.trim();
    onUpdateInfo(fullName, customer.mobileNum);
    setShowSuggestions(false);
    setSuggestions([]);
    setActiveField(null);
  };

  const clearSuggestions = () => {
    setShowSuggestions(false);
    setSuggestions([]);
    setActiveField(null);
  };

  const handleTaxInvoiceClick = async () => {
    setCheckingGst(true);
    try {
      const result = await getGst();
      if (
        result.success &&
        result.data &&
        String(result.data).trim().length > 0
      ) {
        onBillTypeChange('taxInvoice');
        setShowBillTypeDropdown(false);
      } else {
        setShowGstDialog(true);
        setGstInput('');
      }
    } catch {
      setShowGstDialog(true);
      setGstInput('');
    } finally {
      setCheckingGst(false);
    }
  };

  const handleGstSubmit = async () => {
    const cinNo = gstInput.trim();
    if (!cinNo) {
      Alert.alert('GST required', 'Please enter GST/CIN number');
      return;
    }
    setGstLoading(true);
    try {
      const result = await saveGst(cinNo);
      if (result.success) {
        Alert.alert('Success', 'GST added successfully');
        setShowGstDialog(false);
        setGstInput('');
        onBillTypeChange('taxInvoice');
        setShowBillTypeDropdown(false);
      } else {
        Alert.alert(
          'Error',
          result.data?.message ||
            result.error ||
            'Failed to save GST',
        );
      }
    } catch {
      Alert.alert(
        'Error',
        'Failed to save GST. Please try again.',
      );
    } finally {
      setGstLoading(false);
    }
  };

  useEffect(() => {
    if (!showSuggestions) return;
    // Auto-hide suggestions when name/phone both become too short
    if (name.length < 2 && phone.length < 3) {
      clearSuggestions();
    }
  }, [name, phone, showSuggestions]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Customer Information</Text>

      <View style={styles.customerSection}>
        {/* Phone */}
        <View style={styles.fieldRow}>
          <View style={styles.inputGroup}>
            <Text style={styles.icon}>📞</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                value={phone}
                keyboardType="phone-pad"
                maxLength={10}
                placeholder="Phone Number"
                onChangeText={handlePhoneChange}
                onFocus={() => {
                  if (suggestions.length > 0) {
                    setShowSuggestions(true);
                    setActiveField('phone');
                  }
                }}
                style={[
                  styles.input,
                  phone && phone.length > 0 && phone.length !== 10
                    ? styles.inputError
                    : styles.inputFilled,
                ]}
                placeholderTextColor="#9ca3af"
              />
              {isLoading && activeField === 'phone' && (
                <ActivityIndicator
                  size="small"
                  color="#0064c2"
                  style={styles.loadingIndicator}
                />
              )}
            </View>
          </View>
        </View>

        {/* Name */}
        <View style={styles.fieldRow}>
          <View style={styles.inputGroup}>
            <Text style={styles.icon}>👤</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                value={name}
                placeholder="Customer Name"
                onChangeText={handleNameChange}
                onFocus={() => {
                  if (suggestions.length > 0) {
                    setShowSuggestions(true);
                    setActiveField('name');
                  }
                }}
                style={[styles.input, styles.inputFilled]}
                placeholderTextColor="#9ca3af"
              />
              {isLoading && activeField === 'name' && (
                <ActivityIndicator
                  size="small"
                  color="#0064c2"
                  style={styles.loadingIndicator}
                />
              )}
            </View>
          </View>
        </View>

        {/* Bill type */}
        <View style={styles.fieldRow}>
          <View style={styles.billTypeWrapper}>
            <Pressable
              style={styles.billTypeButton}
              onPress={() =>
                setShowBillTypeDropdown(!showBillTypeDropdown)
              }
            >
              <View style={styles.taxRow}>
                <Text style={styles.taxRowIcon}>📄</Text>
                <View style={styles.taxDropdownWrapper}>
                  <View style={styles.billTypeLeft}>
                    <Text style={styles.billTypeText}>
                      {billType === 'taxInvoice'
                        ? 'Tax Invoice'
                        : 'Invoice'}
                    </Text>
                  </View>
                  <Text style={styles.billTypeChevron}>
                    {showBillTypeDropdown ? '▲' : '▼'}
                  </Text>
                </View>
              </View>
            </Pressable>

            {showBillTypeDropdown && (
              <View style={styles.billTypeDropdown}>
                <Pressable
                  style={[
                    styles.billTypeOption,
                    billType === 'taxInvoice' &&
                      styles.billTypeOptionActive,
                  ]}
                  onPress={handleTaxInvoiceClick}
                  disabled={checkingGst}
                >
                  <Text
                    style={[
                      styles.billTypeOptionText,
                      billType === 'taxInvoice' &&
                        styles.billTypeOptionTextActive,
                    ]}
                  >
                    Tax Invoice
                  </Text>
                  {checkingGst ? (
                    <Text style={styles.billTypeCheckingText}>
                      Checking...
                    </Text>
                  ) : billType === 'taxInvoice' ? (
                    <Text style={styles.billTypeCheck}>✓</Text>
                  ) : null}
                </Pressable>
                <Pressable
                  style={[
                    styles.billTypeOption,
                    billType === 'invoice' &&
                      styles.billTypeOptionActive,
                    styles.billTypeOptionBorderTop,
                  ]}
                  onPress={() => {
                    onBillTypeChange('invoice');
                    setShowBillTypeDropdown(false);
                  }}
                >
                  <Text
                    style={[
                      styles.billTypeOptionText,
                      billType === 'invoice' &&
                        styles.billTypeOptionTextActive,
                    ]}
                  >
                    Invoice
                  </Text>
                  {billType === 'invoice' && (
                    <Text style={styles.billTypeCheck}>✓</Text>
                  )}
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </View>

      {phone && phone.length > 0 && phone.length !== 10 && (
        <Text style={styles.phoneError}>
          Please enter a valid 10-digit mobile number
        </Text>
      )}

      {/* Suggestions list */}
      {showSuggestions && (
        <View style={styles.suggestionsContainer}>
          {isLoading ? (
            <View style={styles.suggestionsHeader}>
              <Text style={styles.suggestionsTitle}>
                Searching customers...
              </Text>
              <ActivityIndicator size="small" color="#0064c2" />
            </View>
          ) : suggestions.length > 0 ? (
            <>
              <View style={styles.suggestionsHeader}>
                <Text style={styles.suggestionsTitle}>
                  Customers Found ({suggestions.length})
                </Text>
                <Pressable
                  onPress={clearSuggestions}
                  style={styles.clearSuggestionsButton}
                >
                  <Text style={styles.clearSuggestionsText}>
                    ✕
                  </Text>
                </Pressable>
              </View>
              <ScrollView style={styles.suggestionsList}>
                {suggestions.map((customer, index) => {
                  const fullName = `${customer.firstName} ${customer.lastName}`.trim();
                  return (
                    <Pressable
                      key={customer.id || index}
                      onPress={() =>
                        handleSuggestionClick(customer)
                      }
                      style={styles.suggestionRow}
                    >
                      <View style={styles.suggestionTextWrapper}>
                        <Text style={styles.suggestionName}>
                          {fullName || 'No Name'}
                        </Text>
                        <Text style={styles.suggestionPhone}>
                          {customer.mobileNum}
                        </Text>
                        {customer.emailId ? (
                          <Text style={styles.suggestionEmail}>
                            {customer.emailId}
                          </Text>
                        ) : null}
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </>
          ) : (name.length >= 2 || phone.length >= 3) && !isLoading ? (
            <View>
              <View style={styles.suggestionsHeader}>
                <Text style={styles.suggestionsTitle}>
                  No customers found
                </Text>
                <Pressable
                  onPress={clearSuggestions}
                  style={styles.clearSuggestionsButton}
                >
                  <Text style={styles.clearSuggestionsText}>
                    ✕
                  </Text>
                </Pressable>
              </View>
              <View style={styles.noResultsBody}>
                <Text style={styles.noResultsText}>
                  Try searching with a different name or phone
                  number
                </Text>
              </View>
            </View>
          ) : null}
        </View>
      )}

      {/* GST dialog */}
      <Modal
        visible={showGstDialog}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowGstDialog(false);
          setGstInput('');
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              Enter GST / CIN Number
            </Text>
            <Text style={styles.modalSubtitle}>
              Tax Invoice requires a GST number. Please enter
              your GST or CIN.
            </Text>
            <TextInput
              value={gstInput}
              onChangeText={setGstInput}
              placeholder="e.g. 19AABCF9869N1ZN"
              style={styles.modalInput}
              placeholderTextColor="#9ca3af"
              autoCapitalize="characters"
            />
            <View style={styles.modalButtonsRow}>
              <Pressable
                style={styles.modalCancelButton}
                onPress={() => {
                  setShowGstDialog(false);
                  setGstInput('');
                }}
              >
                <Text style={styles.modalCancelText}>
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.modalSaveButton,
                  (!gstInput.trim() || gstLoading) &&
                    styles.modalSaveButtonDisabled,
                ]}
                onPress={handleGstSubmit}
                disabled={!gstInput.trim() || gstLoading}
              >
                <Text style={styles.modalSaveText}>
                  {gstLoading
                    ? 'Saving...'
                    : 'Save & Use Tax Invoice'}
                </Text>
              </Pressable>
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
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    paddingHorizontal: 16,
    paddingVertical: 10,
    overflow: 'visible',
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  customerSection: {
    flexDirection: 'column',
    gap: 12,
    width: '100%',
  },
  fieldRow: {
    width: '100%',
    marginBottom: 0,
  },
  inputGroup: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    fontSize: 14,
    marginRight: 6,
  },
  inputWrapper: {
    flex: 1,
    position: 'relative',
  },
  input: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
    fontWeight: '500',
    color: '#111827',
    borderWidth: 1,
  },
  inputFilled: {
    backgroundColor: '#f3f4f6',
    borderColor: '#e5e7eb',
  },
  inputError: {
    backgroundColor: '#fef2f2',
    borderColor: '#ef4444',
  },
  loadingIndicator: {
    position: 'absolute',
    right: 8,
    top: '50%',
    marginTop: -8,
  },
  billTypeWrapper: {
    width: '100%',
    position: 'relative',
    zIndex: 1000,
    elevation: 10,
  },
  billTypeButton: {
    padding: 0,
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  taxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  taxRowIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  taxDropdownWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#eff6ff',
  },
  billTypeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  billTypeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0064c2',
  },
  billTypeChevron: {
    fontSize: 12,
    color: '#0064c2',
  },
  billTypeDropdown: {
    position: 'absolute',
    top: '100%',
    marginTop: 8,
    left: 0,
    right: 0,
    width: '100%',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    zIndex: 2000,
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  billTypeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  billTypeOptionActive: {
    backgroundColor: '#eff6ff',
  },
  billTypeOptionBorderTop: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  billTypeOptionText: {
    fontSize: 13,
    color: '#374151',
  },
  billTypeOptionTextActive: {
    color: '#0064c2',
    fontWeight: '600',
  },
  billTypeCheck: {
    fontSize: 13,
    color: '#0064c2',
  },
  billTypeCheckingText: {
    fontSize: 11,
    color: '#6b7280',
  },
  phoneError: {
    marginTop: 4,
    marginLeft: 24,
    fontSize: 11,
    color: '#ef4444',
  },
  suggestionsContainer: {
    marginTop: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    maxHeight: 260,
  },
  suggestionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  suggestionsTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#374151',
  },
  clearSuggestionsButton: {
    padding: 4,
    borderRadius: 999,
  },
  clearSuggestionsText: {
    fontSize: 13,
    color: '#9ca3af',
  },
  suggestionsList: {
    maxHeight: 220,
  },
  suggestionRow: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  suggestionTextWrapper: {
    flex: 1,
  },
  suggestionName: {
    fontSize: 13,
    fontWeight: '500',
    color: '#111827',
  },
  suggestionPhone: {
    fontSize: 12,
    color: '#4b5563',
    marginTop: 2,
  },
  suggestionEmail: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
  },
  noResultsBody: {
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  noResultsText: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  modalContent: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    padding: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#4b5563',
    marginBottom: 12,
  },
  modalInput: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: '#111827',
    marginBottom: 12,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalCancelButton: {
    flex: 1,
    marginRight: 6,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 13,
    color: '#111827',
  },
  modalSaveButton: {
    flex: 1,
    marginLeft: 6,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#0064c2',
    alignItems: 'center',
  },
  modalSaveButtonDisabled: {
    opacity: 0.5,
  },
  modalSaveText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
  },
});

