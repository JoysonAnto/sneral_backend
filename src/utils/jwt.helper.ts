import jwt from 'jsonwebtoken';

const JWT_SECRET = (process.env.JWT_SECRET || 'default-secret-key') as jwt.Secret;
const JWT_REFRESH_SECRET = (process.env.REFRESH_TOKEN_SECRET || 'default-refresh-secret') as jwt.Secret;

interface TokenPayload {
    userId: string;
    role: string;
    email: string;
}

export const generateAccessToken = (payload: TokenPayload): string => {
    return jwt.sign(payload, JWT_SECRET, {
        expiresIn: (process.env.JWT_EXPIRY || '15m') as string | number
    } as jwt.SignOptions);
};

export const generateRefreshToken = (userId: string): string => {
    return jwt.sign({ userId }, JWT_REFRESH_SECRET, {
        expiresIn: (process.env.REFRESH_TOKEN_EXPIRY || '7d') as string | number
    } as jwt.SignOptions);
};

export const verifyAccessToken = (token: string): TokenPayload => {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
};

export const verifyRefreshToken = (token: string): { userId: string } => {
    return jwt.verify(token, JWT_REFRESH_SECRET) as { userId: string };
};
