import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Image,
  ScrollView,
} from "react-native";
import { useAuth } from "../../../context/auth-context";
import { generateOtp, loginWithOtp } from "../../../services/api/AuthApi";

const LoginComponent = () => {
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [showOtp, setShowOtp] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  // Timer states for resend OTP
  const [resendTimer, setResendTimer] = useState(0);
  const [isResendDisabled, setIsResendDisabled] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { login } = useAuth();

  // Start the resend timer
  const startResendTimer = () => {
    setResendTimer(30);
    setIsResendDisabled(true);
    timerRef.current = setInterval(() => {
      setResendTimer(prev => {
        if (prev <= 1) {
          setIsResendDisabled(false);
          if (timerRef.current) {
            clearInterval(timerRef.current);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Clear timer on component unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const handleSendOtp = async () => {
    if (!mobile.trim()) {
      setError("Please enter your mobile number");
      return;
    }
    if (!/^[6-9]\d{9}$/.test(mobile)) {
      setError("Please enter a valid Indian mobile number (10 digits, starts with 6-9)");
      return;
    }
    setIsLoading(true);
    setError("");
    setSuccess("");
    try {
      const result = await generateOtp(`+91${mobile}`);
      if (result.success) {
        setSuccess("OTP has been sent to your mobile number successfully!");
        setShowOtp(true);
        // Start the resend timer
        startResendTimer();
      } else {
        const errorMsg = result.data?.message || "Failed to send OTP";
        setError(errorMsg);
      }
    } catch (err) {
      const errorMsg = "Network error. Please try again.";
      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (isResendDisabled) return;
    setIsLoading(true);
    setError("");
    setSuccess("");
    try {
      const result = await generateOtp(`+91${mobile}`);
      if (result.success) {
        setSuccess("OTP has been resent to your mobile number!");
        // Clear the current OTP and start timer again
        setOtp("");
        startResendTimer();
      } else {
        const errorMsg = result.data?.message || "Failed to resend OTP";
        setError(errorMsg);
      }
    } catch (err) {
      const errorMsg = "Network error. Please try again.";
      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpComplete = (otpValue: string) => {
    setOtp(otpValue);
  };

  const handleLogin = async () => {
    if (!otp.trim() || otp.length !== 4) {
      setError("Please enter the complete 4-digit OTP");
      return;
    }
    setIsLoading(true);
    setError("");
    setSuccess("");
    try {
      const result = await loginWithOtp(`+91${mobile}`, otp);
      if (result.success && result.data) {
        const user = result.data.user || {};
        const token =
          result.data.token ||
          result.data.accessToken ||
          result.data.AccessToken ||
          result.data.data?.AccessToken ||
          user.token;

        if (token) {
          await login(String(token), user);
          console.log("LOGIN SUCCESS");
          console.log("TOKEN SAVED:", token);
        }

        setSuccess("Login successful! Redirecting to Quick MPOS...");
        // Clear timer on successful login
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
      } else {
        const errorMsg = result.data?.message || "Invalid OTP. Please try again.";
        setError(errorMsg);
        setIsLoading(false);
      }
    } catch (err) {
      const errorMsg = "Network error. Please try again.";
      setError(errorMsg);
      setIsLoading(false);
    }
  };

  const handleChangeNumber = () => {
    setShowOtp(false);
    setOtp("");
    setError("");
    setSuccess("");
    // Clear timer when changing number
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    setResendTimer(0);
    setIsResendDisabled(false);
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.card}>
        {/* Header */}
        <View style={styles.header}>
          <Image
            source={{
              uri: "https://apeiros.blob.core.windows.net/store-images/lume_logo.png",
            }}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.title}>Sign In</Text>
          <Text style={styles.subtitle}>
            {showOtp ? "Enter the verification code" : "Welcome to Lume POS !"}
          </Text>
          {showOtp && (
            <Text style={styles.infoText}>
              We've sent a 4-digit code to{" "}
              <Text style={styles.infoHighlight}>+91{mobile}</Text>
            </Text>
          )}
        </View>

        {/* Success Message */}
        {success ? (
          <View style={styles.successBox}>
            <Text style={styles.successTitle}>Success</Text>
            <Text style={styles.successMessage}>{success}</Text>
          </View>
        ) : null}

        {/* Error Message */}
        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>Error</Text>
            <Text style={styles.errorMessage}>{error}</Text>
          </View>
        ) : null}

        {!showOtp ? (
          <View style={styles.section}>
            <Text style={styles.label}>Mobile Number</Text>
            <View style={styles.mobileRow}>
              <Text style={styles.countryCode}>+91</Text>
              <TextInput
                style={styles.mobileInput}
                value={mobile}
                onChangeText={value => {
                  let v = value.replace(/\D/g, "");
                  if (v.length === 1 && !/[6-9]/.test(v)) {
                    v = "";
                  }
                  if (v.length > 10) v = v.slice(0, 10);
                  setMobile(v);
                }}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                placeholder="Enter Mobile Number"
                keyboardType="number-pad"
                maxLength={10}
                editable={!isLoading}
              />
            </View>
            <Text style={styles.helperText}>Enter 10-digit mobile number</Text>

            <Pressable
              onPress={handleSendOtp}
              disabled={isLoading || mobile.length !== 10}
              style={[
                styles.primaryButton,
                (isLoading || mobile.length !== 10) && styles.buttonDisabled,
              ]}
            >
              {isLoading ? (
                <>
                  <ActivityIndicator size="small" color="#ffffff" />
                  <Text style={styles.primaryButtonText}>Sending OTP...</Text>
                </>
              ) : (
                <Text style={styles.primaryButtonText}>Send OTP</Text>
              )}
            </Pressable>
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={styles.label}>Enter 4-Digit Verification Code</Text>
            <TextInput
              style={styles.otpInput}
              value={otp}
              onChangeText={value => {
                const v = value.replace(/\D/g, "").slice(0, 4);
                setOtp(v);
                handleOtpComplete(v);
              }}
              keyboardType="number-pad"
              maxLength={4}
              editable={!isLoading}
            />

            <View style={styles.resendContainer}>
              <Text style={styles.helperText}>Didn't receive the code?</Text>
              <Pressable
                onPress={handleResendOtp}
                disabled={isLoading || isResendDisabled}
              >
                <Text
                  style={[
                    styles.resendText,
                    (isLoading || isResendDisabled) && styles.resendDisabled,
                  ]}
                >
                  {isResendDisabled
                    ? `Resend OTP in ${resendTimer}s`
                    : "Resend OTP"}
                </Text>
              </Pressable>
            </View>

            <Pressable
              onPress={handleLogin}
              disabled={isLoading || otp.length !== 4}
              style={[
                styles.primaryButton,
                (isLoading || otp.length !== 4) && styles.buttonDisabled,
              ]}
            >
              {isLoading ? (
                <>
                  <ActivityIndicator size="small" color="#ffffff" />
                  <Text style={styles.primaryButtonText}>Verifying...</Text>
                </>
              ) : (
                <Text style={styles.primaryButtonText}>Verify & Sign In</Text>
              )}
            </Pressable>

            <Pressable onPress={handleChangeNumber} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Change Mobile Number</Text>
            </Pressable>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            <Text style={styles.footerRequired}>*</Text>I agree to Apeiros AI Pvt Ltd T&Cs and
            Privacy Policy
          </Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: "#f9fafb",
    paddingHorizontal: 16,
    paddingVertical: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  header: {
    alignItems: "center",
    marginBottom: 16,
  },
  logo: {
    width: 120,
    height: 60,
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#000000",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: "500",
    color: "#4b5563",
  },
  infoText: {
    marginTop: 8,
    fontSize: 13,
    color: "#6b7280",
    textAlign: "center",
  },
  infoHighlight: {
    color: "#0064c2",
    fontWeight: "600",
  },
  successBox: {
    marginBottom: 12,
    padding: 10,
    borderRadius: 8,
    backgroundColor: "#ecfdf3",
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  successTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#166534",
    marginBottom: 2,
  },
  successMessage: {
    fontSize: 13,
    color: "#166534",
  },
  errorBox: {
    marginBottom: 12,
    padding: 10,
    borderRadius: 8,
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#b91c1c",
    marginBottom: 2,
  },
  errorMessage: {
    fontSize: 13,
    color: "#b91c1c",
  },
  section: {
    marginTop: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
    marginBottom: 6,
  },
  mobileRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    paddingHorizontal: 10,
    backgroundColor: "#ffffff",
  },
  countryCode: {
    fontSize: 14,
    color: "#6b7280",
    marginRight: 4,
  },
  mobileInput: {
    flex: 1,
    height: 44,
    fontSize: 14,
    color: "#111827",
  },
  helperText: {
    marginTop: 4,
    fontSize: 12,
    color: "#6b7280",
  },
  primaryButton: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#0064c2",
    gap: 8,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ffffff",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  otpInput: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    fontSize: 18,
    letterSpacing: 16,
    textAlign: "center",
    color: "#111827",
  },
  resendContainer: {
    marginTop: 12,
    alignItems: "center",
  },
  resendText: {
    fontSize: 14,
    color: "#0064c2",
    fontWeight: "500",
  },
  resendDisabled: {
    color: "#9ca3af",
  },
  secondaryButton: {
    marginTop: 12,
    paddingVertical: 10,
    alignItems: "center",
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#0064c2",
  },
  footer: {
    marginTop: 16,
    alignItems: "center",
  },
  footerText: {
    fontSize: 12,
    color: "#4b5563",
    textAlign: "center",
  },
  footerRequired: {
    color: "#ef4444",
    marginRight: 2,
  },
});

export default LoginComponent;
