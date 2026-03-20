import { BASE_URL } from "../constants/config";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Get axios config with auth headers
const getAxiosConfig = async () => {
  const token = await AsyncStorage.getItem("AccessToken");
  console.log("TOKEN FROM ASYNC STORAGE:", token);
  const config = {
    headers: {
      Authorization: token ? `Bearer ${token}` : "",
      Accept: "application/json, text/plain, */*",
      "Content-Type": "application/json",
      Origin: "http://20.204.130.94:8081",
      Referer: "http://20.204.130.94:8081/",
    },
  };
  console.log("AXIOS CONFIG HEADERS:", config.headers);
  return config;
};

// Search products
export const searchProducts = async (productName: string) => {
  try {
    const axiosConfig = await getAxiosConfig();
    const response = await axios.post(
      `${BASE_URL}/lumepos/ws/searchProducts`,
      { productName },
      axiosConfig
    );
    return { success: true, data: response.data };
  } catch (error) {
    console.error("Error searching products:", error);
    return { success: false, error: "Failed to search products" };
  }
};

// Get products from category
export const getProductsFromCategory = async (deptnmbr: string) => {
  try {
    const axiosConfig = await getAxiosConfig();
    const response = await axios.post(
      `${BASE_URL}/lumepos/ws/getProductsFromCategorie`,
      { deptnmbr },
      axiosConfig
    );
    return { success: true, data: response.data };
  } catch (error) {
    console.error("Error getting products from category:", error);
    return { success: false, error: "Failed to get products from category" };
  }
};

// Get multiple products by barcode
export const getMultipleProducts = async (barcodeData: string[]) => {
  try {
    const axiosConfig = await getAxiosConfig();
    const payload = { data: barcodeData };
    console.log("API REQUEST START");
    console.log("REQUEST URL:", `${BASE_URL}/lumepos/ws/getMultipleProducts`);
    console.log("REQUEST PAYLOAD:", payload);
    console.log("REQUEST HEADERS:", axiosConfig.headers);
    const response = await axios.post(
      `${BASE_URL}/lumepos/ws/getMultipleProducts`,
      payload,
      axiosConfig
    );
    console.log("API RESPONSE:", response);
    return { success: true, data: response.data };
  } catch (error: any) {
    console.error("PRODUCT API ERROR:", error);
    console.error("ERROR STATUS:", error?.response?.status);
    console.error("ERROR RESPONSE DATA:", error?.response?.data);
    console.error("ERROR HEADERS:", error?.response?.headers);
    return { success: false, error: "Failed to get products" };
  }
};

// Add product
export const addProduct = async (productData: any) => {
  try {
    const token = await AsyncStorage.getItem("AccessToken");
    console.log("TOKEN FROM ASYNC STORAGE (ADD PRODUCT):", token);
    const response = await axios.post(
      `${BASE_URL}/lumepos/ws/addProduct`,
      productData,
      {
        headers: {
          Authorization: token ? `Bearer ${token}` : "",
          "Content-Type": "application/json",
        },
      }
    );
    const data = response.data;
    const isFailed =
      data?.status === "failed" ||
      data?.status_code === 401 ||
      (data?.status_code && data.status_code >= 400);
    if (isFailed) {
      return {
        success: false,
        error: data?.status_message || "Failed to add product",
        data,
      };
    }
    return { success: true, data };
  } catch (error) {
    console.error("Error adding product:", error);
    return { success: false, error: "Failed to add product" };
  }
};

// Get popular categories
export const getPopularCategories = async () => {
  try {
    const axiosConfig = await getAxiosConfig();
    const response = await axios.get(
      `${BASE_URL}/lumepos/ws/popularCategories`,
      axiosConfig
    );
    return { success: true, data: response.data };
  } catch (error) {
    console.error("Error getting popular categories:", error);
    return { success: false, error: "Failed to get popular categories" };
  }
}; 