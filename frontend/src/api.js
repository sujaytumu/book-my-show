import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8080/api",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = "Bearer " + token;
  return config;
});

// A 401 means the token is missing/invalid/expired (e.g. it was issued before
// a server-side secret rotation). Without this, the UI keeps showing "logged
// in" while every authenticated request silently fails. Clear the stale
// session and send the user to log in again with a clear reason.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && localStorage.getItem("token")) {
      logout();
      if (!window.location.pathname.startsWith("/login")) {
        window.location.assign("/login?sessionExpired=1");
      }
    }
    return Promise.reject(error);
  }
);

export function currentUser() {
  return JSON.parse(localStorage.getItem("user") || "null");
}

export function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}
