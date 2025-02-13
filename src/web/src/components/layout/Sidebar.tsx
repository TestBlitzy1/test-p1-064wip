import React, { useCallback, useMemo } from 'react';
import { usePathname } from 'next/navigation'; // ^14.0.0
import Link from 'next/link'; // ^14.0.0
import Button from '../common/Button'; // Custom button component
import useAuth from '../../hooks/useAuth';
import { routes } from '../../config/routes.config';

interface SidebarProps {
  /**
   * Controls the collapsed state of the sidebar with animation support
   * @default false
   */
  isCollapsed: boolean;
  /**
   * Callback function to toggle sidebar collapse state with transition handling
   */
  onToggle: () => void;
}

interface NavItemProps {
  /**
   * Route configuration object with inheritance support
   */
  route: RouteConfig;
  /**
   * Whether the route is currently active with focus management
   */
  isActive: boolean;
  /**
   * Whether the sidebar is collapsed with animation state
   */
  isCollapsed: boolean;
}

/**
 * Navigation item component with enhanced accessibility and animations
 */
const NavItem: React.FC<NavItemProps> = React.memo(({ route, isActive, isCollapsed }) => {
  const baseClasses = 'flex items-center w-full px-4 py-2 text-sm transition-all duration-200';
  const activeClasses = 'bg-primary-50 text-primary-700 font-medium';
  const inactiveClasses = 'text-gray-700 hover:bg-gray-50';
  const iconClasses = `flex-shrink-0 w-5 h-5 mr-${isCollapsed ? '0' : '3'}`;
  const textClasses = `${isCollapsed ? 'sr-only' : 'truncate'}`;

  const classes = `${baseClasses} ${isActive ? activeClasses : inactiveClasses}`;

  return (
    <Link 
      href={route.path}
      className={classes}
      aria-current={isActive ? 'page' : undefined}
      role="menuitem"
      prefetch={route.metadata?.prefetch}
    >
      {route.icon && (
        <route.icon 
          className={iconClasses}
          aria-hidden="true"
        />
      )}
      <span className={textClasses}>{route.title}</span>
    </Link>
  );
});

NavItem.displayName = 'NavItem';

/**
 * Main sidebar navigation component with enhanced features
 */
const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, onToggle }) => {
  const currentPath = usePathname();
  const { user, isAuthenticated } = useAuth();

  // Filter routes based on user role and authentication status
  const filteredRoutes = useMemo(() => {
    if (!isAuthenticated || !user) return [];

    return routes.filter(route => {
      // Check if route requires authentication
      if (!route.roles) return true;
      
      // Verify user has required role
      return route.roles.includes(user.role);
    });
  }, [isAuthenticated, user]);

  // Render navigation items with caching and optimization
  const renderNavItems = useCallback(() => {
    return filteredRoutes.map(route => {
      const isActive = currentPath === route.path || 
        (route.children?.some(child => currentPath === child.path) ?? false);

      return (
        <li key={route.path} role="none">
          <NavItem
            route={route}
            isActive={isActive}
            isCollapsed={isCollapsed}
          />
          {/* Render child routes if parent is active */}
          {isActive && route.children && !isCollapsed && (
            <ul
              role="menu"
              aria-label={`${route.title} submenu`}
              className="pl-6 mt-1 space-y-1"
            >
              {route.children.map(child => (
                <li key={child.path} role="none">
                  <NavItem
                    route={child}
                    isActive={currentPath === child.path}
                    isCollapsed={isCollapsed}
                  />
                </li>
              ))}
            </ul>
          )}
        </li>
      );
    });
  }, [filteredRoutes, currentPath, isCollapsed]);

  const sidebarClasses = `
    fixed left-0 z-20 h-full bg-white border-r border-gray-200
    transition-all duration-300 ease-in-out
    ${isCollapsed ? 'w-16' : 'w-64'}
  `;

  return (
    <nav
      className={sidebarClasses}
      aria-label="Main navigation"
      role="navigation"
    >
      <div className="flex flex-col h-full">
        {/* Sidebar Header */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200">
          <Link 
            href="/"
            className={`text-xl font-semibold ${isCollapsed ? 'sr-only' : ''}`}
            aria-label="Go to dashboard"
          >
            {!isCollapsed && 'S&I Platform'}
          </Link>
          <Button
            variant="text"
            size="medium"
            onClick={onToggle}
            ariaLabel={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="p-1"
          >
            {isCollapsed ? '→' : '←'}
          </Button>
        </div>

        {/* Navigation Items */}
        <ul
          role="menubar"
          aria-label="Main menu"
          className="flex-1 px-2 py-4 space-y-1 overflow-y-auto"
        >
          {renderNavItems()}
        </ul>

        {/* User Section */}
        {user && !isCollapsed && (
          <div className="p-4 border-t border-gray-200">
            <div className="flex items-center">
              <span className="text-sm font-medium text-gray-700 truncate">
                {user.name}
              </span>
            </div>
            <p className="mt-1 text-xs text-gray-500 truncate">
              {user.role}
            </p>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Sidebar;