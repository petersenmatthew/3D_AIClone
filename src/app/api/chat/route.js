import { NextResponse } from "next/server";
import { userContext } from "./userContext"; // <-- your personal context

export async function POST(request) {
  try {
    const body = await request.json();
    const query = body.query;
    const language = body.language || "en";
    const messages = body.messages || []; // last 3 messages sent from frontend

    if (!query) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    // Check API key
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      return NextResponse.json({ error: "Missing Gemini API key" }, { status: 500 });
    }

    // Format previous messages into a string
    const previousMessagesText = messages
      .map(m => `${m.role}: ${m.content}`)
      .join("\n");

    // Compose final prompt for Gemini
    const prompt = `${userContext}
    Current question: ${query}
    These are the past up to 3 messages, use these as further context of the current conversation:
    ${previousMessagesText}`;

        // Log the exact content being sent
    console.log("Sending to Gemini API:", {
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }]
        }
      ]
    });
    // Gemini endpoint
    const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`;

    const geminiBody = {
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt }
          ]
        }
      ]
    };

    // Send request to Gemini
    const response = await fetch(geminiEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(geminiBody),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Gemini API error details:", errorData, "Status:", response.status, "Query:", query);
      throw new Error(`Gemini API error: ${response.statusText}`);
    }

    const data = await response.json();
    const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || "Sorry, I couldn't generate a response.";

    return NextResponse.json({ response: aiText });
  } catch (error) {
    console.error("Error in AI route:", error);
    return NextResponse.json({ error: "Failed to generate AI response", details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
