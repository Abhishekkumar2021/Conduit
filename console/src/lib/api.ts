import axios, { AxiosError } from "axios";
import { toast } from "sonner";

export const api = axios.create({
  baseURL: "/api/v1",
  headers: {
    "Content-Type": "application/json",
  },
});

interface ApiErrorResponse {
  error?: string;
  message?: string;
  detail?: string;
}

function getErrorMessage(error: AxiosError<ApiErrorResponse>): string {
  const data = error.response?.data;
  if (data?.message) return data.message;
  if (data?.detail) return data.detail;

  switch (error.response?.status) {
    case 401:
      return "Authentication required";
    case 403:
      return "You don't have permission for this action";
    case 404:
      return "Resource not found";
    case 409:
      return "Resource already exists";
    case 422:
      return "Validation error";
    case 429:
      return "Too many requests — please slow down";
    case 500:
      return "Internal server error";
    case 502:
    case 503:
    case 504:
      return "Server is temporarily unavailable";
    default:
      return error.message || "An unexpected error occurred";
  }
}

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiErrorResponse>) => {
    if (!axios.isCancel(error)) {
      const message = getErrorMessage(error);
      const status = error.response?.status;

      // Don't toast for 404 on polling endpoints (e.g. /runs/claim)
      const isSilent404 =
        status === 404 && error.config?.url?.includes("/claim");

      // On 401, clear auth and redirect to login
      if (status === 401 && !error.config?.url?.includes("/auth/")) {
        localStorage.removeItem("conduit-auth");
        delete api.defaults.headers.common.Authorization;
        window.location.href = "/login";
        return Promise.reject(error);
      }

      if (!isSilent404) {
        toast.error(message);
      }
    }

    return Promise.reject(error);
  },
);
