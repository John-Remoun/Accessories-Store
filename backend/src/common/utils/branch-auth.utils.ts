import { Request } from 'express';
import { AppError } from '../exceptions/app-error';
import { AppDataSource } from '../../config/data-source';
import { UserEntity } from '../../modules/users/user.entity';

export interface BranchScope {
  isGlobalAdmin: boolean;
  branchId?: string;
  user: {
    userId: string;
    username: string;
    role: string;
    branchId?: string;
  };
}

/**
 * Resolves the authenticated user's branch-level authorization scope.
 *
 * Authorization Rules:
 * 1. Global Administrators ('admin' / 'super_admin'):
 *    - Have full cross-branch permissions.
 *    - If targetBranchId is specified, the admin operates on that branch.
 *    - If no targetBranchId is specified, the admin operates globally across all branches.
 *
 * 2. Non-Administrators ('employee' / 'manager'):
 *    - Never trust a client-supplied branchId as proof of permission!
 *    - The user must have a valid branch assignment in their JWT or user record.
 *    - If the user has no branch assignment, access is REJECTED (403 Forbidden).
 *    - If targetBranchId is specified and differs from user's assigned branch, access is REJECTED (403 Forbidden).
 *    - Operations are strictly bound to the user's assigned branchId.
 */
export async function resolveBranchScope(req: Request, targetBranchId?: string): Promise<BranchScope> {
  const reqUser = (req as any).user;
  if (!reqUser) {
    throw new AppError('Unauthorized: Authentication required', 401);
  }

  const role = reqUser.role;
  const isGlobalAdmin = role === 'admin' || role === 'super_admin';

  if (isGlobalAdmin) {
    return {
      isGlobalAdmin: true,
      branchId: targetBranchId ? targetBranchId.trim() : undefined,
      user: reqUser,
    };
  }

  // Non-administrator: resolve their assigned branch
  let assignedBranch = reqUser.branchId;

  // Fallback: If token was minted without branchId, resolve from database
  if (!assignedBranch && reqUser.userId && AppDataSource.isInitialized) {
    try {
      const userRepo = AppDataSource.getRepository(UserEntity);
      const dbUser = await userRepo.findOne({
        where: { id: reqUser.userId },
        select: ['id', 'branchId'],
      });
      if (dbUser && dbUser.branchId) {
        assignedBranch = dbUser.branchId;
        reqUser.branchId = dbUser.branchId;
      }
    } catch {
      // In tests or if DB is offline, rely on token state
    }
  }

  if (!assignedBranch || !assignedBranch.trim()) {
    throw new AppError('Forbidden: Your account is not assigned to any branch. Please contact an administrator.', 403);
  }

  assignedBranch = assignedBranch.trim();

  // If a target branch was supplied by client (via query, params, or body), verify match
  if (targetBranchId && targetBranchId.trim()) {
    const cleanTarget = targetBranchId.trim();
    if (cleanTarget !== assignedBranch) {
      throw new AppError(`Forbidden: Access denied to branch '${cleanTarget}'. You are only authorized for branch '${assignedBranch}'.`, 403);
    }
  }

  return {
    isGlobalAdmin: false,
    branchId: assignedBranch,
    user: reqUser,
  };
}
