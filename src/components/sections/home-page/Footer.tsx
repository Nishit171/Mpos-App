import React from 'react';
import { View, Text, Pressable, StyleSheet, Linking } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Toast from 'react-native-toast-message';

export default function Footer() {
  const handleEmailPress = () => {
    Linking.openURL('mailto:support@apeirosai.com').catch(() => {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Could not open email client',
        position: 'top',
        visibilityTime: 2500,
        autoHide: true,
      });
    });
  };

  const handlePhonePress = () => {
    Linking.openURL('tel:+919724151647').catch(() => {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Could not open phone dialer',
        position: 'top',
        visibilityTime: 2500,
        autoHide: true,
      });
    });
  };

  const handleWebsitePress = () => {
    Linking.openURL('https://apeirosai.com/').catch(() => {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Could not open website',
        position: 'top',
        visibilityTime: 2500,
        autoHide: true,
      });
    });
  };

  return (
    <View style={styles.footer}>
      <Text style={styles.footerText}>
        Powered by{' '}
        <Text style={styles.linkText} onPress={handleWebsitePress}>
          Apeiros AI Private Limited
        </Text>
      </Text>
      <View style={styles.iconsContainer}>
        <Pressable onPress={handleEmailPress} style={styles.iconButton}>
          <Icon name="email" size={16} color="#0064c2" />
        </Pressable>
        <Pressable onPress={handlePhonePress} style={styles.iconButton}>
          <Icon name="phone" size={16} color="#0064c2" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    height: 32,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    zIndex: 40,
  },
  footerText: {
    fontSize: 12,
    color: '#0064c2',
  },
  linkText: {
    textDecorationLine: 'underline',
  },
  iconsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginLeft: 16,
  },
  iconButton: {
    padding: 4,
  },
});
