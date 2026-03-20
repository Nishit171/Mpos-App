import AsyncStorage from '@react-native-async-storage/async-storage';

export const saveCart = async (cart: any) => {
  try {
    if (!Array.isArray(cart)) {
      console.warn('saveCart: cart is not an array, converting to array');
      cart = [];
    }
    const serialized = JSON.stringify(cart);
    await AsyncStorage.setItem('cart', serialized);
  } catch (error) {
    console.error('saveCart: Failed to save cart', error);
    throw error; // Re-throw so caller can handle it
  }
};

export const loadCart = async () => {
  try {
    const data = await AsyncStorage.getItem('cart');
    if (!data) {
      return [];
    }
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('loadCart: Failed to load cart', error);
    return []; // Return empty array on error
  }
};

