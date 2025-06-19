import mongoose from 'mongoose';
import { Roles } from '../constant/role.js';
import Ground from '../models/Ground.js';
import User from '../models/User.js';
import GroundActivity from '../models/GroundActivity.js';
import moment from 'moment';
import PriceManagement from '../models/PriceManagement.js';
import { getApplicablePriceForSlot } from './priceManagementController.js';

// Track activity helper function
const trackGroundActivity = async (userId, groundId, activityType, details = {}) => {
    try {
        const activity = new GroundActivity({
            groundId,
            userId,
            activityType,
            details
        });
        await activity.save();
    } catch (error) {
        console.error('Error tracking ground activity:', error);
    }
};

export const createGround = async (req, res) => {
    try {
        req.body.createdBy = req.user._id;
        const ground = new Ground(req.body);
        await ground.save();

        // Track activity
        await trackGroundActivity(
            req.user._id,
            ground._id,
            'create',
            { name: ground.name, city: ground.city }
        );

        res.status(201).json({
            status: true,
            data: ground,
            message: 'Ground created successfully',
        });
    } catch (error) {
        res.status(400).json({
            status: false,
            data: null,
            message: error.message,
        });
    }
};

export const groundDashboardStaff = async (req, res) => {
    try {
        let { startDate, endDate } = req.query;

        const matchStage = {
            courts: { $exists: true, $not: { $size: 0 } },
        };

        if (startDate && endDate) {
            startDate = new Date(startDate);
            endDate = new Date(endDate);
            endDate.setHours(23, 59, 59, 999);

            matchStage.createdAt = { $gte: startDate, $lte: endDate };
        }
        const result = await Ground.aggregate([
            {
                $match: matchStage,
            },
            {
                $project: {
                    createdAt: 1,
                    courtCount: { $size: "$courts" }, // Count the number of courts
                },
            },
            {
                $facet: {
                    daily: [
                        {
                            $group: {
                                _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                                count: { $sum: "$courtCount" },
                            },
                        },
                        { $sort: { _id: 1 } },
                    ],
                    monthly: [
                        {
                            $group: {
                                _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
                                count: { $sum: "$courtCount" },
                            },
                        },
                        { $sort: { _id: 1 } },
                    ],
                    total: [
                        {
                            $group: {
                                _id: null,
                                count: { $sum: "$courtCount" },
                            },
                        },
                    ],
                },
            },
        ]);

        const data = {
            daily: result[0]?.daily || [],
            monthly: result[0]?.monthly || [],
            total: result[0]?.total[0]?.count || 0,
        };

        res.status(200).json({
            status: true,
            data,
            message: "Court counts retrieved successfully",
        });
    } catch (error) {
        res.status(500).json({
            status: false,
            data: null,
            message: error.message,
        });
    }
}

export const groundCompletedStaff = async (req, res) => {
    try {

        const result = await Ground.find({
            courts: { $exists: true, $not: { $size: 0 } },
        }, { courts: 0, users: 0 });

        res.status(200).json({
            status: true,
            data: result,
            message: "Completed ground successfully",
        });
    } catch (error) {
        res.status(500).json({
            status: false,
            data: null,
            message: error.message,
        });
    }
}

export const getAllGrounds = async (req, res) => {
    try {

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const query = {};

        if (req.user.role === Roles.GROUND_OWNER) {
            const user = await User.findById(req.user._id).select('groundAdded')
            if (user && user.groundAdded) {
                query._id = { $in: user.groundAdded };
            }
        }

        const grounds = await Ground.find(query, { courts: 0, users: 0 }).populate('createdBy', 'name email mobile').sort({ createdAt: -1 }).skip(skip).limit(limit);
        const total = await Ground.countDocuments(query);

        return res.status(200).json({
            status: true,
            data: {
                grounds,
                metaData: {
                    total,
                    page,
                    limit,
                    pages: Math.ceil(total / limit)
                }
            },
            message: 'Grounds retrieved successfully'
        });
    } catch (error) {
        res.status(500).json({ status: false, message: error.message });
    }
};

export const getGroundById = async (req, res) => {
    try {
        const groundId = new mongoose.Types.ObjectId(req.params.id);
        const { bookingDateFrom, bookingDateTo } = req.query;

        if (!bookingDateFrom && !bookingDateTo) {
            const ground = await Ground.aggregate([
                { $match: { _id: groundId } },
                { $unwind: { path: "$courts", preserveNullAndEmptyArrays: true } },
                { $sort: { "courts.name": 1 } },
                { $unwind: { path: "$courts.times", preserveNullAndEmptyArrays: true } },
                { $sort: { "courts.times.day": 1 } },
                { $unwind: { path: "$courts.times.slots", preserveNullAndEmptyArrays: true } },

                // Group by court and day
                {
                    $group: {
                        name: { $first: "$name" },
                        address1: { $first: "$address1" },
                        address2: { $first: "$address2" },
                        city: { $first: "$city" },
                        state: { $first: "$state" },
                        pincode: { $first: "$pincode" },
                        coordinates: { $first: "$coordinates" },
                        googleLink: { $first: "$googleLink" },
                        amenities: { $first: "$amenities" },
                        users: { $first: "$users" },
                        status: { $first: "$status" },
                        _id: {
                            courtId: "$courts._id",
                            day: "$courts.times.day",
                        },
                        courtId: { $first: "$courts._id" },
                        courtname: { $first: "$courts.name" },
                        games: { $first: "$courts.games" },
                        day: { $first: "$courts.times.day" },
                        isClosed: { $first: "$courts.times.isClosed" },
                        range: { $first: "$courts.times.range" },
                        slots: { $push: "$courts.times.slots" },
                    },
                },
                { $sort: { "day": 1 } },
                // Group by court
                {
                    $group: {
                        _id: "$courtId",
                        name: { $first: "$name" },
                        address1: { $first: "$address1" },
                        address2: { $first: "$address2" },
                        city: { $first: "$city" },
                        state: { $first: "$state" },
                        pincode: { $first: "$pincode" },
                        coordinates: { $first: "$coordinates" },
                        googleLink: { $first: "$googleLink" },
                        amenities: { $first: "$amenities" },
                        users: { $first: "$users" },
                        status: { $first: "$status" },
                        courtname: { $first: "$courtname" },
                        games: { $first: "$games" },
                        times: {
                            $push: {
                                day: "$day",
                                isClosed: "$isClosed",
                                range: { $ifNull: ["$range", []] },
                                slots: { $ifNull: ["$slots", []] },
                            },
                        },
                    },
                },

                // Group everything into the ground level
                {
                    $group: {
                        _id: groundId,
                        name: { $first: "$name" },
                        address1: { $first: "$address1" },
                        address2: { $first: "$address2" },
                        city: { $first: "$city" },
                        state: { $first: "$state" },
                        pincode: { $first: "$pincode" },
                        coordinates: { $first: "$coordinates" },
                        googleLink: { $first: "$googleLink" },
                        amenities: { $first: "$amenities" },
                        users: { $first: "$users" },
                        status: { $first: "$status" },
                        courts: {
                            $push: {
                                _id: "$_id",
                                name: "$courtname",
                                games: "$games",
                                times: "$times",
                            },
                        },
                    },
                },

                {
                    $project: {
                        _id: 1,
                        name: 1,
                        address1: 1,
                        address2: 1,
                        city: 1,
                        state: 1,
                        pincode: 1,
                        coordinates: 1,
                        googleLink: 1,
                        amenities: 1,
                        users: 1,
                        courts: 1,
                        status: 1,
                    },
                },
            ]);

            if (!ground || ground.length === 0) {
                return res.status(404).json({
                    status: false,
                    data: null,
                    message: "Ground not found",
                });
            }

            res.status(200).json({
                status: true,
                data: ground[0],
                message: "Ground and court availability retrieved successfully",
            });
        } else {

            let dateArray = [];
            if (bookingDateFrom && bookingDateTo) {
                const fromDate = new Date(bookingDateFrom);
                const toDate = new Date(bookingDateTo);

                if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
                    return res.status(400).json({
                        status: false,
                        data: null,
                        message: "Invalid booking date format",
                    });
                }

                let currentDate = fromDate;
                while (currentDate <= toDate) {
                    dateArray.push(new Date(currentDate)); // Store copies of dates
                    currentDate.setDate(currentDate.getDate() + 1);
                }
            }

            const bookingPromises = dateArray.map(async (date) => {
                return Ground.aggregate([
                    { $match: { _id: groundId } },
                    { $unwind: { path: "$courts", preserveNullAndEmptyArrays: true } },
                    { $unwind: { path: "$courts.times", preserveNullAndEmptyArrays: true } },
                    { $unwind: { path: "$courts.times.slots", preserveNullAndEmptyArrays: true } },

                    {
                        $lookup: {
                            from: "bookings",
                            let: {
                                slotId: "$courts.times.slots._id",
                                courtId: "$courts._id",
                            },
                            pipeline: [
                                {
                                    $match: {
                                        $expr: {
                                            $and: [
                                                { $eq: ["$slotId", "$$slotId"] },
                                                { $eq: ["$courtId", "$$courtId"] },
                                                { $eq: ["$groundId", groundId] },
                                                { $eq: ["$bookingDate", date] },
                                            ],
                                        },
                                    },
                                },
                                {
                                    $lookup: {
                                        from: "users",
                                        localField: "userId",
                                        foreignField: "_id",
                                        as: "userDetails",
                                    },
                                },
                                {
                                    $unwind: {
                                        path: "$userDetails",
                                        preserveNullAndEmptyArrays: true,
                                    },
                                },
                            ],
                            as: "bookingDetails",
                        },
                    },
                    {
                        $addFields: {
                            "courts.times.slots.isBooked": {
                                $gt: [{ $size: "$bookingDetails" }, 0],
                            },
                            "courts.times.slots.bookedBy": {
                                $map: {
                                    input: "$bookingDetails",
                                    as: "booking",
                                    in: {
                                        _id: "$$booking.userDetails._id",
                                        name: "$$booking.userDetails.name",
                                        email: "$$booking.userDetails.email",
                                        date: date
                                    },
                                },
                            },
                        },
                    },
                    {
                        $group: {
                            _id: {
                                courtId: "$courts._id",
                                day: "$courts.times.day",
                            },
                            courtname: { $first: "$courts.name" },
                            games: { $first: "$courts.games" },
                            day: { $first: "$courts.times.day" },
                            isClosed: { $first: "$courts.times.isClosed" },
                            slots: { $push: "$courts.times.slots" },
                        },
                    },
                ]);
            });

            const bookingResults = await Promise.all(bookingPromises);

            let finalResult = {};
            bookingResults.flat().forEach((court) => {
                if (!finalResult[court._id.courtId]) {
                    finalResult[court._id.courtId] = {
                        _id: court._id.courtId,
                        courtname: court.courtname,
                        games: court.games,
                        times: {},
                    };
                }

                const dayKey = court.day;
                if (!finalResult[court._id.courtId].times[dayKey]) {
                    finalResult[court._id.courtId].times[dayKey] = {
                        day: court.day,
                        isClosed: court.isClosed,
                        slots: {},
                    };
                }

                court.slots.forEach((slot) => {
                    const slotKey = slot._id?.toString();

                    if (!finalResult[court._id.courtId].times[dayKey].slots[slotKey]) {
                        finalResult[court._id.courtId].times[dayKey].slots[slotKey] = {
                            ...slot,
                            bookedBy: [...slot.bookedBy],
                        };
                    } else {
                        finalResult[court._id.courtId].times[dayKey].slots[slotKey].bookedBy.push(...slot.bookedBy);
                    }
                });
            });

            // Process slot pricing for all dates in the range
            const slotPricingPromises = [];
            
            for (const courtId of Object.keys(finalResult)) {
                for (const dayKey of Object.keys(finalResult[courtId].times)) {
                    for (const slotKey of Object.keys(finalResult[courtId].times[dayKey].slots)) {
                        for (const date of dateArray) {
                            const formattedDate = moment(date).format('YYYY-MM-DD');
                            
                            slotPricingPromises.push(
                                (async () => {
                                    const specialPricing = await getApplicablePriceForSlot(
                                        groundId.toString(), 
                                        courtId, 
                                        slotKey, 
                                        formattedDate
                                    );
                                    
                                    if (specialPricing) {
                                        // Directly override the price, tournamentPrice, and isTournament if provided
                                        finalResult[courtId].times[dayKey].slots[slotKey].price = specialPricing.price;
                                        finalResult[courtId].times[dayKey].slots[slotKey].tournamentPrice = specialPricing.tournamentPrice;
                                        
                                        // Update isTournament flag if it was specified in the pricing entry
                                        if (specialPricing.isTournament !== undefined) {
                                            finalResult[courtId].times[dayKey].slots[slotKey].isTournament = specialPricing.isTournament;
                                        }
                                    }
                                })()
                            );
                        }
                    }
                }
            }
            
            await Promise.all(slotPricingPromises);

            // Convert the object values back to arrays for the response
            Object.keys(finalResult).forEach((courtId) => {
                finalResult[courtId].times = Object.values(finalResult[courtId].times).map((dayEntry) => ({
                    ...dayEntry,
                    slots: Object.values(dayEntry.slots),
                }));
            });

            const ground = await Ground.findById(req.params.id);

            res.status(200).json({
                status: true,
                data: { ...ground.toObject(), courts: Object.values(finalResult) },
                message: "Ground and court availability retrieved successfully",
            });
        }

    } catch (error) {
        res.status(500).json({
            status: false,
            data: null,
            message: error.message,
        });
    }
};


const splitTimeIntoSlots = (rangeArray, defaultPrice, defaultTournamentPrice) => {
    let slots = [];

    rangeArray.forEach(({ from, to, price, tournamentPrice }) => {
        let startTime = moment(from, "hh:mm A");
        let endTime = moment(to, "hh:mm A");

        while (startTime < endTime) {
            let nextTime = moment(startTime).add(1, "hours");

            if (nextTime > endTime) {
                nextTime = endTime;
            }

            slots.push({
                from: startTime.format("hh:mm A"),
                to: nextTime.format("hh:mm A"),
                isTournament: false,
                price: price || defaultPrice, // Use provided price or default
                tournamentPrice: tournamentPrice || defaultTournamentPrice // Use provided tournament price or default
            });

            startTime = nextTime;
        }
    });

    return slots;
};

export const updateGround = async (req, res) => {
    try {
        let ground = await Ground.findById(req.params.id);
        if (!ground) {
            return res.status(404).json({
                status: false,
                data: null,
                message: 'Ground not found',
            });
        }

        if (req.body.courts) {
            req.body.courts = req.body.courts.map(court => {
                return {
                    ...court,
                    times: court.times.map(timeEntry => {
                        return {
                            ...timeEntry,
                            slots: splitTimeIntoSlots(
                                timeEntry.range, 
                                timeEntry?.price || 0,
                                timeEntry?.tournamentPrice || 0
                            ),
                        };
                    }),
                };
            });
        }

        ground = await Ground.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true,
        });

        // Track activity
        await trackGroundActivity(
            req.user._id,
            ground._id,
            'update',
            { name: ground.name, fieldsUpdated: Object.keys(req.body) }
        );

        const { users } = req.body;
        if (users && users.length > 0) {
            const promises = users.map(async ({ name, email, mobile, role }) => {
                const userExists = await User.findOne({ email: email?.toLowerCase() });

                if (!userExists) {
                    const data = {
                        name,
                        email,
                        password: mobile,
                        role,
                        mobile,
                        groundAdded: [ground._id],
                    };
                    await User.create(data);
                } else {
                    await User.findByIdAndUpdate(
                        userExists._id,
                        { $addToSet: { groundAdded: ground._id } },
                        { new: true }
                    );
                }
            });

            await Promise.all(promises);
        }

        res.status(200).json({
            status: true,
            data: ground,
            message: 'Ground updated successfully',
        });
    } catch (error) {
        res.status(400).json({
            status: false,
            data: null,
            message: error.message,
        });
    }
};


export const deleteGround = async (req, res) => {
    try {
        const ground = await Ground.findByIdAndDelete(req.params.id);
        if (!ground) {
            return res.status(404).json({
                status: false,
                data: null,
                message: 'Ground not found'
            });
        }

        // Track activity
        await trackGroundActivity(
            req.user._id,
            ground._id,
            'delete',
            { name: ground.name }
        );

        res.status(200).json({
            status: true,
            data: null,
            message: 'Ground deleted statusfully'
        });
    } catch (error) {
        res.status(500).json({
            status: false,
            data: null,
            message: error.message
        });
    }
};

export const updateSlotsTournamentStatus = async (req, res) => {
    try {
        const { slotIds, isTournament } = req.body;

        if (!Array.isArray(slotIds) || slotIds.length === 0 || typeof isTournament !== 'boolean') {
            return res.status(400).json({
                status: false,
                message: 'Slot IDs array and isTournament boolean are required',
                data: null
            });
        }

        // Update all slots using $elemMatch to target the correct nested slots
        const result = await Ground.updateMany(
            { 'courts.times.slots._id': { $in: slotIds } },
            {
                $set: {
                    'courts.$[].times.$[].slots.$[slot].isTournament': isTournament
                }
            },
            {
                arrayFilters: [
                    { 'slot._id': { $in: slotIds } }
                ]
            }
        );

        if (result.modifiedCount === 0) {
            return res.status(404).json({
                status: false,
                message: 'No slots found to update',
                data: null
            });
        }

        // Get updated ground with slots
        const updatedGrounds = await Ground.find({
            'courts.times.slots._id': { $in: slotIds }
        });

        // Track activity for each ground
        for (const ground of updatedGrounds) {
            await trackGroundActivity(
                req.user._id,
                ground._id,
                'update',
                {
                    slotIds,
                    isTournament,
                    action: 'update_tournament_slots'
                }
            );
        }

        return res.status(200).json({
            status: true,
            message: 'Slots tournament status updated successfully',
            data: updatedGrounds
        });
    } catch (error) {
        console.error('Error updating slots tournament status:', error);
        return res.status(500).json({
            status: false,
            message: error.message,
            data: null
        });
    }
};

/**
 * Get ground activities with pagination
 */
export const getGroundActivities = async (req, res) => {
    try {
        const { groundId } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const activityType = req.query.activityType; // Optional filter by activity type

        // Build query
         const query = { groundId };
        if (activityType) {
            query.activityType = activityType;
        }

        // Fetch activities with pagination
        const activities = await GroundActivity.find(query)
            .populate('userId', 'name email')
            .populate('groundId', 'name city address1')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        // Get total count
        const total = await GroundActivity.countDocuments(query);

        return res.status(200).json({
            status: true,
            data: {
                activities,
                metaData: {
                    total,
                    page,
                    limit,
                    pages: Math.ceil(total / limit)
                }
            },
            message: 'Ground activities retrieved successfully'
        });
    } catch (error) {
        console.error('Error fetching ground activities:', error);
        return res.status(500).json({
            status: false,
            message: error.message,
            data: null
        });
    }
};

/**
 * Get ground activities with pagination
 */
export const getGroundOwnerActivities = async (req, res) => {
    try {
        const userId = req.user._id;
        console.log("userId", userId);
        
        // Validate userId is a valid ObjectId
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({
                status: false,
                message: 'Invalid user ID format',
                data: null
            });
        }

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const activityType = req.query.activityType; // Optional filter by activity type

        // First, find all grounds associated with this user
        const user = await User.findById(userId).select('groundAdded');
        if (!user) {
            return res.status(404).json({
                status: false,
                message: 'User not found',
                data: null
            });
        }

        // Validate groundAdded array
        if (!user.groundAdded || !Array.isArray(user.groundAdded) || user.groundAdded.length === 0) {
            return res.status(200).json({
                status: true,
                data: {
                    activities: [],
                    metaData: {
                        total: 0,
                        page,
                        limit,
                        pages: 0
                    }
                },
                message: 'No grounds found for this user'
            });
        }

        // Validate each groundId in the array and convert to ObjectId
        const validGroundIds = user.groundAdded
            .filter(id => mongoose.Types.ObjectId.isValid(id))
            .map(id => new mongoose.Types.ObjectId(id));

        if (validGroundIds.length === 0) {
            return res.status(200).json({
                status: true,
                data: {
                    activities: [],
                    metaData: {
                        total: 0,
                        page,
                        limit,
                        pages: 0
                    }
                },
                message: 'No valid grounds found for this user'
            });
        }

        // Build query for activities
        const query = { 
            groundId: { $in: validGroundIds }
        };
        if (activityType) {
            query.activityType = activityType;
        }

        // Fetch activities with pagination
        const activities = await GroundActivity.find(query)
            .populate('userId', 'name email')
            .populate('groundId', 'name city address1')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        // Get total count
        const total = await GroundActivity.countDocuments(query);

        return res.status(200).json({
            status: true,
            data: {
                activities,
                metaData: {
                    total,
                    page,
                    limit,
                    pages: Math.ceil(total / limit)
                }
            },
            message: 'Ground activities retrieved successfully'
        });
    } catch (error) {
        console.error('Error fetching ground activities:', error);
        return res.status(500).json({
            status: false,
            message: error.message,
            data: null
        });
    }
};

export const updateSlotPrice = async (req, res) => {
    try {
        const { groundId, courtId, day, slotId, price, tournamentPrice } = req.body;

        // Validate input
        if (!groundId || !courtId || !day || !slotId) {
            return res.status(400).json({
                status: false,
                message: 'Ground ID, court ID, day, and slot ID are required',
                data: null
            });
        }

        // Check if there are any price fields to update
        const updateObject = {};
        
        // Only add fields to update object if they are explicitly passed
        if (price !== undefined) {
            updateObject['courts.$[court].times.$[time].slots.$[slot].price'] = price;
        }
        
        if (tournamentPrice !== undefined) {
            updateObject['courts.$[court].times.$[time].slots.$[slot].tournamentPrice'] = tournamentPrice;
        }
        
        // If no price fields to update, return error
        if (Object.keys(updateObject).length === 0) {
            return res.status(400).json({
                status: false,
                message: 'At least one price field (price or tournamentPrice) must be provided',
                data: null
            });
        }

        // Update the specific slot's price(s)
        const result = await Ground.updateOne(
            {
                _id: groundId,
                'courts._id': courtId,
                'courts.times.day': day,
                'courts.times.slots._id': slotId
            },
            {
                $set: updateObject
            },
            {
                arrayFilters: [
                    { 'court._id': courtId },
                    { 'time.day': day },
                    { 'slot._id': slotId }
                ]
            }
        );

        if (result.modifiedCount === 0) {
            return res.status(404).json({
                status: false,
                message: 'Slot not found or no changes made',
                data: null
            });
        }

        // Get updated ground
        const updatedGround = await Ground.findById(groundId);

        // Track activity
        await trackGroundActivity(
            req.user._id,
            groundId,
            'update',
            { 
                action: 'update_slot_prices',
                slotId,
                priceUpdates: updateObject
            }
        );

        return res.status(200).json({
            status: true,
            message: 'Slot prices updated successfully',
            data: updatedGround
        });
    } catch (error) {
        console.error('Error updating slot prices:', error);
        return res.status(500).json({
            status: false,
            message: error.message,
            data: null
        });
    }
};
