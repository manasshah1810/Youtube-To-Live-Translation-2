const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const apiKey = process.env.GOOGLE_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

async function listModels() {
    try {
        const modelResponse = await genAI.getGenerativeModel({ model: "gemini-pro" }); // Dummy init to get client? No, need model manager.
        // The SDK doesn't have a direct listModels on the main class in some versions, 
        // but usually it's via a ModelManager or similar. 
        // Actually, for the JS SDK, we might just try a known working model.

        console.log("Testing gemini-1.5-flash-001...");
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-001" });
        const result = await model.generateContent("Hello");
        console.log("gemini-1.5-flash-001 works!", result.response.text());
    } catch (error) {
        console.error("Error:", error.message);
    }
}

listModels();
