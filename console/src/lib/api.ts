import axios from "axios";

// Create a globally configured Axios instance.
// Vite proxy routes all `/api` requests to the FastAPI backend (http://localhost:8000)
export const api = axios.create({
  baseURL: "/api/v1",
  headers: {
    "Content-Type": "application/json",
  },
});

// Add interceptors here if needed (e.g., for auth tokens or global error handling)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // We could hook into an error toast system here eventually
    console.error("API Error:", error.response?.data || error.message);
    return Promise.reject(error);
  },
);
