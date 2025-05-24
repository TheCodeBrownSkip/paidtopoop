// src/utils/identity.js
import { v4 as uuidv4 } from "uuid";

const USERNAME_KEY = 'ptp_username';
const TOKEN_KEY = 'ptp_token';
const IDENTITY_OBJECT_KEY = 'ptp_identity';

const pooPuns = [
  "SirPoopsALot", "DooDooDuke", "StoolSurfer", "BathroomBandit", "CaptainCrapper",
  "TheLooTenant", "PorcelainPrince", "RoyalFlush", "CodeBrownCommando", "LogLady",
  "FlushGordon", "PooNinja", "ThroneMaster", "DigestiveDynamo", "SepticSage",
  "BowlCommander", "LoomeisterGeneral", "TheExcrementExpert", "WasteWizard"
];

// Returns existing identity or { username: null, token: null }
export function getIdentity() {
  if (typeof window === "undefined") {
    return { username: null, token: null };
  }

  const identityObjectString = localStorage.getItem(IDENTITY_OBJECT_KEY);
  if (identityObjectString) {
    try {
      const identityObject = JSON.parse(identityObjectString);
      if (identityObject && identityObject.username && identityObject.token) {
        // Sync individual keys if they exist and are different (for older versions/consistency)
        if (localStorage.getItem(USERNAME_KEY) !== identityObject.username) {
            localStorage.setItem(USERNAME_KEY, identityObject.username);
        }
        if (localStorage.getItem(TOKEN_KEY) !== identityObject.token) {
            localStorage.setItem(TOKEN_KEY, identityObject.token);
        }
        return identityObject;
      }
    } catch (e) { /* Malformed, will fall through */ }
  }

  // Fallback to individual keys if object not found or invalid
  const username = localStorage.getItem(USERNAME_KEY);
  const token = localStorage.getItem(TOKEN_KEY);

  if (username && token) {
    const existingIdentity = { username, token };
    // Ensure combined object is stored if it was missing
    localStorage.setItem(IDENTITY_OBJECT_KEY, JSON.stringify(existingIdentity));
    return existingIdentity;
  }

  return { username: null, token: null }; // No identity found
}

// Generates, stores, and returns a NEW identity
export function generateAndStoreIdentity() {
  if (typeof window === "undefined") return { username: null, token: null };

  const pun = pooPuns[Math.floor(Math.random() * pooPuns.length)];
  const randomSuffix = Math.random().toString(36).substring(2, 6); // 4 random alphanumeric chars
  // Format: PunName-Suffix
  const username = `${pun}-${randomSuffix}`; 
  const token = uuidv4(); 
  
  const newIdentity = { username, token };
  localStorage.setItem(USERNAME_KEY, username);
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(IDENTITY_OBJECT_KEY, JSON.stringify(newIdentity));
  console.log("Generated and stored new identity:", newIdentity);
  return newIdentity;
}

// Stores a provided identity (e.g., after recovery)
export function storeIdentity(identity) {
  if (typeof window === "undefined") return;
  if (identity && identity.username && identity.token) {
    localStorage.setItem(USERNAME_KEY, identity.username);
    localStorage.setItem(TOKEN_KEY, identity.token);
    localStorage.setItem(IDENTITY_OBJECT_KEY, JSON.stringify(identity));
  } else {
    console.error("storeIdentity: Invalid identity object provided.", identity);
  }
}

// Clears all identity keys from localStorage
export function clearIdentity() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(USERNAME_KEY);
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(IDENTITY_OBJECT_KEY);
}

// Optional: Direct getter for the combined object
export function getStoredIdentityObject() {
    // ... (same as your previous correct version)
    if (typeof window === "undefined") return null;
    const identityString = localStorage.getItem(IDENTITY_OBJECT_KEY);
    if (identityString) {
        try {
            const parsed = JSON.parse(identityString);
            if (parsed && parsed.username && parsed.token) return parsed;
            return null;
        } catch (e) { return null; }
    }
    return null;
}