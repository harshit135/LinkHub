import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const KEYS = {
  accessToken: 'lh_access_token',
  refreshToken: 'lh_refresh_token',
  email: 'lh_email',
};

// SecureStore is unavailable on web — fall back to localStorage
async function setItem(key, value) {
  if (Platform.OS === 'web') {
    localStorage.setItem(key, value);
    return;
  }
  return SecureStore.setItemAsync(key, value);
}

async function getItem(key) {
  if (Platform.OS === 'web') {
    return localStorage.getItem(key) ?? null;
  }
  return SecureStore.getItemAsync(key);
}

async function removeItem(key) {
  if (Platform.OS === 'web') {
    localStorage.removeItem(key);
    return;
  }
  return SecureStore.deleteItemAsync(key);
}

export async function saveTokens(accessToken, refreshToken) {
  await setItem(KEYS.accessToken, accessToken);
  await setItem(KEYS.refreshToken, refreshToken);
}

export function getAccessToken() {
  return getItem(KEYS.accessToken);
}

export function getRefreshToken() {
  return getItem(KEYS.refreshToken);
}

export async function saveEmail(email) {
  await setItem(KEYS.email, email);
}

export function getEmail() {
  return getItem(KEYS.email);
}

export async function clearTokens() {
  await Promise.all([
    removeItem(KEYS.accessToken),
    removeItem(KEYS.refreshToken),
    removeItem(KEYS.email),
  ]);
}
