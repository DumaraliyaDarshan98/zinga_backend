import User from '../models/User.js';
import bcrypt from 'bcryptjs';
import { generateLoginToken } from '../utils/generateJWT.js';
import Ground from '../models/Ground.js';
import { Roles } from '../constant/role.js';

export const registerUser = async (req, res) => {
    const { name, email, password, role, mobile } = req.body;

    try {
        const userExists = await User.findOne({ role, mobile });
        if (userExists) {
            return res.status(400).json({
                message: 'User already exists',
                data: null,
                status: false
            });
        }

        let approve = false;

        if (role === Roles.PLAYER) {
            approve = true;
        }

        const user = await User.create({ name, email, password, role, mobile, approve });

        const token = generateLoginToken({ _id: user._id, name, email, role, approve: user?.approve }, '30d');

        const data = JSON.parse(JSON.stringify(user));

        delete data.password;
        res.status(201).json({
            message: 'User Registration Success',
            data: {
                token,
                user: data
            },
            status: true
        });
    } catch (error) {
        res.status(500).json({
            status: false,
            data: null,
            message: error.message
        });
    }
};

export const mobileloginUser = async (req, res) => {
    const { mobile, role } = req.body;

    try {

        if (!mobile || !role) {
            return res.status(400).json({
                message: 'Invalid credentials',
                data: null,
                status: false
            });
        }

        const user = await User.findOne({ mobile, role });

        if (user?.isDeleted) {
            return res.status(404).json({
                message: 'User not found',
                data: null,
                status: false
            });
        }


        if (!user) {
            return res.status(404).json({
                message: 'Invalid credentials',
                data: null,
                status: false
            });
        }

        if (!user?.approve) {
            return res.status(404).json({
                message: 'User not approved',
                data: null,
                status: false
            });
        }

        const data = JSON.parse(JSON.stringify(user));
        delete data.password;
        const token = generateLoginToken({ _id: user._id, name: user.name, email: user?.email, role: user?.role, mobile: user?.mobile, approve: user?.approve }, '30d');
        res.status(200).json({
            message: 'Login successful',
            data: {
                token,
                user: data
            },
            status: true
        });
    } catch (error) {
        res.status(500).json({
            status: false,
            data: null,
            message: error.message
        });
    }
};

export const loginUser = async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await User.findOne({ email: email?.toLowerCase() });

        if (user?.isDeleted) {
            return res.status(404).json({
                message: 'User not found',
                data: null,
                status: false
            });
        }


        if (!user) {
            return res.status(404).json({
                message: 'Invalid credentials',
                data: null,
                status: false
            });
        }

        if (!user?.approve) {
            return res.status(404).json({
                message: 'User not approved',
                data: null,
                status: false
            });
        }
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({
                message: 'Invalid credentials',
                data: null,
                status: false
            });
        }

        const data = JSON.parse(JSON.stringify(user));
        delete data.password;
        const token = generateLoginToken({ _id: user._id, name: user.name, email: user?.email, role: user?.role, mobile: user?.mobile, approve: user?.approve }, '30d');
        res.status(200).json({
            message: 'Login successful',
            data: {
                token,
                user: data
            },
            status: true
        });
    } catch (error) {
        res.status(500).json({
            status: false,
            data: null,
            message: error.message
        });
    }
};

export const resetPassword = async (req, res) => {
    try {
        const { oldPassword, newPassword } = req.body;
        const { _id } = req.user;

        const user = await User.findById(_id);
        if (!user) {
            return res.status(404).json({
                message: 'User not found',
                data: null,
                status: false
            });
        }
        const isPasswordValid = await bcrypt.compare(oldPassword, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({
                message: 'Invalid old password',
                data: null,
                status: false
            });
        }

        user.password = newPassword;
        await user.save();

        return res.status(200).json({
            message: 'Password reset successful',
            data: null,
            status: true
        });
    }
    catch (error) {
        return res.status(500).json({
            status: false,
            data: null,
            message: error.message
        });
    }
}

export const updateUser = async (req, res) => {
    try {

        const userId = req?.user;

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                data: null,
                status: false,
                message: 'User not found'
            });
        }

        for (const key in req.body) {
            user[key] = req.body[key];
        }

        user.loggedIn = true;

        await user.save();

        return res.status(200).json({
            data: user,
            status: true,
            message: 'User update successfully'
        });

    } catch (error) {
        return res.status(500).json({
            data: null,
            message: error.message,
            status: false
        })
    }
}

export const deleteUser = async (req, res) => {
    try {
        const userId = req.params.id;
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                data: null,
                message: 'User not found',
                status: false
            });
        }
        user.isDeleted = true;
        await user.save();
        return res.status(200).json({
            data: user,
            message: 'User deleted successfully',
            status: true
        });
    } catch (error) {
        return res.status(500).json({
            data: null,
            message: error.message,
            status: false
        })
    }
}

export const memberRegister = async (req, res) => {
    try {
        const users = req.body;
        if (Array.isArray(users) && users.length > 0) {
            let processed = 0;
            let skipped = 0;

            for (const userData of users) {
                const { name, mobile, email, groundId, age, height, dob, avatar } = userData;

                if (email && groundId) {
                    const user = await User.findOne({ email });
                    if (user) {
                        // Check if groundId already exists
                        if (!user.groundAdded.includes(groundId)) {
                            user.groundAdded.push(groundId);
                            await user.save();
                            processed++;
                        } else {
                            skipped++;
                        }
                    } else {
                        const newUser = new User({
                            name,
                            mobile,
                            password: mobile, // Set password to mobile for simplicity
                            email,
                            age,
                            height,
                            dob,
                            avatar,
                            groundAdded: [groundId],
                        });
                        await newUser.save();
                        processed++;
                    }
                } else {
                    skipped++;
                }
            }

            return res.status(200).json({
                status: true,
                message: 'User processing complete',
                processed,
                skipped,
            });
        } else {
            return res.status(400).json({ status: false, message: 'Invalid input. Array of users is required.' });
        }
    } catch (error) {
        return res.status(500).json({
            data: null,
            message: error.message,
            status: false
        })
    }
}

export const memberList = async (req, res) => {
    try {
        const role = req.user.role;
        const userId = req.user._id;

        if (role !== "admin") {
            const grounds = await User.findById(userId).select("groundAdded");
            if (!grounds) {
                return res.status(404).json({
                    data: null,
                    message: 'User not found',
                    status: false
                });
            }

            const memberList = await User.find({ groundAdded: { $in: [...grounds.groundAdded] }, role: Roles.PLAYER });

            return res.status(200).json({ data: memberList, message: "Member List fetched", status: true });
        } else {
            const memberList = await User.find({ role: Roles.PLAYER });

            return res.status(200).json({ data: memberList, message: "Member List fetched", status: true });
        }



    } catch (error) {
        return res.status(500).json({
            data: null,
            message: error.message,
            status: false
        })
    }
}

export const approveUser = async (req, res) => {
    try {
        const userId = req.params.id;
        const { approve } = req.body;
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                data: null,
                message: 'User not found',
                status: false
            });
        }
        user.approve = approve;
        await user.save();
        return res.status(200).json({
            data: user,
            message: 'User approved successfully',
            status: true
        });

    } catch (error) {
        return res.status(500).json({
            data: null,
            message: error.message,
            status: false
        })
    }
}

export const getUsers = async (req, res) => {
    try {
        const { name, mobile, role } = req.query;

        // Build filter object
        const filter = { isDeleted: false };

        // Add filters if provided
        if (name) {
            filter.name = { $regex: name, $options: 'i' };
        }
        if (mobile) {
            filter.mobile = { $regex: mobile, $options: 'i' };
        }
        if (role) {
            filter.role = role;
        }

        const users = await User.find(filter).select('-password');

        return res.status(200).json({
            data: users,
            status: true,
            message: 'Users retrieved successfully'
        });
    } catch (error) {
        return res.status(500).json({
            data: null,
            message: error.message,
            status: false
        });
    }
};

export const returnUserId = async (req, res) => {
    try {

        const { mobile, email, name } = req.body;

        const user = await User.findOne({ mobile });

        if (!user) {
            // create new user with role player and return user details
            const newUser = new User({
                name,
                email,
                mobile,
                role: Roles.PLAYER,
                approve: true,
                password: mobile
            });
            await newUser.save();
            return res.status(200).json({ data: newUser, message: 'User created successfully', status: true });

        }

        return res.status(200).json({
            data: user,
            message: 'User found',
            status: true
        });

    } catch (error) {
        return res.status(500).json({
            data: null,
            message: error.message,
            status: false
        })
    }
}

export const getUserProfile = async (req, res) => {
    try {
        // Get user ID from the authenticated token
        const userId = req.user._id;
        
        // Find the user with their achievements and other related data
        const user = await User.findById(userId)
            .select('-password')
            .populate({
                path: 'tournamentAchievements.tournament',
                select: 'tournamentId seriesName tournamentType'
            })
            .populate({
                path: 'tournamentAchievements.teamId',
                select: 'teamName logo'
            })
            .populate('clubs', 'name logo');
            
        if (!user) {
            return res.status(404).json({
                data: null,
                message: 'User not found',
                status: false
            });
        }
        
        return res.status(200).json({
            data: user,
            message: 'User profile fetched successfully',
            status: true
        });
    } catch (error) {
        return res.status(500).json({
            data: null,
            message: error.message,
            status: false
        });
    }
}
