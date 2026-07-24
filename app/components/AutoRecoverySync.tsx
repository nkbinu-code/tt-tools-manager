"use client";

import { useEffect } from "react";

const LAST_SUCCESS_KEY =
  "tt-last-google-recovery-upload-day";
const LAST_ATTEMPT_KEY =
  "tt-last-google-recovery-attempt";

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function AutoRecoverySync() {
  useEffect(() => {
    let active = true;

    async function attemptUpload() {
      if (!navigator.onLine) return;
      if (
        window.localStorage.getItem(LAST_SUCCESS_KEY) ===
        todayKey()
      ) {
        return;
      }

      const lastAttempt = Number(
        window.localStorage.getItem(LAST_ATTEMPT_KEY) ||
          0,
      );

      if (Date.now() - lastAttempt < 15 * 60 * 1000) {
        return;
      }

      window.localStorage.setItem(
        LAST_ATTEMPT_KEY,
        String(Date.now()),
      );

      try {
        const response = await fetch(
          "/api/recovery-drive",
          {
            method: "POST",
            cache: "no-store",
          },
        );

        if (!active) return;

        if (response.ok) {
          window.localStorage.setItem(
            LAST_SUCCESS_KEY,
            todayKey(),
          );
        }
      } catch {
        // It will retry on the next online event or app opening.
      }
    }

    void attemptUpload();

    const onlineHandler = () => {
      void attemptUpload();
    };

    window.addEventListener("online", onlineHandler);

    const interval = window.setInterval(
      () => void attemptUpload(),
      30 * 60 * 1000,
    );

    return () => {
      active = false;
      window.removeEventListener(
        "online",
        onlineHandler,
      );
      window.clearInterval(interval);
    };
  }, []);

  return null;
}
