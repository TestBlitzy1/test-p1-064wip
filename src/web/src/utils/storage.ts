import CryptoJS from 'crypto-js'; // v4.2.0

// Storage namespace prefix to avoid conflicts with other applications
const STORAGE_PREFIX = 'sip_';

// Encryption key from environment variables
const ENCRYPTION_KEY = process.env.NEXT_PUBLIC_STORAGE_ENCRYPTION_KEY;

// Keys that require encryption for sensitive data
const SENSITIVE_KEYS = ['auth_token', 'refresh_token', 'user'];

/**
 * Encrypts sensitive data using AES encryption
 * @param data - String data to encrypt
 * @returns Encrypted data string
 * @throws Error if encryption key is not available
 */
const encryptData = (data: string): string => {
  if (!ENCRYPTION_KEY) {
    throw new Error('Storage encryption key is not configured');
  }
  return CryptoJS.AES.encrypt(data, ENCRYPTION_KEY).toString();
};

/**
 * Decrypts sensitive data using AES decryption
 * @param encryptedData - Encrypted string to decrypt
 * @returns Decrypted data string
 * @throws Error if encryption key is not available
 */
const decryptData = (encryptedData: string): string => {
  if (!ENCRYPTION_KEY) {
    throw new Error('Storage encryption key is not configured');
  }
  const bytes = CryptoJS.AES.decrypt(encryptedData, ENCRYPTION_KEY);
  return bytes.toString(CryptoJS.enc.Utf8);
};

/**
 * Stores data in local storage with optional encryption for sensitive data
 * @param key - Storage key
 * @param value - Value to store
 * @throws Error if storage operation fails
 */
export const setItem = <T>(key: string, value: T): void => {
  try {
    const storageKey = `${STORAGE_PREFIX}${key}`;
    const stringValue = JSON.stringify(value);
    
    const valueToStore = SENSITIVE_KEYS.includes(key) 
      ? encryptData(stringValue)
      : stringValue;
      
    localStorage.setItem(storageKey, valueToStore);
  } catch (error) {
    console.error(`Error storing data for key ${key}:`, error);
    throw new Error('Failed to store data in local storage');
  }
};

/**
 * Retrieves and optionally decrypts data from local storage
 * @param key - Storage key
 * @returns Retrieved value of type T or null if not found
 * @throws Error if retrieval or decryption fails
 */
export const getItem = <T>(key: string): T | null => {
  try {
    const storageKey = `${STORAGE_PREFIX}${key}`;
    const value = localStorage.getItem(storageKey);
    
    if (!value) {
      return null;
    }

    const parsedValue = SENSITIVE_KEYS.includes(key)
      ? decryptData(value)
      : value;
      
    return JSON.parse(parsedValue) as T;
  } catch (error) {
    console.error(`Error retrieving data for key ${key}:`, error);
    throw new Error('Failed to retrieve data from local storage');
  }
};

/**
 * Removes item from local storage
 * @param key - Storage key to remove
 * @throws Error if removal fails
 */
export const removeItem = (key: string): void => {
  try {
    const storageKey = `${STORAGE_PREFIX}${key}`;
    localStorage.removeItem(storageKey);
  } catch (error) {
    console.error(`Error removing data for key ${key}:`, error);
    throw new Error('Failed to remove data from local storage');
  }
};

/**
 * Clears all application-specific items from local storage
 * @throws Error if clearing fails
 */
export const clear = (): void => {
  try {
    const keys = Object.keys(localStorage);
    const appKeys = keys.filter(key => key.startsWith(STORAGE_PREFIX));
    
    appKeys.forEach(key => {
      localStorage.removeItem(key);
    });
  } catch (error) {
    console.error('Error clearing storage:', error);
    throw new Error('Failed to clear local storage');
  }
};