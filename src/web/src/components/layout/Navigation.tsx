import React, { useCallback, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import classNames from 'classnames';
import { useAuth } from '../../hooks/useAuth';
import { routes } from '../../config/routes.config';
import Button from '../common/Button';

// Navigation component props interface
interface NavigationProps {
  className?: string;
  collapsed?: boolean;
  onNavigate?: () => void;
}

// Navigation item props interface
interface NavItemProps {
  route: RouteConfig;
  isActive: boolean;
  depth: number;
}

/**
 * Main navigation component with role-based access control and responsive design
 * @version 1.0.0
 */
const Navigation: React.FC<NavigationProps> = ({
  className,
  collapsed = false,
  onNavigate
}) => {
  const { user, isAuthenticated, hasRole } = useAuth();
  const pathname = usePathname();

  /**
   * Filters routes based on user role and authentication status
   */
  const accessibleRoutes = useMemo(() => {
    const filterRoutes = (routes: RouteConfig[]): RouteConfig[] => {
      return routes.filter(route => {
        // Check if route requires authentication
        if (!isAuthenticated) {
          return false;
        }

        // Check role-based access
        if (route.roles && route.roles.length > 0) {
          const hasAccess = route.roles.some(role => hasRole(role));
          if (!hasAccess) return false;
        }

        // Filter children recursively
        if (route.children) {
          const filteredChildren = filterRoutes(route.children);
          route.children = filteredChildren;
          // Only include parent if it has accessible children
          return filteredChildren.length > 0;
        }

        return true;
      });
    };

    return filterRoutes(routes);
  }, [isAuthenticated, hasRole]);

  /**
   * Checks if a route or its children are active
   */
  const isRouteActive = useCallback((route: RouteConfig): boolean => {
    if (pathname === route.path) return true;
    if (route.children) {
      return route.children.some(child => isRouteActive(child));
    }
    return false;
  }, [pathname]);

  /**
   * Handles navigation analytics tracking
   */
  const handleNavigate = useCallback((route: RouteConfig) => {
    if (onNavigate) {
      onNavigate();
    }
    // Track navigation event if analytics is enabled
    if (route.metadata?.analytics?.pageView) {
      // Analytics tracking implementation
    }
  }, [onNavigate]);

  // Base navigation container classes
  const containerClasses = classNames(
    'flex flex-col',
    'bg-white dark:bg-gray-800',
    'border-r border-gray-200 dark:border-gray-700',
    {
      'w-64': !collapsed,
      'w-16': collapsed,
      'transition-all duration-300': true
    },
    className
  );

  return (
    <nav
      className={containerClasses}
      aria-label="Main navigation"
      role="navigation"
    >
      <div className="flex flex-col flex-grow overflow-y-auto">
        {accessibleRoutes.map((route) => (
          <NavItem
            key={route.path}
            route={route}
            isActive={isRouteActive(route)}
            depth={0}
          />
        ))}
      </div>
    </nav>
  );
};

/**
 * Individual navigation item component with accessibility features
 */
const NavItem: React.FC<NavItemProps> = React.memo(({
  route,
  isActive,
  depth
}) => {
  const itemClasses = classNames(
    'flex items-center px-4 py-2',
    'text-gray-700 dark:text-gray-200',
    'hover:bg-gray-100 dark:hover:bg-gray-700',
    'transition-colors duration-150',
    {
      'bg-gray-100 dark:bg-gray-700': isActive,
      'pl-8': depth === 1,
      'pl-12': depth === 2
    }
  );

  const iconClasses = classNames(
    'flex-shrink-0 w-5 h-5',
    'mr-3',
    {
      'text-gray-400 dark:text-gray-500': !isActive,
      'text-primary-500 dark:text-primary-400': isActive
    }
  );

  return (
    <>
      <Link
        href={route.path}
        passHref
        className={itemClasses}
        aria-current={isActive ? 'page' : undefined}
      >
        <Button
          variant="text"
          className="w-full text-left"
          aria-label={route.title}
        >
          {route.icon && (
            <route.icon
              className={iconClasses}
              aria-hidden="true"
            />
          )}
          <span className="flex-1 truncate">
            {route.title}
          </span>
        </Button>
      </Link>

      {/* Render child routes recursively */}
      {route.children && route.children.length > 0 && (
        <div className="ml-4">
          {route.children.map((child) => (
            <NavItem
              key={child.path}
              route={child}
              isActive={false}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </>
  );
});

// Display names for debugging
Navigation.displayName = 'Navigation';
NavItem.displayName = 'NavItem';

export default Navigation;