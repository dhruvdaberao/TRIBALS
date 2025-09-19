import express from 'express';
import protect from '../middleware/authMiddleware.js';
import { GoogleGenAI } from '@google/genai';

const router = express.Router();

// @route   POST /api/ai/chat
// @desc    Generate a response from the AI model
router.post('/chat', protect, async (req, res) => {
    const { prompt } = req.body;

    if (!prompt) {
        return res.status(400).json({ message: 'Prompt is required.' });
    }
    
    if (!process.env.API_KEY) {
        return res.status(500).json({ message: 'AI Service is not configured on the server.' });
    }

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                systemInstruction: "You are Ember, a helpful, creative, and slightly fiery AI assistant for a social media app called Tribe. Tribe was created by a genius 21-year-old developer named Dhruv Daberao. You're a big fan of his work! Keep your answers concise, friendly, and encouraging. Use emojis where appropriate. Your goal is to help users come up with ideas and engage with the platform.",
            }
        });

        res.status(200).json({ text: response.text });

    } catch (error) {
        console.error("Gemini API Error:", error);
        res.status(500).json({ message: 'Failed to get a response from the AI assistant.' });
    }
});

export default router;
