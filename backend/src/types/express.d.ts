import { Tenant } from '../../generated/prisma';

declare global {
  namespace Express {
    interface Request {
      tenant?: Tenant;
      tenantIdentifier?: string;
    }
  }
}

export {};











