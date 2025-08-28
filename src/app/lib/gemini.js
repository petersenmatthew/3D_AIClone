import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function* streamGeminiResponse(userMessage, userContext) {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const chat = model.startChat({
    history: [
      {
        role: "system",
        parts: [{ text: userContext }],
      },
    ], 
  });

  const result = await chat.sendMessageStream(userMessage);

  for await (const chunk of result.stream) {
    if (chunk.candidates && chunk.candidates[0].content.parts[0].text) {
      yield chunk.candidates[0].content.parts[0].text;
    }
  }
}
