import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'; // ^1.9.7
import { AuthState, User, LoginCredentials, AuthResponse, UserRole, Permission } from '../../types/auth';
import axios from 'axios'; // ^1.6.2
import { RootState } from './store';

// Session timeout in milliseconds (30 minutes)
const SESSION_TIMEOUT = 30 * 60 * 1000;

// Initial state with comprehensive authentication management
const initialState: AuthState = {
  user: null,
  loading: false,
  error: null,
  isAuthenticated: false,
  isInitialized: false,
};

// Enhanced login thunk with comprehensive error handling and session management
export const loginThunk = createAsyncThunk<AuthResponse, LoginCredentials>(
  'auth/login',
  async (credentials: LoginCredentials, { rejectWithValue }) => {
    try {
      const response = await axios.post<AuthResponse>('/api/auth/login', credentials, {
        headers: { 'Content-Type': 'application/json' },
      });

      // Store tokens securely
      if (credentials.rememberMe) {
        localStorage.setItem('refreshToken', response.data.refreshToken);
      } else {
        sessionStorage.setItem('refreshToken', response.data.refreshToken);
      }

      // Set authorization header for subsequent requests
      axios.defaults.headers.common['Authorization'] = `Bearer ${response.data.accessToken}`;

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        return rejectWithValue(error.response?.data?.message || 'Authentication failed');
      }
      return rejectWithValue('An unexpected error occurred');
    }
  }
);

// Enhanced logout thunk with cleanup
export const logoutThunk = createAsyncThunk(
  'auth/logout',
  async (_, { rejectWithValue }) => {
    try {
      await axios.post('/api/auth/logout');
      localStorage.removeItem('refreshToken');
      sessionStorage.removeItem('refreshToken');
      delete axios.defaults.headers.common['Authorization'];
      return;
    } catch (error) {
      return rejectWithValue('Logout failed');
    }
  }
);

// Token refresh thunk with error handling
export const refreshTokenThunk = createAsyncThunk(
  'auth/refresh',
  async (_, { getState, rejectWithValue }) => {
    try {
      const refreshToken = localStorage.getItem('refreshToken') || sessionStorage.getItem('refreshToken');
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await axios.post<AuthResponse>('/api/auth/refresh', {
        refreshToken,
      });

      axios.defaults.headers.common['Authorization'] = `Bearer ${response.data.accessToken}`;
      return response.data;
    } catch (error) {
      return rejectWithValue('Token refresh failed');
    }
  }
);

// Initialize auth state thunk
export const initializeAuth = createAsyncThunk(
  'auth/initialize',
  async (_, { dispatch }) => {
    const refreshToken = localStorage.getItem('refreshToken') || sessionStorage.getItem('refreshToken');
    if (refreshToken) {
      return dispatch(refreshTokenThunk()).unwrap();
    }
    return null;
  }
);

// Enhanced auth slice with comprehensive state management
export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUser: (state, action: PayloadAction<User>) => {
      state.user = action.payload;
      state.isAuthenticated = true;
    },
    clearAuth: (state) => {
      state.user = null;
      state.isAuthenticated = false;
      state.error = null;
    },
    updateLastActivity: (state) => {
      if (state.isAuthenticated) {
        state.user = {
          ...state.user!,
          lastLoginAt: new Date(),
        };
      }
    },
  },
  extraReducers: (builder) => {
    // Login handling
    builder.addCase(loginThunk.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(loginThunk.fulfilled, (state, action) => {
      state.loading = false;
      state.user = action.payload.user;
      state.isAuthenticated = true;
      state.error = null;
    });
    builder.addCase(loginThunk.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload as string;
      state.isAuthenticated = false;
    });

    // Logout handling
    builder.addCase(logoutThunk.fulfilled, (state) => {
      state.user = null;
      state.isAuthenticated = false;
      state.error = null;
    });

    // Token refresh handling
    builder.addCase(refreshTokenThunk.fulfilled, (state, action) => {
      state.user = action.payload.user;
      state.isAuthenticated = true;
      state.error = null;
    });
    builder.addCase(refreshTokenThunk.rejected, (state) => {
      state.user = null;
      state.isAuthenticated = false;
    });

    // Initialization handling
    builder.addCase(initializeAuth.fulfilled, (state) => {
      state.isInitialized = true;
    });
  },
});

// Enhanced selectors with memoization and type safety
export const selectAuth = (state: RootState): AuthState => state.auth;
export const selectUser = (state: RootState): User | null => state.auth.user;
export const selectIsAuthenticated = (state: RootState): boolean => state.auth.isAuthenticated;
export const selectAuthLoading = (state: RootState): boolean => state.auth.loading;
export const selectAuthError = (state: RootState): string | null => state.auth.error;

// Role-based selectors
export const selectIsAdmin = (state: RootState): boolean => 
  state.auth.user?.role === UserRole.ADMIN;

export const selectUserRole = (state: RootState): UserRole | null =>
  state.auth.user?.role || null;

export const selectUserPermissions = (state: RootState): Permission[] =>
  state.auth.user?.permissions || [];

// Permission check selector
export const selectHasPermission = (permission: Permission) => (state: RootState): boolean =>
  state.auth.user?.permissions.includes(permission) || false;

// Session status selector
export const selectIsSessionValid = (state: RootState): boolean => {
  const lastActivity = state.auth.user?.lastLoginAt;
  if (!lastActivity) return false;
  return Date.now() - new Date(lastActivity).getTime() < SESSION_TIMEOUT;
};

export const { setUser, clearAuth, updateLastActivity } = authSlice.actions;
export default authSlice.reducer;