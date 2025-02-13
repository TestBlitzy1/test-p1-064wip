import { ReactNode } from 'react'; // v18.x

// Global type definitions
export type Environment = 'development' | 'staging' | 'production';
export type Status = 'idle' | 'loading' | 'success' | 'error';
export type ID = string;
export type DateString = string;
export type Timestamp = number;

// Base API response interface
export interface BaseResponse<T> {
  data: T;
  status: number;
  message: string;
}

// Standard error response structure
export interface ErrorResponse {
  code: string;
  message: string;
  details: Record<string, any>;
}

// Pagination parameters interface
export interface PaginationParams {
  page: number;
  limit: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

// Generic paginated response interface
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Common loading state interface
export interface LoadingState {
  status: Status;
  error: ErrorResponse | null;
}

// Date range interface for filtering
export interface DateRange {
  startDate: DateString;
  endDate: DateString;
}

// Base props interface for React components
export interface ComponentProps {
  children?: ReactNode;
  className?: string;
}

// Utility types
export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
export type AsyncData<T> = {
  data: Nullable<T>;
  loading: boolean;
  error: Nullable<ErrorResponse>;
};

// HTTP methods type
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

// Common API endpoint configuration
export interface ApiEndpointConfig {
  method: HttpMethod;
  path: string;
  requiresAuth: boolean;
}

// Campaign platform types
export type Platform = 'linkedin' | 'google' | 'both';

// Common status types for various entities
export type EntityStatus = 'active' | 'inactive' | 'archived' | 'deleted';

// Common sort direction type
export type SortDirection = 'asc' | 'desc';

// Filter operator types
export type FilterOperator = 
  | 'equals' 
  | 'notEquals'
  | 'contains'
  | 'greaterThan'
  | 'lessThan'
  | 'between'
  | 'in'
  | 'notIn';

// Generic filter structure
export interface Filter<T = any> {
  field: keyof T;
  operator: FilterOperator;
  value: any;
}

// Common metadata interface
export interface Metadata {
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: ID;
  updatedBy: ID;
}

// Role-based access control types
export type UserRole = 'admin' | 'manager' | 'analyst' | 'viewer';

export interface Permission {
  resource: string;
  action: 'create' | 'read' | 'update' | 'delete';
}

// Notification types
export type NotificationSeverity = 'info' | 'success' | 'warning' | 'error';

export interface Notification {
  id: ID;
  type: NotificationSeverity;
  message: string;
  timestamp: Timestamp;
  read: boolean;
}

// Theme-related types
export type ThemeMode = 'light' | 'dark' | 'system';

// Common form field validation
export interface ValidationRule {
  required?: boolean;
  min?: number;
  max?: number;
  pattern?: RegExp;
  custom?: (value: any) => boolean;
  message: string;
}

// Analytics event tracking
export interface AnalyticsEvent {
  category: string;
  action: string;
  label?: string;
  value?: number;
  timestamp: Timestamp;
}

// Error boundary fallback props
export interface ErrorBoundaryFallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
}