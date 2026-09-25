import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8080/api",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = "Bearer " + token;
  return config;
});

export function currentUser() {
  return JSON.parse(localStorage.getItem("user") || "null");
}

export function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}
