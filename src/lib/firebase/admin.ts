import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getAppCheck, type AppCheck } from "firebase-admin/app-check";

let adminApp: App | undefined;
let adminDb: Firestore | undefined;
let adminAuth: Auth | undefined;
let adminAppCheck: AppCheck | undefined;

function getPrivateKey(): string {
  const key = process.env.FIREBASE_PRIVATE_KEY;
  if (!key) {
    throw new Error("FIREBASE_PRIVATE_KEY não configurada.");
  }
  return key.replace(/\\n/g, "\n");
}

export function getAdminApp(): App {
  if (!adminApp) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

    if (!projectId || !clientEmail) {
      throw new Error("Credenciais Firebase Admin não configuradas.");
    }

    adminApp =
      getApps().length > 0
        ? getApps()[0]!
        : initializeApp({
            credential: cert({
              projectId,
              clientEmail,
              privateKey: getPrivateKey(),
            }),
          });
  }
  return adminApp;
}

export function getAdminDb(): Firestore {
  if (!adminDb) {
    adminDb = getFirestore(getAdminApp());
  }
  return adminDb;
}

export function getAdminAuth(): Auth {
  if (!adminAuth) {
    adminAuth = getAuth(getAdminApp());
  }
  return adminAuth;
}

export function getAdminAppCheck(): AppCheck {
  if (!adminAppCheck) {
    adminAppCheck = getAppCheck(getAdminApp());
  }
  return adminAppCheck;
}
