import { BASE_URL } from "../constants/config";
import axios from "axios";
import { getToken } from "../../utils/storage/tokenStorage";

// Get axios config with auth headers
const getAxiosConfig = async () => {
  const token = await getToken();
  return {
    headers: {
      Authorization: token ? `Bearer ${token}` : "",
      Accept: "application/json, text/plain, */*",
      "Content-Type": "application/json",
    },
  };
};

// Place order
export const placeOrder = async (orderPayload: any) => {
  try {
    const axiosConfig = await getAxiosConfig();
    const response = await axios.post(
      `${BASE_URL}/lumepos/ws/placeOrder`,
      orderPayload,
      axiosConfig
    );
    return { success: true, data: response.data };
  } catch (error) {
    console.error("Error placing order:", error);
    return { success: false, error: "Failed to place order" };
  }
};

// Refresh cart
export const refreshCart = async (input: any) => {
  try {
    const axiosConfig = await getAxiosConfig();
    const response = await axios.post(
      `${BASE_URL}/lumepos/ws/refreshCart`,
      input,
      axiosConfig
    );
    return { success: true, data: response.data };
  } catch (error) {
    console.error("Error refreshing cart:", error);
    return { success: false, error: "Failed to refresh cart" };
  }
};

// Validate credit note
export const validateCreditNote = async (creditNoteData: any) => {
  try {
    const token = await getToken();
    const response = await fetch(`${BASE_URL}/lumepos/ws/validateCreditNote`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(creditNoteData),
    });
    const data = await response.json();
    return { success: response.ok, data };
  } catch (error) {
    console.error("Error validating credit note:", error);
    return { success: false, error: "Failed to validate credit note" };
  }
};

// Get UPI ID
export const getUpiId = async () => {
  try {
    const token = await getToken();
    const response = await fetch(`${BASE_URL}/lumepos/ws/getUpiId`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
    const data = await response.json();
    return { success: response.ok, data };
  } catch (error) {
    console.error("Error getting UPI ID:", error);
    return { success: false, error: "Failed to get UPI ID" };
  }
};

// Save UPI
export const saveUpi = async (upiData: any) => {
  try {
    const token = await getToken();
    const response = await fetch(`${BASE_URL}/lumepos/ws/saveUpi`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(upiData),
    });
    const data = await response.json();
    return { success: response.ok, data };
  } catch (error) {
    console.error("Error saving UPI:", error);
    return { success: false, error: "Failed to save UPI" };
  }
};

// Send e-bill
export const sendEbill = async (payload: any) => {
  try {
    const token = await getToken();

    const response = await axios.post(`${BASE_URL}/lumepos/ws/sendEbill`, payload, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
    return { success: true, data: response.data };
  } catch (error) {
    console.error("Error sending e-bill:", error);
    return { success: false, error: "Failed to send e-bill" };
  }
};

// Get GST number (for Tax Invoice check)
export const getGst = async () => {
  try {
    const axiosConfig = await getAxiosConfig();
    const response = await axios.get(`${BASE_URL}/lumepos/ws/gst`, axiosConfig);
    const data = response.data;
    const gstNumber = typeof data?.data === "string" ? data.data.trim() : "";
    return { success: data?.status === "SUCCESS", data: gstNumber, raw: data };
  } catch (error) {
    console.error("Error fetching GST:", error);
    return { success: false, data: "", error: "Failed to fetch GST" };
  }
};

// Save GST number (CIN/GST)
export const saveGst = async (cinNo: string) => {
  try {
    const axiosConfig = await getAxiosConfig();
    const response = await axios.post(
      `${BASE_URL}/lumepos/ws/gst`,
      { cinNo: cinNo.trim() },
      axiosConfig
    );
    const data = response.data;
    const success = data?.status === "SUCCESS" && data?.message?.toLowerCase().includes("saved");
    return { success: !!success, data };
  } catch (error) {
    console.error("Error saving GST:", error);
    return { success: false, error: "Failed to save GST" };
  }
};

// Order payment
export const orderPayment = async (paymentData: any) => {
  try {
    const axiosConfig = await getAxiosConfig();
    const response = await axios.post(
      `${BASE_URL}/lumepos/ws/orderPayment`,
      paymentData,
      axiosConfig
    );
    return { success: true, data: response.data };
  } catch (error) {
    console.error("Error processing order payment:", error);
    return { success: false, error: "Failed to process order payment" };
  }
}; 