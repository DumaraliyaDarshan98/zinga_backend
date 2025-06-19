import mongoose from 'mongoose';
import PriceManagement from '../models/PriceManagement.js';
import moment from 'moment';

// Create a new price management entry
export const createPriceEntry = async (req, res) => {
    try {
        const { groundId, courtId, slotIds, type, price, tournamentPrice, isTournament } = req.body;
        
        if (!groundId || !courtId || !Array.isArray(slotIds) || slotIds.length === 0 || !type || price === undefined || tournamentPrice === undefined) {
            return res.status(400).json({
                status: false,
                data: null,
                message: "All fields are required: groundId, courtId, slotIds, type, price, tournamentPrice"
            });
        }
        
        // Fetch the ground to get access to the courts and slots
        const ground = await mongoose.model('Ground').findById(groundId);
        if (!ground) {
            return res.status(404).json({
                status: false,
                data: null,
                message: "Ground not found"
            });
        }
        
        // Find the court
        const court = ground.courts.id(courtId);
        if (!court) {
            return res.status(404).json({
                status: false,
                data: null,
                message: "Court not found"
            });
        }
        
        // Determine the date or day based on the type
        let dateValue;
        let priceType;
        
        // Check if type is a date (YYYY-MM-DD)
        if (/^\d{4}-\d{2}-\d{2}$/.test(type)) {
            dateValue = new Date(type);
            priceType = 'date';
        } 
        // Check if type is a day of the week
        else if (['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].includes(type.toLowerCase())) {
            dateValue = new Date(); // Current date
            priceType = 'day';
        } 
        // Check if type is 'week'
        else if (type.toLowerCase() === 'week') {
            dateValue = new Date(); // Current date
            priceType = 'week'; // Will apply to all future dates without time limitation
        } else {
            return res.status(400).json({
                status: false,
                data: null,
                message: "Type must be a valid date (YYYY-MM-DD), day of week, or 'week'"
            });
        }
        
        // Find matching slots based on time ranges
        const matchedSlotIds = [];
        
        court.times.forEach(timeEntry => {
            timeEntry.slots.forEach(slot => {
                // For each time range in slotIds
                slotIds.forEach(timeRange => {
                    const slotFrom = moment(slot.from, "hh:mm A");
                    const slotTo = moment(slot.to, "hh:mm A");
                    
                    const rangeFrom = moment(timeRange.from, "HH:mm");
                    const rangeTo = moment(timeRange.to, "HH:mm");
                    
                    // Check if the slot time matches the range
                    if (
                        (slotFrom.format("HH:mm") === rangeFrom.format("HH:mm") && 
                         slotTo.format("HH:mm") === rangeTo.format("HH:mm"))
                    ) {
                        matchedSlotIds.push(slot._id);
                        
                        // Update isTournament flag for the matching slot if provided
                        if (isTournament !== undefined) {
                            slot.isTournament = isTournament;
                        }
                    }
                });
            });
        });
        
        if (matchedSlotIds.length === 0) {
            return res.status(404).json({
                status: false,
                data: null,
                message: "No slots match the provided time ranges"
            });
        }
        
        // Save the ground with updated isTournament flags
        if (isTournament !== undefined) {
            await ground.save();
        }
        
        // Create the price entry
        const priceEntry = new PriceManagement({
            groundId,
            courtId,
            slotIds: matchedSlotIds,
            date: dateValue,
            type: priceType,
            price,
            tournamentPrice,
            isTournament: isTournament !== undefined ? isTournament : false, // Store the isTournament flag
            createdBy: req.user._id
        });
        
        await priceEntry.save();
        
        res.status(201).json({
            status: true,
            data: priceEntry,
            message: "Price entry created successfully for " + matchedSlotIds.length + " slots"
        });
    } catch (error) {
        // Handle duplicate key error
        if (error.code === 11000) {
            return res.status(400).json({
                status: false,
                data: null,
                message: "A price entry with these details already exists"
            });
        }
        
        res.status(500).json({
            status: false,
            data: null,
            message: error.message
        });
    }
};

// Get all price entries for a ground
export const getGroundPriceEntries = async (req, res) => {
    try {
        const { groundId } = req.params;
        
        const priceEntries = await PriceManagement.find({ groundId });
        
        res.status(200).json({
            status: true,
            data: priceEntries,
            message: "Price entries retrieved successfully"
        });
    } catch (error) {
        res.status(500).json({
            status: false,
            data: null,
            message: error.message
        });
    }
};

// Update a price entry
export const updatePriceEntry = async (req, res) => {
    try {
        const { id } = req.params;
        const { price, tournamentPrice } = req.body;
        
        if (price === undefined && tournamentPrice === undefined) {
            return res.status(400).json({
                status: false,
                data: null,
                message: "At least one of price or tournamentPrice must be provided"
            });
        }
        
        const updatedEntry = await PriceManagement.findByIdAndUpdate(
            id,
            { 
                ...(price !== undefined && { price }),
                ...(tournamentPrice !== undefined && { tournamentPrice })
            },
            { new: true }
        );
        
        if (!updatedEntry) {
            return res.status(404).json({
                status: false,
                data: null,
                message: "Price entry not found"
            });
        }
        
        res.status(200).json({
            status: true,
            data: updatedEntry,
            message: "Price entry updated successfully"
        });
    } catch (error) {
        res.status(500).json({
            status: false,
            data: null,
            message: error.message
        });
    }
};

// Delete a price entry
export const deletePriceEntry = async (req, res) => {
    try {
        const { id } = req.params;
        
        const deletedEntry = await PriceManagement.findByIdAndDelete(id);
        
        if (!deletedEntry) {
            return res.status(404).json({
                status: false,
                data: null,
                message: "Price entry not found"
            });
        }
        
        res.status(200).json({
            status: true,
            data: null,
            message: "Price entry deleted successfully"
        });
    } catch (error) {
        res.status(500).json({
            status: false,
            data: null,
            message: error.message
        });
    }
};

// Helper function to get applicable price for a specific slot
export const getApplicablePriceForSlot = async (groundId, courtId, slotId, bookingDate) => {
    const bookingDateObj = new Date(bookingDate);
    const dayOfWeek = moment(bookingDateObj).format('dddd').toLowerCase();
    
    // Get all price entries for this slot
    const priceEntries = await PriceManagement.find({
        groundId: new mongoose.Types.ObjectId(groundId),
        courtId: new mongoose.Types.ObjectId(courtId),
        slotIds: new mongoose.Types.ObjectId(slotId)
    });
    
    if (!priceEntries || priceEntries.length === 0) {
        return null; // No special pricing found
    }
    
    // Find 'date' type pricing for exact date match
    const exactDatePricing = priceEntries.find(entry => {
        return entry.type === 'date' && 
               moment(entry.date).format('YYYY-MM-DD') === moment(bookingDateObj).format('YYYY-MM-DD');
    });
    
    if (exactDatePricing) {
        return {
            price: exactDatePricing.price,
            tournamentPrice: exactDatePricing.tournamentPrice,
            isTournament: exactDatePricing.isTournament,
            type: 'date'
        };
    }
    
    // Find 'day' type pricing for day of week match
    const dayOfWeekPricing = priceEntries.find(entry => {
        return entry.type === 'day' && 
               moment(entry.date).format('dddd').toLowerCase() === dayOfWeek;
    });
    
    if (dayOfWeekPricing) {
        return {
            price: dayOfWeekPricing.price,
            tournamentPrice: dayOfWeekPricing.tournamentPrice,
            isTournament: dayOfWeekPricing.isTournament,
            type: 'day'
        };
    }
    
    // Find 'week' type pricing
    // For 'week' type, apply to all future dates with no time limitation
    const weekPricing = priceEntries.find(entry => {
        if (entry.type !== 'week') return false;
        
        const entryDate = moment(entry.date);
        const bookingMoment = moment(bookingDateObj);
        
        // Apply to all dates on or after the entry date
        return bookingMoment.isSameOrAfter(entryDate);
    });
    
    if (weekPricing) {
        return {
            price: weekPricing.price,
            tournamentPrice: weekPricing.tournamentPrice,
            isTournament: weekPricing.isTournament,
            type: 'week'
        };
    }
    
    return null; // No applicable special pricing found
}; 