import { useCallback, useEffect, useRef, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export type InstallState =
  | "hidden"         // not on web, or already installed
  | "ios"            // iOS Safari — manual share instructions
  | "android-ready"  // beforeinstallprompt fired — one-tap install available
  | "android-manual" // mobile Chrome/browser but prompt not (yet) available
  | "installed"      // user accepted install
  | "dismissed";     // user dismissed

function isRunningOnWeb(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

function detectIOS(): boolean {
  if (!isRunningOnWeb()) return false;
  const ua = navigator.userAgent || "";
  // iPhone, iPad, iPod in UA
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  // iPad on iOS 13+ pretends to be Mac
  if (/Macintosh/i.test(ua) && "ontouchstart" in window) return true;
  return false;
}

function detectMobile(): boolean {
  if (!isRunningOnWeb()) return false;
  const ua = navigator.userAgent || "";
  if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(ua)) return true;
  if (/Macintosh/i.test(ua) && "ontouchstart" in window) return true;
  // Fallback: touch screen + small viewport
  if ("ontouchstart" in window && window.innerWidth < 1024) return true;
  return false;
}

export function useInstallPrompt() {
  const [state, setState] = useState<InstallState>("hidden");
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (!isRunningOnWeb()) return;

    // Already running as installed PWA
    if (
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as any).standalone === true
    ) {
      setState("installed");
      return;
    }

    // Desktop — don't show
    if (!detectMobile()) {
      setState("hidden");
      return;
    }

    // iOS
    if (detectIOS()) {
      setState("ios");
      return;
    }

    // Android/other mobile
    setState("android-manual");

    const onPrompt = (e: Event) => {
      e.preventDefault();
      deferredPrompt.current = e as BeforeInstallPromptEvent;
      setState("android-ready");
    };

    const onInstalled = () => {
      deferredPrompt.current = null;
      setState("installed");
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt.current) return;
    await deferredPrompt.current.prompt();
    const { outcome } = await deferredPrompt.current.userChoice;
    setState(outcome === "accepted" ? "installed" : "dismissed");
    deferredPrompt.current = null;
  }, []);

  return {
    state,
    canShow: state === "ios" || state === "android-ready" || state === "android-manual",
    canNativeInstall: state === "android-ready",
    isIOS: state === "ios",
    isAndroidManual: state === "android-manual",
    promptInstall,
  };
}
