import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, env.JWT_SECRET);
    req.user = decoded; // { id, tenantId, organizationId, role }
    req.tenantId = decoded.tenantId;
    req.organizationId = decoded.organizationId;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function authorize(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

// Allows ORG_ADMIN to switch branch context via ?branchId= query param
export function branchContext(req, res, next) {
  const { branchId } = req.query;
  if (branchId && req.user.role === 'ORG_ADMIN') {
    req.tenantId = branchId;
  }
  next();
}
