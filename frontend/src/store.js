import { create } from 'zustand';

// Try to load initial user from sessionStorage
let initialUser = null;
try {
  const storedUser = sessionStorage.getItem('mortgage_user');
  if (storedUser) {
    initialUser = JSON.parse(storedUser);
  }
} catch (e) {
  console.warn('Failed to parse stored user');
}

export const useAppStore = create((set) => ({
  // Auth state
  user: initialUser,
  token: sessionStorage.getItem('mortgage_token') || null,
  theme: localStorage.getItem('mortgage_theme') || 'dark',
  
  setTheme: (theme) => {
    localStorage.setItem('mortgage_theme', theme);
    set({ theme });
  },
  
  login: (userData, tokenData) => {
    sessionStorage.setItem('mortgage_token', tokenData);
    sessionStorage.setItem('mortgage_user', JSON.stringify(userData));
    set({ user: userData, token: tokenData });
  },
  
  logout: () => {
    sessionStorage.removeItem('mortgage_token');
    sessionStorage.removeItem('mortgage_user');
    set({ user: null, token: null });
  },

  // Global states
  isSidebarCollapsed: false,
  toggleSidebar: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),

  // Prediction flow state
  currentPrediction: null,
  isPredicting: false,
  predictionError: null,
  
  setPredictionState: (updates) => set((state) => ({ ...state, ...updates })),
  clearPrediction: () => set({ currentPrediction: null, isPredicting: false, predictionError: null }),
}));
