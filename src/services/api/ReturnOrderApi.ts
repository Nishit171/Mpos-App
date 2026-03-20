import { BASE_URL } from '../constants/config';
import { getToken } from '../../utils/storage/tokenStorage';

const getAuthHeaders = async () => {
  const token = await getToken();
  return {
    Authorization: token ? `Bearer ${token}` : '',
    'app-access-id': '1011',
  };
};

export const getOrderDetails = async (billId: any) => {
  try {
    const formData = new FormData();
    formData.append("id", billId);

    const response = await fetch(`${BASE_URL}/lumepos/ws/getOrderDetails`, {
      method: "POST",
      headers: {
        ...(await getAuthHeaders()),
      },
      body: formData,
    });
    const json = await response.json();
    // console.log(json);
    return json;
  } catch (error) {
    console.log(error);
    return false;
  }
};

export const getReturnReasons = async () => {
  try {
    const response = await fetch(`${BASE_URL}/lumepos/ws/returnReasons`, {
      method: "GET",
      headers: await getAuthHeaders(),
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Failed to fetch return reasons:", error);
  }
};

export const getItemDetails = async (itemCode: any, billId: any) => {
  const formData = new FormData();
  formData.append("itemCode", itemCode);
  formData.append("orderId", billId);
  try {
    const response = await fetch(`${BASE_URL}/lumepos/ws/getItemDetails`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: formData,
    });
    const json = await response.json();
    return json;
  } catch (error) {
    console.log(error);
    return false;
  }
};

export const getSaveReturns = async (items: any) => {
  const data = {
    items: items.items,
    orderId: items.orderId,
    reasonId: items.reasonId,
    totalAmount: items.totalAmount,
    otherReason: items.otherReason,
  };
  try {
    const response = await fetch(`${BASE_URL}/lumepos/ws/saveReturns`, {
      method: "POST",
      headers: {
        ...(await getAuthHeaders()),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });
    const json = await response.json();
    return json;
  } catch (error) {
    console.log(error);
    return false;
  }
};

export const getvalidateQuantity = async (
  itemCode: any,
  billId: any,
  size: any
) => {
  const formData = new FormData();
  formData.append("itemCode", itemCode);
  formData.append("orderId", billId);
  formData.append("size", size);
  try {
    const response = await fetch(`${BASE_URL}/lumepos/ws/validateQuantity`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: formData,
    });
    const json = await response.json();
    return json;
  } catch (error) {
    console.log(error);
    return false;
  }
};
