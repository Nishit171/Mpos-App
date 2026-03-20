// API helper for Hold Order related endpoints

import { BASE_URL } from "../constants/config";
import { getToken } from "../../utils/storage/tokenStorage";

// 1. Get all hold bills
export async function getAllHoldBills() {
  const token = await getToken();
  const res = await fetch(`${BASE_URL}/lumepos/ws/getAllHoldBills`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
    },
  });
  if (!res.ok) throw new Error('Failed to fetch hold bills');
  return res.json();
}

// 2. Get hold order details
export async function getHoldOrderDetails(payload: { holdOrderId: number; billReference: string }) {
  const token = await getToken();
  const res = await fetch(`${BASE_URL}/lumepos/ws/getHoldOrderDetails`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to fetch hold order details');
  return res.json();
}

// 3. Save hold order
export async function saveHoldOrder(payload: { billReference: string; holdOrderId: number; cartItem: any[] }) {
  const token = await getToken();
  const res = await fetch(`${BASE_URL}/lumepos/ws/saveHoldOrder`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to save hold order');
  return res.json();
}

// 4. Remove hold order
export async function removeHoldOrder(payload: { holdOrderId: number }) {
  const token = await getToken();
  const res = await fetch(`${BASE_URL}/lumepos/ws/removeHoldOrder`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to remove hold order');
  return res.json();
}

// 5. Find existing hold order by name
export async function findHoldOrderByName(billReference: string) {
  const bills = await getAllHoldBills();
  return bills.find((bill: any) => bill.billReference === billReference);
}

// 6. Smart save hold order - checks if exists and updates or creates new
export async function smartSaveHoldOrder(payload: { billReference: string; cartItem: any[] }) {
  const token = await getToken();
  
  // First check if a hold order with this name already exists
  const existingOrder = await findHoldOrderByName(payload.billReference);
  
  if (existingOrder) {
    // Update existing hold order
    const res = await fetch(`${BASE_URL}/lumepos/ws/saveHoldOrder`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token ? `Bearer ${token}` : '',
      },
      body: JSON.stringify({
        billReference: payload.billReference,
        holdOrderId: existingOrder.id, // Use existing ID for update
        cartItem: payload.cartItem,
      }),
    });
    if (!res.ok) throw new Error('Failed to update hold order');
    return res.json();
  } else {
    // Create new hold order (send holdOrderId: null)
    const res = await fetch(`${BASE_URL}/lumepos/ws/saveHoldOrder`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token ? `Bearer ${token}` : '',
      },
      body: JSON.stringify({
        billReference: payload.billReference,
        holdOrderId: null, // Let backend generate new ID
        cartItem: payload.cartItem,
      }),
    });
    if (!res.ok) throw new Error('Failed to save hold order');
    return res.json();
  }
} 