export const getBackendUrl = () => {
  const configuredUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
  if (!configuredUrl) {
    if (typeof window !== "undefined") {
      return `${window.location.protocol}//${window.location.hostname}:8000`;
    }
    return process.env.NEXT_PUBLIC_BACKEND_URL || "http://backend:8000";
  }

  if (typeof window !== "undefined") {
    try {
      const backendUrl = new URL(configuredUrl);
      const localHosts = new Set(["localhost", "127.0.0.1"]);
      if (
        localHosts.has(window.location.hostname) &&
        localHosts.has(backendUrl.hostname)
      ) {
        backendUrl.hostname = window.location.hostname;
        return backendUrl.toString().replace(/\/$/, "");
      }
    } catch {
      return configuredUrl;
    }
  }

  return configuredUrl;
};
