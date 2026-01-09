import { Request, Response, NextFunction } from 'express';
import { UserService } from '../services/user.service';
import { successResponse } from '../utils/response';

export class UserController {
    private userService: UserService;

    constructor() {
        this.userService = new UserService();
    }

    getAllUsers = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await this.userService.getAllUsers(req.query);
            res.json(
                successResponse(
                    result.users,
                    'Users retrieved successfully',
                    result.pagination
                )
            );
        } catch (error) {
            next(error);
        }
    };

    getUserById = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = await this.userService.getUserById(req.params.id);
            res.json(successResponse(user, 'User retrieved successfully'));
        } catch (error) {
            next(error);
        }
    };

    createAdmin = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const admin = await this.userService.createAdmin(req.body, req.user!.role);
            res.status(201).json(successResponse(admin, 'Admin created successfully'));
        } catch (error) {
            next(error);
        }
    };

    updateUser = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = await this.userService.updateUser(req.params.id, req.body);
            res.json(successResponse(user, 'User updated successfully'));
        } catch (error) {
            next(error);
        }
    };

    deleteUser = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await this.userService.deleteUser(req.params.id, req.user!.role);
            res.json(successResponse(result, result.message));
        } catch (error) {
            next(error);
        }
    };
}
