import mongoose from "mongoose";
import Booking from "../models/GroundBooking.js";
import Ground from '../models/Ground.js';
import Match from "../models/Match.js";
import { getApplicablePriceForSlot } from "./priceManagementController.js";

export const groundBooking = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { groundId, booking, from, to, message } = req.body;
        const userId = req.user._id;

        const ground = await Ground.findById(groundId);

        if (!ground) {
            return res.status(404).json({
                data: null,
                message: 'Ground not found',
                status: false
            })
        }

        // Validate input
        if (!Array.isArray(booking) || booking.length === 0) {
            return res.status(400).json({
                status: false,
                data: null,
                message: "Booking cannot be empty"
            });
        }

        if (!from || !to) {
            return res.status(400).json({
                status: false,
                data: null,
                message: "Both 'from' and 'to' dates are required"
            });
        }

        const startDate = new Date(from);
        const endDate = new Date(to);

        if (startDate > endDate) {
            return res.status(400).json({
                status: false,
                data: null,
                message: "'from' date must be before 'to' date"
            });
        }

        const conflicts = [];
        const successfulBookings = [];

        // Iterate through each day in the range
        for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
            const currentBookingDate = new Date(date);
            const formattedDate = currentBookingDate.toISOString().split("T")[0];

            for (let i = 0; i < booking.length; i++) {
                const { courtId, slotId } = booking[i];

                const existingBooking = await Booking.findOne({
                    courtId: new mongoose.Types.ObjectId(courtId),
                    slotId: new mongoose.Types.ObjectId(slotId),
                    groundId: new mongoose.Types.ObjectId(groundId),
                    bookingDate: currentBookingDate
                }).session(session);

                if (existingBooking) {
                    conflicts.push({
                        date: formattedDate,
                        courtId,
                        slotId,
                        message: "This slot is already booked"
                    });
                } else {
                    // Find the court and slot in the ground document to get base price
                    let court = ground.courts.id(courtId);
                    let slot = null;
                    let basePrice = 0;
                    let baseTournamentPrice = 0;
                    
                    if (court) {
                        // Find the correct time entry for the slot
                        for (const timeEntry of court.times) {
                            const foundSlot = timeEntry.slots.id(slotId);
                            if (foundSlot) {
                                slot = foundSlot;
                                basePrice = foundSlot.price;
                                baseTournamentPrice = foundSlot.tournamentPrice;
                                break;
                            }
                        }
                    }
                    
                    // Check for special pricing
                    const specialPricing = await getApplicablePriceForSlot(
                        groundId,
                        courtId,
                        slotId,
                        formattedDate
                    );
                    
                    let finalPrice = basePrice;
                    let finalTournamentPrice = baseTournamentPrice;
                    let pricingType = 'regular';
                    
                    // If special pricing exists, use it
                    if (specialPricing) {
                        finalPrice = specialPricing.price;
                        finalTournamentPrice = specialPricing.tournamentPrice;
                        pricingType = specialPricing.type;
                    }
                    
                    // Calculate actual price based on whether it's a tournament or regular booking
                    const actualPrice = slot && slot.isTournament ? finalTournamentPrice : finalPrice;

                    const newBooking = new Booking({
                        groundId: groundId,
                        courtId: courtId,
                        slotId: slotId,
                        userId,
                        bookingDate: currentBookingDate,
                        message,
                        price: actualPrice,
                        pricingType
                    });

                    await newBooking.save({ session });
                    
                    successfulBookings.push({
                        date: formattedDate,
                        courtId,
                        slotId,
                        price: actualPrice,
                        pricingType
                    });
                }
            }
        }

        if (conflicts.length > 0) {
            await session.abortTransaction();
            session.endSession();
            return res.status(409).json({
                status: false,
                data: conflicts,
                message: "Some slots are already booked"
            });
        }

        await session.commitTransaction();
        session.endSession();

        res.status(201).json({
            status: true,
            data: {
                bookings: successfulBookings
            },
            message: "Ground bookings successfully"
        });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        res.status(500).json({
            status: false,
            data: null,
            message: error.message
        });
    }
};


export const groundBookingHistory = async (req, res) => {
    try {
        const userId = req.user._id;
        const { month } = req.query;

        const currentYear = new Date().getFullYear();

        const dateFilter = {
            $gte: new Date(`${currentYear}-01-01T00:00:00.000Z`),
            $lt: new Date(`${currentYear + 1}-01-01T00:00:00.000Z`)
        };

        if (month) {
            const monthNumber = parseInt(month, 10);

            if (isNaN(monthNumber) || monthNumber < 1 || monthNumber > 12) {
                return res.status(400).json({
                    status: false,
                    data: null,
                    message: "Invalid month. Please provide a value between 1 and 12."
                });
            }

            const startDate = new Date(`${currentYear}-${String(monthNumber).padStart(2, '0')}-01T00:00:00.000Z`);
            const endDate = new Date(new Date(startDate).setMonth(startDate.getMonth() + 1));
            dateFilter.$gte = startDate;
            dateFilter.$lt = endDate;
        }

        const grounds = await Booking.find({
            userId: userId,
            bookingDate: dateFilter
        }, { bookingDate: 1 });

        return res.status(200).json({
            status: true,
            data: grounds,
            message: "Booking history successfully fetched"
        });

    } catch (error) {
        res.status(500).json({
            status: false,
            data: null,
            message: error.message
        });
    }
};


export const getMyBooking = async (req, res) => {
    try {
        const userId = req.user._id;

        // Get bookings for the current user
        const userBookings = await Booking.find({ userId }).populate({
            path: 'groundId',
            populate: {
                path: 'courts',
                select: 'name times'
            }

        });

        // Extract grounds with regular slots
        const grounds = [];
        const groundMap = new Map(); // Used to prevent duplicates

        for (const booking of userBookings) {
            const ground = booking.groundId;

            if (!ground) continue;
            console.log(ground.courts, booking.courtId, booking.slotId);

            // Find the specific court and slot from the booking
            const court = ground.courts.find(c => c._id.toString() === booking.courtId.toString());
            if (!court) continue;
            // Skip if we've already added this ground
            if (groundMap.has(ground._id.toString())) continue;

            // Look through all times and slots to find non-tournament slots
            let hasRegularSlots = false;
            for (const courtItem of ground.courts) {
                for (const time of courtItem.times) {
                    for (const slot of time.slots) {
                        if (slot.isTournament === false) {
                            hasRegularSlots = true;
                            break;
                        }
                    }
                    if (hasRegularSlots) break;
                }
                if (hasRegularSlots) break;
            }

            if (hasRegularSlots) {
                groundMap.set(ground._id.toString(), true);
                grounds.push(ground);
            }
        }

        return res.json({
            status: true,
            data: grounds,
            message: "My regular booking grounds fetched successfully"
        });
    } catch (err) {
        console.error('Error fetching my regular grounds:', err);
        return res.status(500).json({
            status: false,
            data: null,
            message: err.message
        });
    }
};

export const groundBookingUmpireHistory = async (req, res) => {
    try {
        const userId = req.user._id;
        const matches = await Match.find({
            umpires: userId
        })

        return res.status(200).json({
            status: true,
            data: matches,
            message: "Umpire booking history fetched successfully"
        })
    } catch (error) {
        res.status(500).json({
            status: false,
            data: null,
            message: error.message
        });
    }
}



