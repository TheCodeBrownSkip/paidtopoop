// src/utils/identity.js
import { v4 as uuidv4 } from "uuid";

const USERNAME_KEY = 'ptp_username';
const TOKEN_KEY = 'ptp_token';
const IDENTITY_OBJECT_KEY = 'ptp_identity'; // For storing the {username, token} object

const pooPuns = [
  "SirPoopsALot", "DooDooDuke", "StoolSurfer", "BathroomBandit", "CaptainCrapper",
  "TheLooTenant", "PorcelainPrince", "RoyalFlush", "CodeBrownCommando", "LogLady",
  "FlushGordon", "PooNinja", "ThroneMaster", "DigestiveDynamo", "SepticSage",
  "BowlCommander", "LoomeisterGeneral", "TheExcrementExpert", "WasteWizard"
];

export function getIdentity() {
  if (typeof window === "undefined") {
    return { username: null, token: null };
  }

  let username = localStorage.getItem(USERNAME_KEY);
  let token = localStorage.getItem(TOKEN_KEY);
  let identityObjectString = localStorage.getItem(IDENTITY_OBJECT_KEY);
  
  if (identityObjectString) {
    try {
      const identityObject = JSON.parse(identityObjectString);
      if (identityObject && identityObject.username && identityObject.token) {
        // Ensure individual keys are synced if object is primary source
        if (username !== identityObject.username) {
          localStorage.setItem(USERNAME_KEY, identityObject.username);
        }
        if (token !== identityObject.token) {
          localStorage.setItem(TOKEN_KEY, identityObject.token);
        }
        // console.log("Retrieved identity from ptp_identity object:", identityObject);
        return identityObject;
      } else {
        // Parsed object is invalid, remove it and proceed
        localStorage.removeItem(IDENTITY_OBJECT_KEY);
      }
    } catch (e) {
      console.error("Error parsing ptp_identity from localStorage, removing it.", e);
      localStorage.removeItem(IDENTITY_OBJECT_KEY);
    }
  }

  // If ptp_identity wasn't found/valid, or if individual keys are missing, generate new.
  if (!username || !token) {
    const pun = pooPuns[Math.floor(Math.random() * pooPuns.length)];
    // Append a few random alphanumeric characters to make names more unique
    const randomSuffix = Math.random().toString(36).substring(2, 6); 
    username = `${pun}${randomSuffix}`;
    token = uuidv4(); // Generate a new UUID for the token
    
    const newIdentity = { username, token };
    localStorage.setItem(USERNAME_KEY, username);
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(IDENTITY_OBJECT_KEY, JSON.stringify(newIdentity));
    // console.log("Generated and stored new identity:", newIdentity);
    return newIdentity;
  } else {
    // Individual keys found, but ptp_identity object might have been missing. Ensure it's set.
    const existingIdentity = { username, token };
    localStorage.setItem(IDENTITY_OBJECT_KEY, JSON.stringify(existingIdentity)); // Sync/create the object
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
  // console.log("Cleared identity from localStorage via clearIdentity().");
}

// Optional: A direct getter for the object if needed elsewhere
export function getStoredIdentityObject() {
    if (typeof window === "undefined") return null;
    const identityString = localStorage.getItem(IDENTITY_OBJECT_KEY);
    if (identityString) {
        try {
            const parsed = JSON.parse(identityString);
            if (parsed && parsed.username && parsed.token) { // Basic validation
                return parsed;
            }
            return null;
        } catch (e) {
            console.error("Error parsing stored identity object in getStoredIdentityObject", e);
            return null;
        }
    }
    return null;
}