'use client';
import { useState, useRef, useEffect } from "react";
import TalkingHeadDemo from "./TalkingHeadDemo";
import DOMPurify from "dompurify";
import { voices } from "../utils/voices.js";
import { elevenLabsVoices } from "../utils/elevenlabsVoices.js";
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
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [ttsProvider, setTtsProvider] = useState('azure'); // 'azure' or 'elevenlabs'
  const talkingHeadRef = useRef(null);
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (chatContainerRef.current && messagesEndRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);


  const handleSend = async () => {
    const userMessage = input.trim();
    if (!userMessage || isGenerating) return;
  
    // Set generating state
    console.log("Setting generating state to true");
    setIsGenerating(true);
    
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
    console.log("Chat /api/chat JSON:", data);
    const cleanMessage = data.response || "Sorry, I couldn't think of a reply.";
    const langCode = data.language && Object.keys(voices).includes(data.language)
      ? data.language
      : "en";
  
    const linkedMessage = convertPhrasesToLinks(cleanMessage);
    setCurrentMessageHTML(linkedMessage);
  
    // Add empty Matthew message for live-building
    setMessages(prev => [
      ...prev,
      { role: "Matthew", text: "", isBuilding: true }
    ]);
  
    // Start TTS
    const voiceMapping = ttsProvider === 'elevenlabs' ? elevenLabsVoices : voices;
    talkingHeadRef.current?.speak(
      cleanMessage,
      voiceMapping[langCode] || voiceMapping["en"],
      ttsProvider
    );
  };

  // Server-side Speech-to-Text functionality using existing Azure API
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000, // Azure prefers 16kHz
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        }
      });
      
      // Audio level monitoring (removed excessive logging)
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);
      microphone.connect(analyser);
      
      // Use WebM with Opus codec for better compatibility
      const mimeType = 'audio/webm;codecs=opus';
      
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        throw new Error('WebM with Opus codec not supported by this browser');
      }
      
      const recorder = new MediaRecorder(stream, { 
        mimeType,
        audioBitsPerSecond: 16000 // Lower bitrate for better performance
      });
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setIsListening(true);
      
      let audioChunks = [];
      audioChunksRef.current = audioChunks;
      
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };
      
      recorder.onstop = async () => {
        try {
          const audioBlob = new Blob(audioChunks, { type: mimeType });
          
          if (audioBlob.size === 0) {
            throw new Error('No audio data recorded');
          }
          
          const audioData = await audioBlob.arrayBuffer();
          
          const response = await fetch('/api/azure-stt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              audioData: Array.from(new Uint8Array(audioData)),
              mimeType: mimeType
            })
          });
          
          const data = await response.json();
          
          if (data.text && data.text.trim()) {
            setInput(prev => prev + (prev ? ' ' : '') + data.text.trim());
          } else if (data.error) {
            console.error('STT error:', data.error);
            alert(`Speech recognition error: ${data.error}`);
          }
          // No alert for no speech detected - just silently continue
        } catch (error) {
          console.error('Speech recognition error:', error);
          alert(`Speech recognition error: ${error.message}`);
        } finally {
          stream.getTracks().forEach(track => track.stop());
          setIsRecording(false);
          setIsListening(false);
        }
      };
      
      recorder.onerror = (event) => {
        console.error('MediaRecorder error:', event.error);
        alert(`Recording error: ${event.error.message}`);
        stream.getTracks().forEach(track => track.stop());
        setIsRecording(false);
        setIsListening(false);
      };
      
      // Start recording
      recorder.start(1000); // Collect data every second
      
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert(`Error accessing microphone: ${error.message}`);
      setIsRecording(false);
      setIsListening(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsListening(false);
    }
  };

  
  
  return (
    <div className="min-h-screen bg-black text-white font-mono">
      <div className="flex flex-col lg:flex-row h-screen">
        {/* Chat Interface - Full width on mobile, half width on desktop */}
        <div className="w-full lg:w-1/2 flex flex-col p-4 lg:p-8 lg:border-r border-gray-700 order-2 lg:order-2">
          <div className={`border border-gray-600 rounded-lg p-4 bg-gray-900/30 backdrop-blur-sm flex flex-col max-h-[50vh] lg:max-h-[70vh] ${messages.length === 0 ? 'lg:h-auto' : ''}`}>
              <div ref={chatContainerRef} className="space-y-3 flex-1 overflow-y-auto min-h-0">
              {messages.map((msg, i) => (
                <div key={i} className={`flex items-baseline space-x-1 ${
                  msg.role === "user" 
                    ? "p-3 rounded-lg bg-gray-800 border border-gray-700" 
                    : "pl-2"  // Add left padding for AI responses
                }`}>
                  {msg.role === "user" ? (
                    <>
                      <span className="text-blue-400 font-mono flex-shrink-0">&gt;</span>
                      <p className="text-white whitespace-pre-wrap text-sm lg:text-base leading-tight">{msg.text}</p>
                    </>
                  ) : (
                    <>
                      <span className="text-green-400 flex-shrink-0">●</span>
                      <div
                        className="text-gray-200 whitespace-pre-wrap text-sm lg:text-base leading-tight pl-0"
                        dangerouslySetInnerHTML={{
                          __html: DOMPurify.sanitize(msg.text, {
                            ALLOWED_TAGS: ["b", "i", "em", "strong", "a", "u"],
                            ALLOWED_ATTR: ["href", "target", "rel", "style"],
                          }),
                        }}
                      />
                    </>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
              </div>

              <div className="flex items-center space-x-2 mt-2 lg:mt-0">
                <span className="text-gray-400 font-mono">&gt;</span>
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  className="bg-transparent border-none outline-none text-white flex-1 placeholder-gray-500 text-sm lg:text-base"
                  placeholder="Type your message here"
                  onKeyPress={e => e.key === 'Enter' && !isGenerating && handleSend()}
                />
                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={isGenerating}
                  className={`p-2 rounded-full transition-colors duration-200 group ${
                    isRecording 
                      ? 'bg-red-500 hover:bg-red-600' 
                      : 'bg-gray-800 hover:bg-gray-700'
                  } ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                  title={isRecording ? 'Stop recording' : 'Start recording'}
                >
                  {isRecording ? (
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <rect x="6" y="6" width="12" height="12" rx="2"/>
                    </svg>
                  ) : (
                    <svg 
                      className="w-4 h-4 text-gray-400 group-hover:text-white transition-colors duration-200" 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={2} 
                        d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" 
                      />
                    </svg>
                  )}
                </button>
                {isGenerating && (
                  <span className="text-gray-400 text-xs lg:text-sm">Generating...</span>
                )}
                {isListening && (
                  <span className="text-red-400 text-xs lg:text-sm animate-pulse">Listening...</span>
                )}
              </div>
            </div>
        </div>

        {/* AI Avatar - Full width on mobile, half width on desktop */}
         <div className="w-full lg:w-1/2 flex flex-col items-center justify-start pt-4 pb-4 px-4 lg:px-8 order-1 lg:order-1">
          <div className="mb-2 lg:mb-3 text-center">
            <h1 className="text-2xl lg:text-4xl font-bold mb-1 lg:mb-2">Hey, I&apos;m Matthew!</h1>
            <p className="text-gray-300 text-sm lg:text-base">I&apos;m a virtual 3D AI Clone. Ask me anything!</p>
            
            {/* TTS Provider Toggle */}
            <div className="mt-4 flex items-center justify-center space-x-4">
              <span className="text-gray-400 text-sm">TTS Provider:</span>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setTtsProvider('azure')}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    ttsProvider === 'azure'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  Azure
                </button>
                <button
                  onClick={() => setTtsProvider('elevenlabs')}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    ttsProvider === 'elevenlabs'
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  ElevenLabs
                </button>
              </div>
            </div>
          </div>
          
          <div className="w-full max-w-2xl">
            <TalkingHeadDemo
              ref={talkingHeadRef}
              onWord={(word, i, info) => {
                setMessages(prev => {
                  const last = prev[prev.length - 1];
                  if (last && last.isBuilding) {
                    const newText = appendToken(last?.text || "", word);

                    // ✅ Convert phrases live
                    const linkedText = convertPhrasesToLinks(newText);

                    // If this is the last word, mark as complete and reset generating state
                    if (info?.isLastWord) {
                      setIsGenerating(false);
                    }

                    return [...prev.slice(0, -1), { role: "Matthew", text: linkedText, isBuilding: !info?.isLastWord }];
                  }
                  return prev;
                });
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}