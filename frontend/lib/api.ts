import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import toast from 'react-hot-toast';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - JWT token ekle
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('auth_token');
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - hata yönetimi
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ message?: string; error?: string }>) => {
    if (error.response?.status === 401) {
      // Token geçersiz - logout
      if (typeof window !== 'undefined') {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }

    if (error.response?.status === 403) {
      toast.error('Bu işlem için yetkiniz yok.');
      return Promise.reject(error);
    }

    if (error.response?.status === 429) {
      toast.error('Çok fazla istek gönderildi. Lütfen bekleyin.');
      return Promise.reject(error);
    }

    if (error.response?.status === 500) {
      const message = error.response.data?.message || 'Sunucu hatası oluştu.';
      toast.error(message);
      return Promise.reject(error);
    }

    if (error.code === 'ECONNABORTED') {
      toast.error('İstek zaman aşımına uğradı. Lütfen tekrar deneyin.');
      return Promise.reject(error);
    }

    if (!error.response) {
      toast.error('Sunucuya bağlanılamıyor. Ağ bağlantınızı kontrol edin.');
      return Promise.reject(error);
    }

    return Promise.reject(error);
  }
);

// API helper functions
export const getErrorMessage = (error: unknown): string => {
  if (error instanceof AxiosError) {
    return error.response?.data?.message || error.response?.data?.error || error.message || 'Bir hata oluştu.';
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Bilinmeyen bir hata oluştu.';
};

export default api;
