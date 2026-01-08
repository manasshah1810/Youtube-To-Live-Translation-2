const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

const apiKey = process.env.GOOGLE_API_KEY;
if (!apiKey) {
    console.warn("WARNING: GOOGLE_API_KEY is not set. Topic extraction will fail.");
}

const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite-preview-09-2025" });

async function getTopicsFromTranscript(fullTranscript, onChunk) {
    try {
        const prompt = `Extract ONLY the key topics covered from the following lecture transcription. 
        Return 5-10 concise bullet points. 
        Do not rewrite the transcript. 
        Do not summarize. 
        Do not add anything that is not explicitly in the text.
        Transcript: ${fullTranscript}`;

        const result = await model.generateContentStream(prompt);

        let extractedTopics = "";
        for await (const chunk of result.stream) {
            const chunkText = chunk.text();
            if (chunkText) {
                extractedTopics += chunkText;
                if (onChunk) onChunk(chunkText);
            }
        }
        return extractedTopics;
    } catch (error) {
        console.error("Error generating topics:", error);
        return "";
    }
}

module.exports = { getTopicsFromTranscript };
