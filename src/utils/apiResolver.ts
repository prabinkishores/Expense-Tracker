/**
 * Helper utility to dynamically resolve API endpoints.
 * When the React frontend is deployed to static hosting (like Netlify)
 * or bundled as a mobile application using webintoapp, relative paths (/api/*)
 * would fail with 404 errors. This utility routes API requests directly
 * to the fully-functional live Cloud Run container backend.
 */
export const getApiUrl = (endpoint: string): string => {
  const currentHost = window.location.hostname;

  // Detect local servers or the original Cloud Run preview URLs
  const isDirectEnvironment = 
    currentHost === "localhost" || 
    currentHost === "127.0.0.1" || 
    currentHost.includes("ais-dev-") || 
    currentHost.includes("ais-pre-") ||
    currentHost.includes(".run.app");

  if (isDirectEnvironment) {
    return endpoint; // Use direct relative path on the same host
  }

  // Fallback production backend endpoint where our Express server and Gemini credentials are live!
  const backendBase = 'https://ais-pre-typmjbab3ycxb3h3k4ozyo-740241239383.asia-southeast1.run.app';
  
  // Format clean URL pathing
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${backendBase}${cleanEndpoint}`;
};
