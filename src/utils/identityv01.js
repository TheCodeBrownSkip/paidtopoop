// src/utils/identity.js
import { v4 as uuidv4 } from "uuid";

const USERNAME_KEY = 'ptp_username'; // Using your existing keys for username/token
const TOKEN_KEY = 'ptp_token';
const IDENTITY_OBJECT_KEY = 'ptp_identity'; // For storing the {username, token} object

const pooPuns = [
  "SirPoopsALot",
  "DooDooDuke",
  "StoolSurfer",
  "BathroomBandit",
  "CaptainCrapper",
  "TheLooTenant",
  "PorcelainPrince",
  "RoyalFlush",
  "CodeBrownCommando",
  "LogLady", // For inclusivity ;)
];

export function getIdentity() {
  if (typeof window === "undefined") {
    // console.log("getIdentity called on server, returning null identity.");
    return { username: null, token: null };
  }

  let username = localStorage.getItem(USERNAME_KEY);
  let token = localStorage.getItem(TOKEN_KEY);
  let identityObjectString = localStorage.getItem(IDENTITY_OBJECT_KEY);
  let identityObject = null;

  if (identityObjectString) {
    try {
      identityObject = JSON.parse(identityObjectString);
      // Validate if the parsed object has the expected structure
      if (identityObject && identityObject.username && identityObject.token) {
        // If object exists and is valid, ensure individual keys are also synced
        if (username !== identityObject.username) {
          localStorage.setItem(USERNAME_KEY, identityObject.username);
          username = identityObject.username;
        }
        if (token !== identityObject.token) {
          localStorage.setItem(TOKEN_KEY, identityObject.token);
          token = identityObject.token;
        }
        // console.log("Retrieved identity from ptp_identity object:", identityObject);
        return identityObject;
      } else {
        // Parsed object is invalid, clear it and proceed to generate/get from individual keys
        localStorage.removeItem(IDENTITY_OBJECT_KEY);
        identityObject = null; // Reset
      }
    } catch (e) {
      console.error("Error parsing ptp_identity from localStorage, clearing it.", e);
      localStorage.removeItem(IDENTITY_OBJECT_KEY);
      identityObject = null; // Reset
    }
  }

  // If ptp_identity wasn't found or was invalid, try individual keys
  if (!username || !token) {
    username = pooPuns[Math.floor(Math.random() * pooPuns.length)] + Math.floor(Math.random() * 100); // Added number for more uniqueness
    token = uuidv4(); // Your existing token generation
    
    localStorage.setItem(USERNAME_KEY, username);
    localStorage.setItem(TOKEN_KEY, token);
    // Also store the combined object
    const newIdentity = { username, token };
    localStorage.setItem(IDENTITY_OBJECT_KEY, JSON.stringify(newIdentity));
    // console.log("Generated and stored new identity:", newIdentity);
    return newIdentity;
  } else {
    // Individual keys found, but ptp_identity object was missing or invalid. Create it now.
    const existingIdentity = { username, token };
    if (!identityObject) { // Only set if it wasn't successfully retrieved above
        localStorage.setItem(IDENTITY_OBJECT_KEY, JSON.stringify(existingIdentity));
    }
    // console.log("Retrieved identity from individual keys and synced object:", existingIdentity);
    return existingIdentity;
  }
}

export function storeIdentity(identity) {
  if (typeof window === "undefined") return;

  if (identity && identity.username && identity.token) {
    localStorage.setItem(USERNAME_KEY, identity.username);
    localStorage.setItem(TOKEN_KEY, identity.token);
    localStorage.setItem(IDENTITY_OBJECT_KEY, JSON.stringify(identity));
    // console.log("Stored identity via storeIdentity():", identity);
  } else {
    console.error("storeIdentity: Invalid identity object provided.", identity);
  }
}

export function clearIdentity() {
  if (typeof window === "undefined") return;

  localStorage.removeItem(USERNAME_KEY);
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(IDENTITY_OBJECT_KEY);
  // Note: User-specific rate (e.g., `rate_USERNAME`) is cleared in the DashboardPage's logout handler
  // because this utility doesn't know the username at the point of clearing.
  // console.log("Cleared identity from localStorage via clearIdentity().");
}

// Optional: A direct getter for the object if needed elsewhere
export function getStoredIdentityObject() {
    if (typeof window === "undefined") return null;
    const identityString = localStorage.getItem(IDENTITY_OBJECT_KEY);
    if (identityString) {
        try {
            const parsed = JSON.parse(identityString);
            // Basic validation
            if (parsed && parsed.username && parsed.token) {
                return parsed;
            }
            return null; // Invalid structure
        } catch (e) {
            console.error("Error parsing stored identity object in getStoredIdentityObject", e);
            return null;
        }
    }
    return null;
}