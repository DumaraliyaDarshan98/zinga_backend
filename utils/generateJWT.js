import jwt from 'jsonwebtoken';

export const generateLoginToken = (data, expiresIn) => {
    return jwt.sign(
        data,
        process.env.JWT_SECRET,
        { expiresIn }
    );
}