import FAQSection from '../models/Faq.js';

export const createSection = async (req, res) => {
    try {
        const { sectionTitle } = req.body;

        if (!sectionTitle) {
            return res.status(400).json({ status: false, message: 'Section title is required', data: null });
        }

        const section = new FAQSection({ sectionTitle, faqs: [] });
        await section.save();

        res.status(201).json({ status: true, message: 'Section created successfully', data: section });
    } catch (error) {
        res.status(500).json({ status: false, message: 'Internal server error', error: error.message });
    }
};

export const addQuestion = async (req, res) => {
    try {
        const { id } = req.params;
        const { question, answer } = req.body;

        if (!question || !answer) {
            return res.status(400).json({ status: false, message: 'Question and answer are required' });
        }

        const section = await FAQSection.findById(id);
        if (!section) {
            return res.status(404).json({ status: false, message: 'Section not found' });
        }

        section.faqs.push({ question, answer });
        await section.save();

        res.status(201).json({ status: true, message: 'Question added successfully', data: section });
    } catch (error) {
        res.status(500).json({ status: false, message: 'Internal server error', error: error.message });
    }
};

export const updateQuestion = async (req, res) => {
    try {
        const { sectionId, questionId } = req.params;
        const { question, answer } = req.body;

        const section = await FAQSection.findById(sectionId);
        if (!section) {
            return res.status(404).json({ status: false, message: 'Section not found' });
        }

        const faq = section.faqs.id(questionId);
        if (!faq) {
            return res.status(404).json({ status: false, message: 'Question not found' });
        }

        if (question) faq.question = question;
        if (answer) faq.answer = answer;

        await section.save();

        res.status(200).json({ status: true, message: 'Question updated successfully', data: section });
    } catch (error) {
        res.status(500).json({ status: false, message: 'Internal server error', error: error.message });
    }
};

export const deleteQuestion = async (req, res) => {
    try {
        const { sectionId, questionId } = req.params;

        const section = await FAQSection.findById(sectionId);
        if (!section) {
            return res.status(404).json({ status: false, message: 'Section not found' });
        }

        section.faqs.pull({ _id: questionId });
        await section.save();

        res.status(200).json({ status: true, message: 'Question deleted successfully', data: section });
    } catch (error) {
        res.status(500).json({ status: false, message: 'Internal server error', error: error.message });
    }
};


export const getAllSections = async (req, res) => {
    try {
        const sections = await FAQSection.find().sort({ createdAt: -1 });
        res.status(200).json({ status: true, message: 'Sections retrieved successfully', data: sections });
    } catch (error) {
        res.status(500).json({ status: false, message: 'Internal server error', error: error.message });
    }
};
