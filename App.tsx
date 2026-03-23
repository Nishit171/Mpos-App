import React from "react";
import {
  View,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  FlatList,
  SectionList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import QuickBillingHomePage from "./src/components/sections/quick-billing/QuickBillingHomePage";
import LoginComponent from "./src/components/sections/login/login-component";
import { CartProvider } from "./src/context/cart-context";
import { AuthProvider, useAuth } from "./src/context/auth-context";

// Global keyboard/tap behavior:
// first tap should go to the pressed control instead of only dismissing keyboard.
const ensureKeyboardTapBehavior = () => {
  const applyDefault = (Component: any) => {
    Component.defaultProps = {
      ...(Component.defaultProps || {}),
      keyboardShouldPersistTaps:
        Component.defaultProps?.keyboardShouldPersistTaps || "handled",
    };
  };

  applyDefault(ScrollView);
  applyDefault(FlatList);
  applyDefault(SectionList);
};

ensureKeyboardTapBehavior();

function RootNavigator() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
  return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0064c2" />
      </View>
  );
}

  return user ? <QuickBillingHomePage /> : <LoginComponent />;
}

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <SafeAreaView style={{ flex: 1 }}>
          <RootNavigator />
        </SafeAreaView>
      </CartProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#ffffff",
  },
});

