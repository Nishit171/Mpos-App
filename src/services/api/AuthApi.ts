import { BASE_URL } from "../constants/config";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Generate OTP for login
export const generateOtp = async (mobileNumber: string) => {
  try {
    const payload = { mobileNumber };
    console.log("GENERATE OTP REQUEST:", payload);
    const headers = {
      "Content-Type": "application/json",
      Accept: "application/json, text/plain, */*",
      Origin: "http://20.204.130.94:8081",
      Referer: "http://20.204.130.94:8081/",
    };
    console.log("GENERATE OTP HEADERS:", headers);
    const response = await fetch(`${BASE_URL}/lumepos/ws/generateOtp`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    console.log("GENERATE OTP RESPONSE:", data);
    return { success: response.ok && data.status === "SUCCESS", data };
  } catch (error) {
    console.error("GENERATE OTP ERROR:", error);
    return { success: false, error: "Network error. Please try again." };
  }
};

// Login with OTP
export const loginWithOtp = async (RMN: string, OTP: string) => {
  try {
    const payload = { RMN, OTP };
    console.log("LOGIN REQUEST PAYLOAD:", payload);
    const headers = {
      "Content-Type": "application/json",
      Accept: "application/json, text/plain, */*",
      Origin: "http://20.204.130.94:8081",
      Referer: "http://20.204.130.94:8081/",
    };
    console.log("LOGIN HEADERS:", headers);
    const response = await fetch(`${BASE_URL}/lumepos/ws/login`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    console.log("LOGIN RESPONSE RAW:", data);

    // Try to extract token and org details from common shapes
    const user = (data && (data.user || data.data?.user)) || {};
    const token =
      data?.token ||
      data?.accessToken ||
      data?.AccessToken ||
      data?.data?.AccessToken ||
      user?.token;

    if (token) {
      try {
        await AsyncStorage.setItem("AccessToken", String(token));
        if (user.orgName) {
          await AsyncStorage.setItem("orgName", String(user.orgName));
        }
        if (user.storeName) {
          await AsyncStorage.setItem("storeName", String(user.storeName));
        }
        if (user.tenantId) {
          await AsyncStorage.setItem("tenantId", String(user.tenantId));
        }
        console.log("LOGIN SUCCESS");
        console.log("TOKEN SAVED:", token);
      } catch (storageError) {
        console.error("FAILED TO SAVE LOGIN DATA TO ASYNC STORAGE:", storageError);
      }
    } else {
      console.warn("LOGIN RESPONSE DID NOT CONTAIN A TOKEN");
    }

    return { success: response.ok && (data.success ?? !!token), data };
  } catch (error) {
    console.error("LOGIN ERROR:", error);
    return { success: false, error: "Network error. Please try again." };
  }
};

// Verify device OTP
export const verifyDeviceOtp = async (deviceId: string, otp: string) => {
  try {
    const response = await fetch("/api/auth/verify-device", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId, otp }),
    });
    const data = await response.json();
    return { success: response.ok, data };
  } catch (error) {
    return { success: false, error: "Network error. Please try again." };
  }
};

// Verify auth token
export const verifyAuth = async () => {
  try {
    const response = await fetch("/api/auth/verify", {
      credentials: "include",
    });
    if (response.ok) {
      const userData = await response.json();
      return { success: true, data: userData };
    }
    return { success: false };
  } catch (error) {
    return { success: false, error: "Network error. Please try again." };
  }
}; 