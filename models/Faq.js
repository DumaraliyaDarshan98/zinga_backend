import mongoose from "mongoose";

const faqSectionSchema = new mongoose.Schema(
    {
        sectionTitle: {
            type: String,
            required: true,
        },
        faqs: [
            {
                question: {
                    type: String,
                    required: true,
                },
                answer: {
                    type: String,
                    required: true,
                },
            },
        ],
    },
    {
        timestamps: true, 
        versionKey: false,
    }
);

const FAQSection = mongoose.model('FAQSection', faqSectionSchema);

export default FAQSection;
