---
name: react-to-native
description: Patterns for building React frontend portable to React Native / Expo for future iOS and Android apps connected to Frappe backend. Use when designing components, API layer, or state management.
---

# React → Mobile Portability Guide

## Golden Rule
Everything that touches Frappe goes through ONE API service layer.
When going mobile, only the base URL and auth mechanism change.

## API Service Layer (the bridge)
```typescript
// api/client.ts — THE single point of contact with Frappe
const BASE_URL = import.meta.env.VITE_FRAPPE_URL || "";

interface FrappeResponse<T> {
  message: T;
}

export async function frappeCall<T>(method: string, args?: object): Promise<T> {
  const res = await fetch(`${BASE_URL}/api/method/${method}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `token ${getStoredToken()}`,  // not cookies
    },
    body: args ? JSON.stringify(args) : undefined,
  });
  const data: FrappeResponse<T> = await res.json();
  return data.message;
}

export async function frappeGetList<T>(
  doctype: string, 
  filters?: object,
  fields?: string[],
  limit?: number
): Promise<T[]> {
  const params = new URLSearchParams({
    doctype,
    filters: JSON.stringify(filters || {}),
    fields: JSON.stringify(fields || ["*"]),
    limit_page_length: String(limit || 20),
  });
  const res = await fetch(`${BASE_URL}/api/resource/${doctype}?${params}`, {
    headers: { "Authorization": `token ${getStoredToken()}` },
  });
  const data = await res.json();
  return data.data;
}
```

When going mobile: change `BASE_URL` to your server URL and swap `fetch` for React Native's fetch. That's it.

## State Management
- Use **Zustand** — works identically in React and React Native
- Keep all server state in Zustand stores
- Never use React Context for server data (doesn't translate well)

```typescript
// stores/conversationStore.ts
import { create } from "zustand";
import { frappeGetList } from "../api/client";

interface ConversationStore {
  conversations: Conversation[];
  loading: boolean;
  fetch: () => Promise<void>;
}

export const useConversationStore = create<ConversationStore>((set) => ({
  conversations: [],
  loading: false,
  fetch: async () => {
    set({ loading: true });
    const data = await frappeGetList<Conversation>("Excom Conversation");
    set({ conversations: data, loading: false });
  },
}));
```

## Component Design Rules

### DO — Portable
- Flexbox for all layouts (translates 1:1 to React Native)
- Tailwind utility classes (→ NativeWind on React Native)
- Abstract navigation: wrap React Router, swap for React Navigation later
- Token-based auth stored in memory/secure storage, not cookies
- Abstract storage: `localStorage` → `AsyncStorage` swap later

### DON'T — Blocks Portability
- No `window` or `document` access in business logic
- No CSS Grid (doesn't exist in React Native)
- No `hover:` states in core UX (no hover on mobile)
- No `position: fixed` for critical UI (behaves differently)
- No browser-specific APIs (Web Push, Service Workers) in shared code

## Authentication for Mobile
```typescript
// auth/tokenAuth.ts — works on web AND mobile
export async function login(username: string, password: string) {
  const res = await fetch(`${BASE_URL}/api/method/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usr: username, pwd: password }),
  });
  // Extract api_key + api_secret from response
  // Store in secure storage (not cookies)
}
```

On web: store token in memory (or sessionStorage as fallback)
On mobile: store in Expo SecureStore / React Native Keychain

## Push Notifications Architecture
```
Web:    Frappe → Socket.IO → Browser tab (existing)
Mobile: Frappe → Background job → Expo Push API → APNs/FCM → Device
```

Build the Expo Push integration as a separate Frappe module so it doesn't affect web.

## Offline-First Considerations (Future)
- Queue outgoing messages locally when offline
- Sync on reconnect using `last_synced_at` timestamp
- Local DB: Expo SQLite or WatermelonDB for message cache
- Conflict resolution: server wins for message status updates

## Migration Path
```
Phase 1 (now):  React + Tailwind inside Frappe (current)
Phase 2:        Extract React app to standalone, connect via API
Phase 3:        React Native / Expo app sharing stores + API layer
Phase 4:        iOS App Store + Google Play launch
```

Keep Phase 2 in mind with every component you build today.
