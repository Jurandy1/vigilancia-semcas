"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { onAdminAuthChange, getAdminIdToken } from "@/lib/firebase/auth-client";
import { resolvePostLoginDestination } from "@/lib/admin/post-login-destination";

export default function AdminPage() {
  const router = useRouter();

  useEffect(() => {
    const unsub = onAdminAuthChange(async (user) => {
      if (!user) {
        router.replace("/admin/login");
        return;
      }
      const token = await getAdminIdToken();
      if (!token) {
        router.replace("/admin/login");
        return;
      }
      const destination = await resolvePostLoginDestination(token);
      router.replace(destination);
    });
    return unsub;
  }, [router]);

  return null;
}
