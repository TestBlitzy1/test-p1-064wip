import { IconType } from 'react-icons';
import { 
  ROUTES, 
  USER_ROLES 
} from '../config/constants';

// Interface for route configuration with metadata
interface RouteConfig {
  path: string;
  title: string;
  icon?: IconType;
  layout?: 'default' | 'fullwidth' | 'minimal';
  roles?: string[];
  children?: RouteConfig[];
  metadata?: {
    breadcrumb?: string;
    analytics?: {
      pageView?: boolean;
      eventTracking?: boolean;
    };
    responsive?: {
      mobile?: string;
      tablet?: string;
      desktop?: string;
    };
    errorBoundary?: boolean;
    prefetch?: boolean;
    deprecated?: boolean;
  };
}

// Route configuration cache for performance optimization
const routeConfigCache = new Map<string, RouteConfig>();

// Main routes configuration array
export const routes: RouteConfig[] = [
  {
    path: ROUTES.HOME,
    title: 'Home',
    layout: 'default',
    metadata: {
      pageView: true,
      responsive: {
        mobile: 'stack',
        tablet: 'grid',
        desktop: 'grid'
      }
    }
  },
  {
    path: ROUTES.DASHBOARD,
    title: 'Dashboard',
    layout: 'default',
    roles: [USER_ROLES.ADMIN, USER_ROLES.MANAGER, USER_ROLES.ANALYST, USER_ROLES.VIEWER],
    metadata: {
      breadcrumb: 'Dashboard',
      analytics: {
        pageView: true,
        eventTracking: true
      },
      responsive: {
        mobile: 'stack',
        tablet: 'grid',
        desktop: 'grid'
      },
      errorBoundary: true,
      prefetch: true
    }
  },
  {
    path: ROUTES.CAMPAIGNS.LIST,
    title: 'Campaigns',
    layout: 'default',
    roles: [USER_ROLES.ADMIN, USER_ROLES.MANAGER, USER_ROLES.ANALYST, USER_ROLES.VIEWER],
    children: [
      {
        path: ROUTES.CAMPAIGNS.CREATE,
        title: 'Create Campaign',
        layout: 'fullwidth',
        roles: [USER_ROLES.ADMIN, USER_ROLES.MANAGER],
        metadata: {
          breadcrumb: 'Campaigns / Create',
          analytics: {
            pageView: true,
            eventTracking: true
          },
          errorBoundary: true
        }
      },
      {
        path: ROUTES.CAMPAIGNS.EDIT,
        title: 'Edit Campaign',
        layout: 'fullwidth',
        roles: [USER_ROLES.ADMIN, USER_ROLES.MANAGER],
        metadata: {
          breadcrumb: 'Campaigns / Edit',
          analytics: {
            pageView: true,
            eventTracking: true
          },
          errorBoundary: true
        }
      },
      {
        path: ROUTES.CAMPAIGNS.DETAIL,
        title: 'Campaign Details',
        layout: 'default',
        roles: [USER_ROLES.ADMIN, USER_ROLES.MANAGER, USER_ROLES.ANALYST, USER_ROLES.VIEWER],
        metadata: {
          breadcrumb: 'Campaigns / Details',
          analytics: {
            pageView: true,
            eventTracking: true
          },
          prefetch: true
        }
      },
      {
        path: ROUTES.CAMPAIGNS.ANALYTICS,
        title: 'Campaign Analytics',
        layout: 'default',
        roles: [USER_ROLES.ADMIN, USER_ROLES.MANAGER, USER_ROLES.ANALYST],
        metadata: {
          breadcrumb: 'Campaigns / Analytics',
          analytics: {
            pageView: true,
            eventTracking: true
          },
          errorBoundary: true
        }
      }
    ]
  },
  {
    path: ROUTES.ANALYTICS.DASHBOARD,
    title: 'Analytics',
    layout: 'default',
    roles: [USER_ROLES.ADMIN, USER_ROLES.MANAGER, USER_ROLES.ANALYST],
    children: [
      {
        path: ROUTES.ANALYTICS.REPORTS,
        title: 'Reports',
        layout: 'default',
        roles: [USER_ROLES.ADMIN, USER_ROLES.MANAGER, USER_ROLES.ANALYST],
        metadata: {
          breadcrumb: 'Analytics / Reports',
          analytics: {
            pageView: true,
            eventTracking: true
          }
        }
      },
      {
        path: ROUTES.ANALYTICS.CUSTOM,
        title: 'Custom Analytics',
        layout: 'fullwidth',
        roles: [USER_ROLES.ADMIN, USER_ROLES.ANALYST],
        metadata: {
          breadcrumb: 'Analytics / Custom',
          analytics: {
            pageView: true,
            eventTracking: true
          },
          errorBoundary: true
        }
      }
    ]
  },
  {
    path: ROUTES.SETTINGS.PROFILE,
    title: 'Settings',
    layout: 'default',
    roles: [USER_ROLES.ADMIN, USER_ROLES.MANAGER, USER_ROLES.ANALYST, USER_ROLES.VIEWER],
    children: [
      {
        path: ROUTES.SETTINGS.ORGANIZATION,
        title: 'Organization',
        layout: 'default',
        roles: [USER_ROLES.ADMIN],
        metadata: {
          breadcrumb: 'Settings / Organization',
          analytics: {
            pageView: true
          }
        }
      },
      {
        path: ROUTES.SETTINGS.INTEGRATIONS,
        title: 'Integrations',
        layout: 'default',
        roles: [USER_ROLES.ADMIN],
        metadata: {
          breadcrumb: 'Settings / Integrations',
          analytics: {
            pageView: true,
            eventTracking: true
          },
          errorBoundary: true
        }
      },
      {
        path: ROUTES.SETTINGS.BILLING,
        title: 'Billing',
        layout: 'default',
        roles: [USER_ROLES.ADMIN],
        metadata: {
          breadcrumb: 'Settings / Billing',
          analytics: {
            pageView: true,
            eventTracking: true
          },
          errorBoundary: true
        }
      }
    ]
  }
];

/**
 * Returns the route configuration for a given path with enhanced caching
 * @param path - Route path to look up
 * @returns RouteConfig object if found, undefined otherwise
 */
export const getRouteConfig = (path: string): RouteConfig | undefined => {
  // Check cache first
  if (routeConfigCache.has(path)) {
    return routeConfigCache.get(path);
  }

  // Helper function to search route tree
  const findRoute = (routes: RouteConfig[], searchPath: string): RouteConfig | undefined => {
    for (const route of routes) {
      if (route.path === searchPath) {
        return route;
      }
      if (route.children) {
        const childRoute = findRoute(route.children, searchPath);
        if (childRoute) {
          return childRoute;
        }
      }
    }
    return undefined;
  };

  const config = findRoute(routes, path);
  if (config) {
    routeConfigCache.set(path, config);
  }
  return config;
};

/**
 * Verifies if a route is accessible for a given user role
 * @param path - Route path to check
 * @param userRole - User role to verify access for
 * @returns boolean indicating if route is accessible
 */
export const isRouteAccessible = (path: string, userRole: string): boolean => {
  const config = getRouteConfig(path);
  if (!config) {
    return false;
  }

  // If no roles specified, route is public
  if (!config.roles || config.roles.length === 0) {
    return true;
  }

  // Check if user role has access
  return config.roles.includes(userRole);
};