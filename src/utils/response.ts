interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    message?: string;
    pagination?: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
    timestamp: string;
}

export const successResponse = <T>(
    data: T,
    message?: string,
    pagination?: {
        page: number;
        limit: number;
        total: number;
    }
): ApiResponse<T> => {
    const response: ApiResponse<T> = {
        success: true,
        data,
        timestamp: new Date().toISOString(),
    };

    if (message) {
        response.message = message;
    }

    if (pagination) {
        response.pagination = {
            ...pagination,
            totalPages: Math.ceil(pagination.total / pagination.limit),
        };
    }

    return response;
};

export const errorResponse = (
    message: string
): ApiResponse => {
    return {
        success: false,
        message,
        timestamp: new Date().toISOString(),
    };
};
