import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as adminService from '../services/admin.service';

export const getDashboardHandler = asyncHandler(async (_req: Request, res: Response) => {
  const dashboard = await adminService.getDashboard();
  res.json({ dashboard });
});

export const listUsersHandler = asyncHandler(async (req: Request, res: Response) => {
  const { search, page, pageSize } = req.query as unknown as { search?: string; page: number; pageSize: number };
  const result = await adminService.listUsers({ search, page, pageSize });
  res.json(result);
});

export const setUserStatusHandler = asyncHandler(async (req: Request, res: Response) => {
  const user = await adminService.setUserStatus(req.user!.id, req.params.id, req.body.status);
  res.json({ user });
});

export const setUserRoleHandler = asyncHandler(async (req: Request, res: Response) => {
  const user = await adminService.setUserRole(req.user!.id, req.params.id, req.body.role);
  res.json({ user });
});

export const deleteUserHandler = asyncHandler(async (req: Request, res: Response) => {
  await adminService.deleteUser(req.user!.id, req.params.id);
  res.status(204).send();
});
