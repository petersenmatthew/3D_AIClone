'use client';
import { useState, useRef } from "react";
import TalkingHeadDemo from "./TalkingHeadDemo";
import DOMPurify from "dompurify";
import { voices } from "../utils/voices.js";
import { convertPhrasesToLinks } from "../utils/linkMappings.js"; 
// ✅ Helper: append tokens without extra space before punctuation
function appendToken(existing, token) {
  const noSpaceBefore = [".", ",", "!", "?", ":", ";"];
  
  if (noSpaceBefore.includes(token)) {
    return existing + token;
  } 
  // If previous ends with @, stick username directly after
  if (existing.endsWith("@")) {
    return existing + token;
  }
  return existing ? existing + " " + token : token;
  
}

export default function ChatUI() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [currentMessageHTML, setCurrentMessageHTML] = useState("");
  const talkingHeadRef = useRef(null);
  const handleSend = async () => {
    const userMessage = input.trim();
    if (!userMessage) return;
  
    // Add current user message locally
    setMessages(prev => [...prev, { role: "user", text: userMessage }]);
    setInput("");
  
    // ✅ Take last 3 user and last 3 bot messages
    const lastUserMessages = messages.filter(m => m.role === "user").slice(-3);
    const lastBotMessages = messages.filter(m => m.role === "Matthew").slice(-3);
    const contextMessages = [...lastUserMessages, ...lastBotMessages];
  
    // ✅ Build payload to send
    const payload = {
      query: userMessage,
      messages: contextMessages.map(m => ({
        role: m.role,
        content: m.text
      })),
      language: Object.keys(voices).includes(userMessage.slice(0, 2))
        ? userMessage.slice(0, 2)
        : "en" // fallback if lang not found
    };
  
    // ✅ Log payload for debugging
    console.log("Payload sent to /api/chat:", payload);
  
    // Send to API
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  
    const data = await res.json();
    const botMessage = data.response || "Sorry, I couldn't think of a reply.";
  
    // Determine language code dynamically for TTS
    const langCode = Object.keys(voices).includes(botMessage.slice(0, 2))
      ? botMessage.slice(0, 2)
      : "en";
  
    // Remove potential language prefix for clean display
    const cleanMessage = botMessage.slice(3);
  
    const linkedMessage = convertPhrasesToLinks(cleanMessage);
    setCurrentMessageHTML(linkedMessage);
  
    // Add empty Matthew message for live-building
    setMessages(prev => [
      ...prev,
      { role: "Matthew", text: "", isBuilding: true }
    ]);
  
    talkingHeadRef.current?.speak(
      cleanMessage,
      voices[langCode] || voices["en"]
    );
  };
  
  
  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="border p-2 h-64 overflow-y-auto mb-2">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={msg.role === "user" ? "text-blue-500" : "text-green-500"}
          >
            <b>{msg.role}:</b>{" "}
            <span
              className="whitespace-pre-wrap"
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(msg.text, {
                  ALLOWED_TAGS: ["b", "i", "em", "strong", "a", "u"],
                  ALLOWED_ATTR: ["href", "target", "rel", "style"],
                }),
              }}
            />
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          className="border p-2 flex-1"
          placeholder="Type your message..."
          onKeyPress={e => e.key === 'Enter' && handleSend()}
        />
        <button
          onClick={handleSend}
          className="bg-blue-600 text-white px-4 rounded"
        >
          Send
        </button>
      </div>

      <div className="mt-4">
        <TalkingHeadDemo
          ref={talkingHeadRef}
          onWord={(word, i, info) => {
            setMessages(prev => {
              const last = prev[prev.length - 1];
              if (last && last.isBuilding) {
                const newText = appendToken(last?.text || "", word);

                // ✅ Convert phrases live
                const linkedText = convertPhrasesToLinks(newText);

                return [...prev.slice(0, -1), { role: "Matthew", text: linkedText, isBuilding: !info?.isLastWord }];
              }
              return prev;
            });
          }}
        />

      </div>
    </div>
  );
}