import { BASE_URL } from "../constants/config";
import { getToken } from "../../utils/storage/tokenStorage";

// Search customers
export const searchCustomers = async (name: string, mobileNum: string) => {
  try {
    const token = await getToken();
    if (!token) {
      throw new Error("No access token found");
    }

    const response = await fetch(`${BASE_URL}/lumepos/ws/ftk/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: name || "",
        mobileNum: mobileNum || "",
      }),
    });

    const data = await response.json();
    return { success: data.status === "success", data };
  } catch (error) {
    console.error("Error searching customers:", error);
    return { success: false, error: "Failed to search customers" };
  }
};

// Save customer
export const saveCustomer = async (customerData: any) => {
  try {
    const token = await getToken();
    if (!token) {
      throw new Error("No access token found");
    }

    const response = await fetch(`${BASE_URL}/lumepos/ws/ftk/saveCustomer`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(customerData),
    });

    const data = await response.json();
    return { success: response.ok, data };
  } catch (error) {
    console.error("Error saving customer:", error);
    return { success: false, error: "Failed to save customer" };
  }
}; 