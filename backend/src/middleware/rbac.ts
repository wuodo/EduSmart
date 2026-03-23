import { Request, Response, NextFunction } from 'express';
import { allowedMethodsFor, roleHasModuleAccess } from '../utils/permissions';

function getRole(req: Request): string {
	const sessionRole = (req as any).user?.role as string | undefined;
	if (sessionRole) return String(sessionRole).toLowerCase();
	return '';
}

export function rbacGuard(moduleName: string): (req: Request, res: Response, next: NextFunction) => void {
	return (req: Request, res: Response, next: NextFunction): void => {
		const role = getRole(req) || 'viewer';
		const method = req.method.toUpperCase();

		// Module access check
		if (!roleHasModuleAccess(moduleName, role)) {
			res.status(403).json({ error: 'Forbidden: no module access', module: moduleName, role });
			return;
		}
		// Method allowance based on role permissions
		const allowed = allowedMethodsFor(role);
		if (!allowed.has(method)) {
			res.status(403).json({ error: 'Forbidden: insufficient permissions', module: moduleName, role, method });
			return;
		}
		next();
	};
}

// Plan enforcement placeholder for quotas/feature gating per tenant plan
export function planEnforcement(_moduleName: string): (req: Request, res: Response, next: NextFunction) => void {
	return (_req: Request, _res: Response, next: NextFunction): void => {
		next();
	};
}
