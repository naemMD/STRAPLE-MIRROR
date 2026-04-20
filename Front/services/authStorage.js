import { Platform } from 'react-native';
import { jwtDecode } from "jwt-decode";
import Constants from 'expo-constants';
import axios from 'axios';

let SecureStore = null;
if (Platform.OS !== 'web') {
  SecureStore = require('expo-secure-store');
}

const API_URL = Constants.expoConfig?.extra?.API_URL ?? '';
const TOKEN_KEY = 'authToken';

// Cross-platform storage helpers
const storageGet = async (key) => {
  if (Platform.OS === 'web') {
    return localStorage.getItem(key);
  }
  return await SecureStore.getItemAsync(key);
};

const storageSet = async (key, value) => {
  if (Platform.OS === 'web') {
    localStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
};

const storageDelete = async (key) => {
  if (Platform.OS === 'web') {
    localStorage.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
};

export const getUserDetails = async () => {
  try {
    const token = await storageGet(TOKEN_KEY);
    if (!token) return null;

    const decoded = jwtDecode(token);

    // Check if token is expired before making API call
    const now = Date.now() / 1000;
    if (decoded.exp && decoded.exp < now) {
      console.log('Token expired, clearing session');
      await storageDelete(TOKEN_KEY);
      return null;
    }

    const userId = decoded.userId;
    const response = await axios.get(`${API_URL}/users/me/${userId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.status === 200) {
      console.log('User details fetched successfully');
      return response.data;
    } else {
      console.log('Failed to fetch user details');
      return null;
    }

  } catch (error) {
    console.log('Error retrieving session:', error);
    // Clear invalid token to prevent stale sessions
    await storageDelete(TOKEN_KEY);
    return null;
  }
};

export const getToken = async () => {
  try {
    const token = await storageGet(TOKEN_KEY);
    return token;
  } catch (error) {
    console.log('Error retrieving token:', error);
    return null;
  }
}

export const saveSession = async (token) => {
  try {
    await storageSet(TOKEN_KEY, token);
    console.log('Token saved successfully');
  } catch (error) {
    console.log('Error saving token:', error);
  }
};

export const clearSession = async () => {
  console.log('Deleting session...');
  try {
    await storageDelete(TOKEN_KEY);
    console.log('Session deleted');
  } catch (error) {
    console.log('Error while deleting the session:', error);
  }
};