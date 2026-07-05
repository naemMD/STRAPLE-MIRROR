import { Platform } from 'react-native';

let SecureStore = null;
if (Platform.OS !== 'web') {
  SecureStore = require('expo-secure-store');
}

// Cross-platform key/value storage for non-secret app preferences.
// Mirrors the storage pattern used in services/authStorage.js
// (SecureStore on native, localStorage on web).

export const prefGet = async (key) => {
  try {
    if (Platform.OS === 'web') {
      return localStorage.getItem(key);
    }
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
};

export const prefSet = async (key, value) => {
  try {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  } catch {
    // best-effort: preferences are non-critical
  }
};

export const prefDelete = async (key) => {
  try {
    if (Platform.OS === 'web') {
      localStorage.removeItem(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  } catch {
    // best-effort
  }
};
