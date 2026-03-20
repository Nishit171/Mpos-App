import React from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import QuickBillingHomePage from "./src/components/sections/quick-billing/QuickBillingHomePage";
import LoginComponent from "./src/components/sections/login/login-component";
import { CartProvider } from "./src/context/cart-context";
import { AuthProvider, useAuth } from "./src/context/auth-context";

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

