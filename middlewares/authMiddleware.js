import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { Roles } from '../constant/role.js';

export const authMiddleware = (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        if (!token) {
            return res.status(401).json({
                status: false,
                message: 'Authorization token is required'
            });
        }

        jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
            if (err) {
                return res.status(401).json({
                    status: false,
                    message: 'Invalid or expired token'
                });
            }

            const user = await User.findById(decoded._id);
            if (!user) {
                return res.status(404).json({
                    status: false,
                    message: 'User not found'
                });
            }

            req.user = user;
            next();
        });
    } catch (error) {
        console.error('Error in authentication middleware:', error);
        res.status(500).json({
            status: false,
            message: 'Internal server error'
        });
    }
};

export const isGroundStaff = (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                status: false,
                message: 'User not authenticated'
            });
        }

        if (req.user.role !== Roles.GROUND_STAFF) {
            return res.status(403).json({
                status: false,
                message: 'Access denied: Not authorized as ground staff'
            });
        }

        next();
    } catch (error) {
        console.error('Error in ground staff middleware:', error);
        res.status(500).json({
            status: false,
            message: 'Internal server error'
        });
    }
};


export const authorizeRoles = (roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                status: false,
                message: `Role: ${req.user.role} is not allowed to access this resource`
            });
        }
        next();
    };
}; 