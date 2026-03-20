import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

interface CreditNoteModalProps {
  creditNoteModal: boolean;
  setOpenCreditNoteModal: (open: boolean) => void;
  creditnote: string;
  onClose?: () => void;
  billPdfUrl?: string;
  creditNotPdfUrl?: string;
  isCustomerCopy?: boolean;
}

export default function CreditNoteModal({
  creditNoteModal,
  setOpenCreditNoteModal,
  creditnote,
  onClose,
  billPdfUrl,
  creditNotPdfUrl,
  isCustomerCopy = false,
}: CreditNoteModalProps) {
  const [isLoading, setIsLoading] = useState(false);

  const pdfUrl = isCustomerCopy ? creditNotPdfUrl : billPdfUrl;
  const billImageDataUri = useMemo(() => {
    if (!creditnote) return null;
    return `data:image/png;base64,${creditnote}`;
  }, [creditnote]);

  const handleClose = () => {
    setOpenCreditNoteModal(false);
    if (onClose) onClose();
  };

  const openPdf = async () => {
    if (!pdfUrl) {
      Alert.alert(
        'Invoice unavailable',
        'Credit note PDF is not available for this copy.',
      );
      return;
    }
    try {
      setIsLoading(true);
      await Linking.openURL(pdfUrl);
    } catch (error) {
      console.error('Credit note open URL error:', error);
      Alert.alert('Error', 'Failed to open credit note PDF.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      visible={creditNoteModal}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropPress} onPress={handleClose} />
        <View style={styles.modal}>
          <Pressable
            onPress={handleClose}
            style={styles.closeButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Close credit note modal"
          >
            <Text style={styles.closeText}>×</Text>
          </Pressable>

          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.headerText}>
              {isCustomerCopy ? "Customer's Copy" : "Cashier's Copy"}
            </Text>
            <Text style={styles.subText}>
              Your credit note is ready!
            </Text>

            <View style={styles.previewContainer}>
              {billImageDataUri ? (
                <Image
                  source={{ uri: billImageDataUri }}
                  style={styles.previewImage}
                  resizeMode="contain"
                />
              ) : (
                <Text style={styles.previewFallback}>
                  Preview not available
                </Text>
              )}
            </View>

            <View style={styles.buttonsRow}>
              <Pressable
                onPress={openPdf}
                disabled={isLoading || !pdfUrl}
                style={[
                  styles.button,
                  styles.primaryButton,
                  (isLoading || !pdfUrl) && styles.buttonDisabled,
                ]}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.primaryButtonText}>Download</Text>
                )}
              </Pressable>

              <Pressable
                onPress={openPdf}
                disabled={isLoading || !pdfUrl}
                style={[
                  styles.button,
                  styles.secondaryButton,
                  (isLoading || !pdfUrl) && styles.buttonDisabled,
                ]}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#0064c2" />
                ) : (
                  <Text style={styles.secondaryButtonText}>Print</Text>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.40)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  backdropPress: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modal: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    overflow: 'hidden',
  },
  closeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 44,
    height: 44,
    borderRadius: 22,
    zIndex: 10,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 22,
    color: '#ef4444',
    fontWeight: '800',
    lineHeight: 22,
  },
  content: {
    paddingTop: 56,
    paddingBottom: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  headerText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 6,
  },
  subText: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 12,
  },
  previewContainer: {
    width: '100%',
    height: 420,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  previewImage: {
    width: '92%',
    height: '92%',
  },
  previewFallback: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
  },
  buttonsRow: {
    flexDirection: 'row',
    width: '100%',
    marginTop: 14,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: '#0064c2',
    marginRight: 12,
  },
  secondaryButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#0064c2',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  secondaryButtonText: {
    color: '#0064c2',
    fontSize: 14,
    fontWeight: '800',
  },
});

