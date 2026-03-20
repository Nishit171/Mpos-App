import AsyncStorage from '@react-native-async-storage/async-storage';

export const getToken = async () => {
  return await AsyncStorage.getItem('AccessToken');
};

export const setToken = async (token: string) => {
  await AsyncStorage.setItem('AccessToken', token);
};

export const removeToken = async () => {
  await AsyncStorage.removeItem('AccessToken');
};

