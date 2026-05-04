# Firebase Integration

JDBot now uses Firebase for authentication and chat persistence (alongside the existing Lovable Cloud edge function for the Gemini AI calls).

## What was added

- `src/lib/firebase.ts` — Firebase app/auth/Firestore initialization
- `src/hooks/useAuth.tsx` — `AuthProvider` + `useAuth()` hook (Google sign-in)
- `src/services/chats.ts` — Firestore CRUD + realtime subscription for chats
- `firestore.rules` — User-scoped security rules
- Sidebar shows Sign in / user profile / Sign out
- `Index.tsx` saves and loads chats from Firestore when signed in (falls back to localStorage for guests)

## Firestore data model

```
users/{uid}        { uid, email, displayName, photoURL, lastLogin }
chats/{chatId}     { uid, title, messages: [{role, content}], createdAt, updatedAt }
```

## Configuration

The web config values you provided are publishable client keys, so they live directly in `src/lib/firebase.ts`. If you'd rather use env vars, replace the literal config with `import.meta.env.VITE_FIREBASE_*` and add them in your env settings.

## Setup steps in the Firebase console

1. **Authentication → Sign-in method** → enable **Google**.
2. **Authentication → Settings → Authorized domains** → add your Lovable preview domain (e.g. `id-preview--<id>.lovable.app`) and your published domain.
3. **Firestore Database** → create database (production mode).
4. **Firestore → Rules** → paste the contents of `firestore.rules` and Publish.

## Optional: Firebase Hosting

```
npm i -g firebase-tools
firebase login
firebase init hosting   # public dir: dist, SPA: yes
npm run build
firebase deploy --only hosting
```
