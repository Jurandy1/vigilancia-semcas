"use client";

import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import { getFirebaseApp } from "@/lib/firebase/client";

function getAuthApp() {
  return getAuth(getFirebaseApp());
}

export async function adminLogin(email: string, password: string) {
  const auth = getAuthApp();
  const result = await signInWithEmailAndPassword(auth, email, password);
  const tokenResult = await result.user.getIdTokenResult();
  if (!tokenResult.claims.admin) {
    await signOut(auth);
    throw new Error("Usuário sem permissão administrativa.");
  }
  return result.user;
}

export async function adminLogout() {
  await signOut(getAuthApp());
}

export async function getAdminIdToken(): Promise<string | null> {
  const auth = getAuthApp();
  const user = auth.currentUser;
  if (!user) return null;
  return user.getIdToken();
}

export function onAdminAuthChange(callback: (user: User | null) => void) {
  return onAuthStateChanged(getAuthApp(), callback);
}

export { getAuthApp };
