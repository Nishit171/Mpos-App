import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { addProduct } from '../../../services/api/productService';

type BillType = 'taxInvoice' | 'invoice';

interface QuickBillingAddProductDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (product: any) => void;
  billType: BillType;
}

export default function QuickBillingAddProductDialog({
  isOpen,
  onClose,
  onSubmit,
  billType,
}: QuickBillingAddProductDialogProps) {
  const [productName, setProductName] = useState('');
  const [sku, setSku] = useState('');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState<'Pc' | 'Kg' | 'Gram' | 'Litre'>('Pc');
  const [hsn, setHsn] = useState('');
  const [cgst, setCgst] = useState('');
  const [sgst, setSgst] = useState('');
  const [igst, setIgst] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({
    productName: '',
    sku: '',
    price: '',
    quantity: '',
    hsn: '',
    cgst: '',
    sgst: '',
    igst: '',
  });

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setProductName('');
      setSku('');
      setPrice('');
      setQuantity('');
      setUnit('Pc');
      setHsn('');
      setCgst('');
      setSgst('');
      setIgst('');
      setErrors({
        productName: '',
        sku: '',
        price: '',
        quantity: '',
        hsn: '',
        cgst: '',
        sgst: '',
        igst: '',
      });
    }
  }, [isOpen]);

  const capitalizeWords = (str: string) => {
    return str.replace(/\b\w/g, (char) => char.toUpperCase());
  };

  const validateForm = () => {
    const newErrors = {
      productName: '',
      sku: '',
      price: '',
      quantity: '',
      hsn: '',
      cgst: '',
      sgst: '',
      igst: '',
    };

    if (!productName.trim()) {
      newErrors.productName = 'Product name is required';
    }

    const skuNum = parseInt(sku, 10);
    if (!sku || isNaN(skuNum) || skuNum < 0) {
      newErrors.sku = 'SKU must be a positive number';
    }

    const priceNum = parseFloat(price);
    if (!price || isNaN(priceNum) || priceNum <= 0) {
      newErrors.price = 'Price must be greater than 0';
    }

    const qtyNum = parseInt(quantity, 10);
    if (!quantity || isNaN(qtyNum) || qtyNum <= 0 || !Number.isInteger(qtyNum)) {
      newErrors.quantity = 'Quantity must be a whole number greater than 0';
    }

    // Optional HSN: numeric if provided
    if (hsn.trim()) {
      const hsnNum = parseInt(hsn, 10);
      if (isNaN(hsnNum) || hsnNum <= 0) {
        newErrors.hsn = 'HSN must be a positive number';
      }
    }

    const validatePercent = (value: string, field: 'cgst' | 'sgst' | 'igst') => {
      if (!value.trim()) return;
      const num = parseFloat(value);
      if (isNaN(num) || num < 0 || num > 100) {
        newErrors[field] = `${field.toUpperCase()} must be between 0 and 100`;
      }
    };

    validatePercent(cgst, 'cgst');
    validatePercent(sgst, 'sgst');
    validatePercent(igst, 'igst');

    setErrors(newErrors);
    return !Object.values(newErrors).some((error) => error !== '');
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      // Prepare product data for API
      const generateRandomHSN = () => {
        return Math.floor(10000000 + Math.random() * 90000000);
      };

      const unitMapping: Record<string, number> = {
        Kg: 1,
        Gram: 2,
        Pc: 3,
        Litre: 4,
      };

      const qtyunit = unitMapping[unit] ?? 3;

      const mrpVal = parseFloat(price);
      const qtyVal = parseInt(quantity, 10);

      const hsnCode = hsn.trim() ? parseInt(hsn, 10) : generateRandomHSN();

      let cgstVal = parseFloat(cgst || '0') || 0;
      let sgstVal = parseFloat(sgst || '0') || 0;
      let igstVal = parseFloat(igst || '0') || 0;

      if (billType === 'invoice') {
        cgstVal = 0;
        sgstVal = 0;
        igstVal = 0;
      }

      const productData = {
        pludesc: capitalizeWords(productName.trim()),
        skunmbr: parseInt(sku, 10),
        qtyunit,
        mrp: mrpVal,
        price: mrpVal,
        qty: qtyVal,
        hsn_code: hsnCode,
        cgst: cgstVal,
        sgst: sgstVal,
        igst: igstVal,
      };

      console.log('ADD PRODUCT PAYLOAD:', productData);

      const result = await addProduct(productData);

      if (!result.success) {
        Alert.alert('Error', result.error || 'Failed to add product');
        return;
      }

      // Call onSubmit with simplified product data
      onSubmit({
        id: Date.now().toString(),
        name: capitalizeWords(productName.trim()),
        sku: sku,
        price: Number(price),
        quantity: Number(quantity),
        ...result.data, // Include any additional data from API response
      });

      // Reset form
      resetForm();
      onClose();
      Alert.alert('Success', 'Product added successfully!');
    } catch (error) {
      console.error('Failed to add product:', error);
      Alert.alert('Error', 'Failed to add product. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setProductName('');
    setSku('');
    setPrice('');
    setQuantity('');
    setUnit('Pc');
    setHsn('');
    setCgst('');
    setSgst('');
    setIgst('');
    setErrors({
      productName: '',
      sku: '',
      price: '',
      quantity: '',
      hsn: '',
      cgst: '',
      sgst: '',
      igst: '',
    });
  };

  const handleCancel = () => {
    resetForm();
    onClose();
  };

  const handleProductNameChange = (value: string) => {
    setProductName(value);
    if (errors.productName) {
      setErrors((prev) => ({ ...prev, productName: '' }));
    }
  };

  const handleSkuChange = (value: string) => {
    // Only allow numbers
    const numericValue = value.replace(/[^0-9]/g, '');
    setSku(numericValue);
    if (errors.sku) {
      setErrors((prev) => ({ ...prev, sku: '' }));
    }
  };

  const handlePriceChange = (value: string) => {
    // Allow numbers and one decimal point
    const numericValue = value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
    setPrice(numericValue);
    if (errors.price) {
      setErrors((prev) => ({ ...prev, price: '' }));
    }
  };

  const handleQuantityChange = (value: string) => {
    // Only allow positive integers
    const numericValue = value.replace(/[^0-9]/g, '');
    setQuantity(numericValue);
    if (errors.quantity) {
      setErrors((prev) => ({ ...prev, quantity: '' }));
    }
  };


  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="slide"
      onRequestClose={handleCancel}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.title}>Add New Product</Text>
            <Pressable onPress={handleCancel} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>×</Text>
            </Pressable>
          </View>

          <ScrollView
            style={styles.formContainer}
            contentContainerStyle={styles.formContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.form}>
              {/* Product Name */}
              <View style={styles.field}>
                <Text style={styles.label}>Product Name</Text>
                <TextInput
                  style={[
                    styles.input,
                    errors.productName && styles.inputError,
                  ]}
                  value={productName}
                  onChangeText={handleProductNameChange}
                  placeholder="Enter product name"
                  placeholderTextColor="#94a3b8"
                  autoCapitalize="words"
                />
                {errors.productName ? (
                  <Text style={styles.errorText}>{errors.productName}</Text>
                ) : null}
              </View>

              {/* Barcode + Unit */}
              <View style={styles.row}>
                <View style={[styles.field, styles.flex1]}>
                  <Text style={styles.label}>Barcode</Text>
                  <TextInput
                    style={[styles.input, errors.sku && styles.inputError]}
                    value={sku}
                    onChangeText={handleSkuChange}
                    placeholder="Enter SKU / barcode"
                    placeholderTextColor="#94a3b8"
                    keyboardType="numeric"
                  />
                  {errors.sku ? (
                    <Text style={styles.errorText}>{errors.sku}</Text>
                  ) : null}
                </View>
                <View style={[styles.field, styles.flex1]}>
                  <Text style={styles.label}>Unit</Text>
                  <View style={styles.pickerWrapper}>
                    <Picker
                      selectedValue={unit}
                      onValueChange={value =>
                        setUnit(value as 'Pc' | 'Kg' | 'Gram' | 'Litre')
                      }
                      style={styles.picker}
                    >
                      <Picker.Item label="Pc" value="Pc" />
                      <Picker.Item label="Kg" value="Kg" />
                      <Picker.Item label="Gram" value="Gram" />
                      <Picker.Item label="Litre" value="Litre" />
                    </Picker>
                  </View>
                </View>
              </View>

              {/* Price + Quantity */}
              <View style={styles.row}>
                <View style={[styles.field, styles.flex1]}>
                  <Text style={styles.label}>Price (₹)</Text>
                  <TextInput
                    style={[styles.input, errors.price && styles.inputError]}
                    value={price}
                    onChangeText={handlePriceChange}
                    placeholder="0.00"
                    placeholderTextColor="#94a3b8"
                    keyboardType="decimal-pad"
                  />
                  {errors.price ? (
                    <Text style={styles.errorText}>{errors.price}</Text>
                  ) : null}
                </View>
                <View style={[styles.field, styles.flex1]}>
                  <Text style={styles.label}>Quantity</Text>
                  <TextInput
                    style={[
                      styles.input,
                      errors.quantity && styles.inputError,
                    ]}
                    value={quantity}
                    onChangeText={handleQuantityChange}
                    placeholder="Enter quantity"
                    placeholderTextColor="#94a3b8"
                    keyboardType="number-pad"
                  />
                  {errors.quantity ? (
                    <Text style={styles.errorText}>{errors.quantity}</Text>
                  ) : null}
                </View>
              </View>

              {/* HSN */}
              <View style={styles.field}>
                <Text style={styles.label}>HSN (Optional)</Text>
                <TextInput
                  style={[styles.input, errors.hsn && styles.inputError]}
                  value={hsn}
                  onChangeText={value => {
                    const numericValue = value.replace(/[^0-9]/g, '');
                    setHsn(numericValue);
                    if (errors.hsn) {
                      setErrors(prev => ({ ...prev, hsn: '' }));
                    }
                  }}
                  placeholder="Enter HSN code"
                  placeholderTextColor="#94a3b8"
                  keyboardType="number-pad"
                />
                {errors.hsn ? (
                  <Text style={styles.errorText}>{errors.hsn}</Text>
                ) : null}
              </View>

              {/* CGST / SGST / IGST */}
              <View style={styles.row}>
                <View style={[styles.field, styles.flex1]}>
                  <Text style={styles.label}>CGST (%)</Text>
                  <TextInput
                    style={[styles.input, errors.cgst && styles.inputError]}
                    value={cgst}
                    onChangeText={value => {
                      const numericValue = value
                        .replace(/[^0-9.]/g, '')
                        .replace(/(\..*)\./g, '$1');
                      setCgst(numericValue);
                      if (errors.cgst) {
                        setErrors(prev => ({ ...prev, cgst: '' }));
                      }
                    }}
                    placeholder="0"
                    placeholderTextColor="#94a3b8"
                    keyboardType="decimal-pad"
                  />
                  {errors.cgst ? (
                    <Text style={styles.errorText}>{errors.cgst}</Text>
                  ) : null}
                </View>
                <View style={[styles.field, styles.flex1]}>
                  <Text style={styles.label}>SGST (%)</Text>
                  <TextInput
                    style={[styles.input, errors.sgst && styles.inputError]}
                    value={sgst}
                    onChangeText={value => {
                      const numericValue = value
                        .replace(/[^0-9.]/g, '')
                        .replace(/(\..*)\./g, '$1');
                      setSgst(numericValue);
                      if (errors.sgst) {
                        setErrors(prev => ({ ...prev, sgst: '' }));
                      }
                    }}
                    placeholder="0"
                    placeholderTextColor="#94a3b8"
                    keyboardType="decimal-pad"
                  />
                  {errors.sgst ? (
                    <Text style={styles.errorText}>{errors.sgst}</Text>
                  ) : null}
                </View>
                <View style={[styles.field, styles.flex1]}>
                  <Text style={styles.label}>IGST (%)</Text>
                  <TextInput
                    style={[styles.input, errors.igst && styles.inputError]}
                    value={igst}
                    onChangeText={value => {
                      const numericValue = value
                        .replace(/[^0-9.]/g, '')
                        .replace(/(\..*)\./g, '$1');
                      setIgst(numericValue);
                      if (errors.igst) {
                        setErrors(prev => ({ ...prev, igst: '' }));
                      }
                    }}
                    placeholder="0"
                    placeholderTextColor="#94a3b8"
                    keyboardType="decimal-pad"
                  />
                  {errors.igst ? (
                    <Text style={styles.errorText}>{errors.igst}</Text>
                  ) : null}
                </View>
              </View>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <Pressable
              onPress={handleCancel}
              disabled={loading}
              style={[styles.button, styles.cancelButton]}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleSubmit}
              disabled={
                loading ||
                Object.values(errors).some((error) => error !== '') ||
                !productName.trim() ||
                !sku ||
                !price ||
                !quantity
              }
              style={[
                styles.button,
                styles.submitButton,
                (loading ||
                  Object.values(errors).some((error) => error !== '') ||
                  !productName.trim() ||
                  !sku ||
                  !price ||
                  !quantity) &&
                  styles.submitButtonDisabled,
              ]}
            >
              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#ffffff" />
                  <Text style={styles.submitButtonText}>Adding...</Text>
                </View>
              ) : (
                <Text style={styles.submitButtonText}>Add Product</Text>
              )}
            </Pressable>
          </View>
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
  modalContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    width: '100%',
    maxWidth: 500,
    height: '90%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  flex1: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
  },
  closeButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 28,
    color: '#94a3b8',
    lineHeight: 32,
  },
  formContainer: {
    flex: 1,
  },
  formContent: {
    flexGrow: 1,
    padding: 20,
  },
  form: {
    gap: 16,
  },
  field: {
    marginBottom: 4,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1e293b',
    marginBottom: 8,
  },
  input: {
    width: '100%',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    backgroundColor: '#ffffff',
    color: '#000000',
    fontSize: 16,
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    backgroundColor: '#ffffff',
    overflow: 'hidden',
  },
  picker: {
    width: '100%',
    color: '#000000',
  },
  inputError: {
    borderColor: '#ef4444',
    backgroundColor: '#fef2f2',
  },
  errorText: {
    fontSize: 12,
    color: '#ef4444',
    marginTop: 4,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  submitButton: {
    backgroundColor: '#0064c2',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
