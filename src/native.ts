/**
 * Native (Capacitor) bootstrap.
 * Everything here is a no-op on the web build — guarded by isNativePlatform().
 */
import { Capacitor } from '@capacitor/core';

export async function initNative(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setStyle({ style: Style.Dark });
  } catch {
    // status bar not critical
  }

  try {
    const { App } = await import('@capacitor/app');
    // Android hardware back button: go back in SPA history, or minimise at root.
    App.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack || window.history.length > 1) {
        window.history.back();
      } else {
        App.exitApp();
      }
    });
  } catch {
    // back-button handling is Android-only
  }

  try {
    const { SplashScreen } = await import('@capacitor/splash-screen');
    await SplashScreen.hide();
  } catch {
    // splash auto-hides via config as fallback
  }
}
