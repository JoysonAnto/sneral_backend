import { Request, Response, NextFunction } from 'express';
import { RoleService } from '../services/role.service';
import { successResponse } from '../utils/response';

export class RoleController {
    private roleService: RoleService;

    constructor() {
        this.roleService = new RoleService();
    }

    getAllRoles = async (_req: Request, res: Response, next: NextFunction) => {
        try {
            const roles = await this.roleService.getAllRoles();
            res.json(successResponse(roles, 'Roles retrieved successfully'));
        } catch (error) {
            next(error);
        }
    };

    getRoleById = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const role = await this.roleService.getRoleById(req.params.id);
            res.json(successResponse(role, 'Role retrieved successfully'));
        } catch (error) {
            next(error);
        }
    };

    createRole = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const role = await this.roleService.createRole(req.body);
            res.status(201).json(successResponse(role, 'Role created successfully'));
        } catch (error) {
            next(error);
        }
    };

    updateRole = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const role = await this.roleService.updateRole(req.params.id, req.body);
            res.json(successResponse(role, 'Role updated successfully'));
        } catch (error) {
            next(error);
        }
    };

    deleteRole = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await this.roleService.deleteRole(req.params.id);
            res.json(successResponse(result, 'Role deleted successfully'));
        } catch (error) {
            next(error);
        }
    };

    getPermissions = async (_req: Request, res: Response, next: NextFunction) => {
        try {
            const permissions = await this.roleService.getAllPermissions();
            res.json(successResponse(permissions, 'Permissions retrieved successfully'));
        } catch (error) {
            next(error);
        }
    };
}
