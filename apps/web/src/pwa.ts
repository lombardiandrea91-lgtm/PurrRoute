import { registerSW } from 'virtual:pwa-register';

export type PwaState = 'preparing' | 'ready' | 'failed';
let state: PwaState = 'preparing';
let needsUpdate = false;
const listeners = new Set<() => void>();
let updateWorker: ((reloadPage?: boolean) => Promise<void>) | undefined;

const emit = () => listeners.forEach((listener) => listener());
export const subscribePwa = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const getPwaState = () => state;
export const getNeedsUpdate = () => needsUpdate;
export const updateApplication = () => updateWorker?.(true);

export function startPwa() {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) {
    state = 'failed';
    return;
  }
  updateWorker = registerSW({
    immediate: true,
    onOfflineReady() { state = 'ready'; emit(); },
    onRegisteredSW() { if (navigator.serviceWorker.controller) { state = 'ready'; emit(); } },
    onNeedRefresh() { needsUpdate = true; emit(); },
    onRegisterError() { state = 'failed'; emit(); },
  });
}