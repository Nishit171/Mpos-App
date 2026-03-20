import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

interface CreditNoteTypeProps {
  open: boolean;
  onClose: () => void;
  onGoHome: () => void;
  onFirstAction: () => void;
  onSecondAction: () => void;
}

export default function CreditNoteType({
  open,
  onClose,
  onGoHome: _onGoHome,
  onFirstAction,
  onSecondAction,
}: CreditNoteTypeProps) {
  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.modal}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Select the Credit Note</Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>×</Text>
            </Pressable>
          </View>

          <View style={styles.actionRow}>
            <Pressable
              onPress={onFirstAction}
              style={[styles.actionButton, styles.actionButtonPrimary]}
            >
              <Text style={styles.actionButtonPrimaryText}>
                Cashier&apos;s Copy
              </Text>
            </Pressable>
            <Pressable
              onPress={onSecondAction}
              style={[styles.actionButton, styles.actionButtonSecondary]}
            >
              <Text style={styles.actionButtonSecondaryText}>
                Customer&apos;s Copy
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  modal: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
  },
  closeText: {
    fontSize: 20,
    color: '#ef4444',
    lineHeight: 20,
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonPrimary: {
    backgroundColor: '#0064c2',
  },
  actionButtonSecondary: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#0064c2',
  },
  actionButtonPrimaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  actionButtonSecondaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0064c2',
  },
});