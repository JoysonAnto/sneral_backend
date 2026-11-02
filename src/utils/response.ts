interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    message?: string;
    pagination?: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        current_page: number;
        per_page: number;
        last_page: number;
    };
    timestamp: string;
}

export const successResponse = <T>(
    data: T,
    message?: string,
    pagination?: {
        page?: number;
        limit?: number;
        total: number;
        totalPages?: number;
        current_page?: number;
        per_page?: number;
        last_page?: number;
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
        const pageNum = pagination.current_page || pagination.page || 1;
        const limitNum = pagination.per_page || pagination.limit || 10;
        const totalNum = pagination.total || 0;
        const totalPages = pagination.totalPages || pagination.last_page || Math.max(1, Math.ceil(totalNum / limitNum));

        response.pagination = {
            page: pageNum,
            limit: limitNum,
            total: totalNum,
            totalPages,
            current_page: pageNum,
            per_page: limitNum,
            last_page: totalPages,
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
