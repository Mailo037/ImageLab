export type ServiceWorkerState = "unsupported" | "idle" | "checking" | "ready" | "error";

const supported = () => typeof window !== "undefined" && "serviceWorker" in navigator;

const watchInstallingWorker = (registration: ServiceWorkerRegistration, notify: (registration: ServiceWorkerRegistration) => void) => {
  const worker = registration.installing;
  if (!worker) return;
  worker.addEventListener("statechange", () => {
    if (worker.state === "installed" && navigator.serviceWorker.controller) notify(registration);
  });
};

export async function registerImageLabServiceWorker(notify: (registration: ServiceWorkerRegistration) => void) {
  if (!supported()) return null;
  const registration = await navigator.serviceWorker.register("/sw.js");
  if (registration.waiting) notify(registration);
  watchInstallingWorker(registration, notify);
  registration.addEventListener("updatefound", () => watchInstallingWorker(registration, notify));
  return registration;
}

export async function checkServiceWorkerUpdate(registration: ServiceWorkerRegistration | null) {
  if (!registration) return null;
  if (registration.waiting) return registration;
  return await new Promise<ServiceWorkerRegistration | null>((resolve) => {
    let settled = false;
    const finish = (value: ServiceWorkerRegistration | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      registration.removeEventListener("updatefound", inspect);
      resolve(value);
    };
    const inspect = () => {
      const worker = registration.installing;
      if (!worker) return;
      worker.addEventListener("statechange", () => {
        if (worker.state === "installed") finish(registration.waiting ? registration : null);
      }, { once: true });
    };
    const timeout = window.setTimeout(() => finish(registration.waiting ? registration : null), 3500);
    registration.addEventListener("updatefound", inspect);
    void registration.update().then(() => {
      if (registration.waiting) finish(registration);
      else inspect();
    }).catch(() => finish(null));
  });
}

export function activateServiceWorkerUpdate(registration: ServiceWorkerRegistration | null) {
  if (!registration?.waiting) return false;
  registration.waiting.postMessage({ type: "IMAGELAB_SKIP_WAITING" });
  return true;
}

export async function waitForServiceWorkerControllerChange(timeoutMs = 6000) {
  if (!supported()) return false;
  return await new Promise<boolean>((resolve) => {
    const timeout = window.setTimeout(() => resolve(false), timeoutMs);
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      window.clearTimeout(timeout);
      resolve(true);
    }, { once: true });
  });
}
