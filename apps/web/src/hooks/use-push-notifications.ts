"use client";

import { useState, useCallback, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";
const API_PREFIX = "/api/v1";

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray.buffer;
}

export function usePushNotifications() {
  const { accessToken } = useAuth();
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");

  useEffect(() => {
    if ("serviceWorker" in navigator && "PushManager" in window) {
      setIsSupported(true);
      setPermission(Notification.permission);
      checkSubscription();
    }
  }, []);

  const checkSubscription = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    } catch {
      // Service worker not ready yet
    }
  };

  const subscribe = useCallback(async () => {
    if (!isSupported || !accessToken) return false;

    try {
      const permResult = await Notification.requestPermission();
      setPermission(permResult);
      if (permResult !== "granted") return false;

      const res = await fetch(`${API_URL}${API_PREFIX}/notifications/vapid-public-key`);
      if (!res.ok) return false;
      const { publicKey } = await res.json();

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      const subJson = subscription.toJSON();
      await fetch(`${API_URL}${API_PREFIX}/notifications/subscribe`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          endpoint: subJson.endpoint,
          keys: subJson.keys,
        }),
      });

      setIsSubscribed(true);
      return true;
    } catch (err) {
      console.error("Push subscription failed:", err);
      return false;
    }
  }, [isSupported, accessToken]);

  const unsubscribe = useCallback(async () => {
    if (!accessToken) return;

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) return;

      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();

      await fetch(`${API_URL}${API_PREFIX}/notifications/unsubscribe`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ endpoint }),
      });

      setIsSubscribed(false);
    } catch (err) {
      console.error("Push unsubscribe failed:", err);
    }
  }, [accessToken]);

  return { isSupported, isSubscribed, permission, subscribe, unsubscribe };
}
