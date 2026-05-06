import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  User,
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db, googleProvider } from "@/lib/firebase";
import { toast } from "sonner";

interface AuthCtx {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | undefined>(undefined);

async function upsertUserProfile(user: User) {
  await setDoc(
    doc(db, "users", user.uid),
    {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      lastLogin: serverTimestamp(),
    },
    { merge: true },
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    // Handle redirect-based sign-in result (fallback for popup-blocked / unauthorized-domain)
    getRedirectResult(auth)
      .then((res) => {
        if (res?.user) {
          upsertUserProfile(res.user).catch(console.error);
          toast.success(`Welcome, ${res.user.displayName ?? "back"}!`);
        }
      })
      .catch((e) => console.error("Redirect sign-in error:", e));
    return unsub;
  }, []);

  const signInWithGoogle = async () => {
    try {
      const res = await signInWithPopup(auth, googleProvider);
      await upsertUserProfile(res.user);
      toast.success(`Welcome, ${res.user.displayName ?? "back"}!`);
    } catch (e: any) {
      console.error(e);
      const code = e?.code as string | undefined;
      if (code === "auth/popup-blocked" || code === "auth/popup-closed-by-user") {
        // Try redirect flow as a fallback
        try {
          await signInWithRedirect(auth, googleProvider);
          return;
        } catch (err) {
          console.error(err);
        }
      }
      if (code === "auth/unauthorized-domain") {
        toast.error(
          `This domain (${window.location.hostname}) isn't authorized in Firebase. Add it under Authentication → Settings → Authorized domains.`,
          { duration: 8000 },
        );
        return;
      }
      toast.error(e?.message ?? "Sign-in failed");
    }
  };


  const logout = async () => {
    await signOut(auth);
    toast.success("Signed out");
  };

  return (
    <Ctx.Provider value={{ user, loading, signInWithGoogle, logout }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
