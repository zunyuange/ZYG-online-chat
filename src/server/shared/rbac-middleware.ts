/**
 * RBAC Permission Middleware
 * Provides requirePermission() for route-level permission checks.
 *
 * Permissions are embedded in the JWT token at login time.
 * The middleware reads them from the Hono context (injected by requireAuth).
 */

/**
 * Permission constants matching the `roles.permissions` JSON array values.
 */
export const PERMISSIONS = {
  ADMIN_VIEW: 'admin_view',
  ADMIN_EDIT: 'admin_edit',
  STAFF_VIEW: 'staff_view',
  STAFF_EDIT: 'staff_edit',
  ROLE_VIEW: 'role_view',
  ROLE_EDIT: 'role_edit',
  SETTINGS: 'settings',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/**
 * Hono middleware factory: returns a middleware that checks
 * whether the current user has ALL of the required permissions.
 *
 * Usage:
 *   app.use('*', requireAuth)          // must run first to inject context
 *   app.get('/roles', requirePermission(PERMISSIONS.ROLE_VIEW), handler)
 */
export function requirePermission(...requiredPermissions: Permission[]) {
  return async (c: any, next: () => Promise<void>) => {
    const permissions = c.get('permissions') as string[] | undefined;
    const role = c.get('role') as string | undefined;

    // Super-admin bypass: admin + default business sees everything
    if (role === 'admin') {
      const businessSlug = c.get('businessSlug') as string | undefined;
      if (businessSlug === 'default') {
        return next();
      }
    }

    if (!permissions || !Array.isArray(permissions)) {
      return c.json(
        { success: false, error: '权限不足：未找到权限信息' },
        403
      );
    }

    const hasAll = requiredPermissions.every(p => permissions.includes(p));
    if (!hasAll) {
      return c.json(
        { success: false, error: `权限不足：需要 ${requiredPermissions.join(', ')}` },
        403
      );
    }

    return next();
  };
}

/**
 * Check if a permission list includes a specific permission.
 * Useful in non-middleware contexts (e.g. service layer, frontend).
 */
export function hasPermission(permissions: string[], permission: Permission): boolean {
  return permissions.includes(permission);
}

/**
 * Check if user is a super-admin (admin role + default business).
 */
export function isSuperAdmin(role?: string, businessSlug?: string): boolean {
  return role === 'admin' && businessSlug === 'default';
}
