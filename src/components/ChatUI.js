'use client';
import { useState, useRef, useEffect } from "react";
import TalkingHeadDemo from "./TalkingHeadDemo";
import DOMPurify from "dompurify";
import { voices } from "../utils/voices.js";
import { elevenLabsVoices } from "../utils/elevenlabsVoices.js";
import { convertPhrasesToLinks } from "../utils/linkMappings.js";
import LinkPreviewRenderer from "./LinkPreviewRenderer.js"; 
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
  const [ttsProvider, setTtsProvider] = useState('elevenlabs'); // 'azure' or 'elevenlabs'
  const [conversationMode, setConversationMode] = useState(false);
  const talkingHeadRef = useRef(null);
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const silenceTimeoutRef = useRef(null);
  const isRecordingRef = useRef(false);
  const conversationModeRef = useRef(false);
  const isAvatarSpeakingRef = useRef(false);
  const voiceDetectionRunningRef = useRef(false);
  const isGeneratingRef = useRef(false);
  const wordsSpokenInCurrentRecordingRef = useRef(false);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (chatContainerRef.current && messagesEndRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
      }
    };
  }, []);

  // Sync conversation mode ref
  useEffect(() => {
    conversationModeRef.current = conversationMode;
  }, [conversationMode]);

  // Sync generating state ref
  useEffect(() => {
    isGeneratingRef.current = isGenerating;
  }, [isGenerating]);

  // Expose TTS provider control to global scope for console commands
  useEffect(() => {
    // Expose TTS provider control to global scope for console commands
    window.setTtsProvider = (provider) => {
      if (provider === 'azure' || provider === 'elevenlabs') {
        setTtsProvider(provider);
        console.log(`TTS Provider switched to: ${provider}`);
      } else {
        console.log('Invalid TTS provider. Use "azure" or "elevenlabs"');
      }
    };
    
    // Expose current provider getter
    window.getTtsProvider = () => {
      console.log(`Current TTS Provider: ${ttsProvider}`);
      return ttsProvider;
    };
    
    // Expose conversation mode control
    window.toggleConversationMode = () => {
      setConversationMode(prev => {
        const newMode = !prev;
        console.log(`Conversation mode: ${newMode ? 'ON' : 'OFF'}`);
        return newMode;
      });
    };
    
    // Cleanup on unmount
    return () => {
      delete window.setTtsProvider;
      delete window.getTtsProvider;
      delete window.toggleConversationMode;
    };
  }, [ttsProvider]);

  // Voice Activity Detection
  const checkVoiceActivity = () => {
    if (!analyserRef.current || !isRecordingRef.current || !voiceDetectionRunningRef.current) {
      voiceDetectionRunningRef.current = false;
      return;
    }

    // In conversation mode, don't detect voice if avatar is speaking
    if (conversationModeRef.current && isAvatarSpeakingRef.current) {
      // Continue monitoring but don't process voice
      if (isRecordingRef.current) {
        requestAnimationFrame(checkVoiceActivity);
      }
      return;
    }

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);
    
    // Calculate average volume
    const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
    
    // Threshold for voice detection (lowered for better sensitivity)
    const voiceThreshold = 5;
    
    if (average > voiceThreshold) {
      // Voice detected - mark that words have been spoken and clear any existing timeout
      if (!wordsSpokenInCurrentRecordingRef.current) {
        console.log('🎤 Voice activity detected - starting speech recognition');
      }
      wordsSpokenInCurrentRecordingRef.current = true;
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
        silenceTimeoutRef.current = null;
      }
    } else {
      // Silence detected - only start timeout if words have been spoken
      if (!silenceTimeoutRef.current && wordsSpokenInCurrentRecordingRef.current) {
        console.log('🔇 Voice stopped - waiting for silence timeout');
        const timeoutDuration = conversationModeRef.current ? 1000 : 2000; // 1 second in conversation mode, 2 seconds in normal mode
        silenceTimeoutRef.current = setTimeout(() => {
          // Auto-stop recording after silence
          console.log('⏹️ Auto-stopping recording due to silence');
          if (isRecordingRef.current) {
            stopRecording(false); // Don't exit conversation mode on auto-stop
          }
        }, timeoutDuration);
      }
    }
    
    // Continue monitoring
    if (isRecordingRef.current) {
      requestAnimationFrame(checkVoiceActivity);
    }
  };


  const handleSendWithText = async (textToSend) => {
    const userMessage = textToSend.trim();
    console.log("handleSendWithText called with:", userMessage, "isGenerating:", isGenerating, "isGeneratingRef:", isGeneratingRef.current);
    
    if (!userMessage) {
      console.log("No user message, returning");
      return;
    }
    
    if (isGeneratingRef.current) {
      console.log("Already generating (ref), returning");
      return;
    }
    
    // Set generating state
    console.log("Setting generating state to true");
    setIsGenerating(true);
    
    // Add current user message locally
    setMessages(prev => [...prev, { role: "user", text: userMessage }]);
  
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
    
    // Mark avatar as speaking
    isAvatarSpeakingRef.current = true;
    
    // Fallback timeout to reset generating state (in case avatar doesn't signal completion)
    setTimeout(() => {
      if (isGeneratingRef.current) {
        console.log('Fallback: resetting generating state after timeout');
        setIsGenerating(false);
        isAvatarSpeakingRef.current = false;
      }
    }, 10000); // 10 second fallback
    
    talkingHeadRef.current?.speak(
      cleanMessage,
      voiceMapping[langCode] || voiceMapping["en"],
      ttsProvider
    );
  };

  const handleSend = async () => {
    const userMessage = input.trim();
    if (!userMessage || isGenerating) return;
    
    // Clear the input immediately to prevent duplicate sends
    setInput("");
    
    await handleSendWithText(userMessage);
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
      
      // Set up audio context for voice activity detection
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      // Resume audio context if suspended
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }
      
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);
      microphone.connect(analyser);
      
      // Configure analyser for voice detection
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.3;
      analyser.minDecibels = -90;
      analyser.maxDecibels = -10;
      
      // Store references for voice activity detection
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      
      // Use WebM with Opus codec for better compatibility
      const mimeType = 'audio/webm;codecs=opus';
      
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        throw new Error('WebM with Opus codec not supported by this browser');
      }
      
      const       recorder = new MediaRecorder(stream, { 
        mimeType,
        audioBitsPerSecond: 16000 // Lower bitrate for better performance
      });
      mediaRecorderRef.current = recorder;
      isRecordingRef.current = true;
      setIsRecording(true);
      setIsListening(true);
      
      // Reset word tracking for new recording session
      wordsSpokenInCurrentRecordingRef.current = false;
      
      console.log('🎙️ Recording started - waiting for voice input');
      
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
            console.log('No audio data recorded - silently continuing');
            return;
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
            const recognizedText = data.text.trim();
            const detectedLanguage = data.language || 'en-US';
            const confidence = data.confidence || 0;
            
            console.log(`🗣️ Speech recognized: "${recognizedText}" (${detectedLanguage}, confidence: ${confidence})`);
            
            // In conversation mode, auto-send the message without adding to input
            if (conversationModeRef.current) {
              console.log('💬 Conversation mode: auto-sending recognized text');
              // Use the recognized text directly without adding to input
              handleSendWithText(recognizedText);
            } else {
              // In normal mode, add to input field
              setInput(prev => prev + (prev ? ' ' : '') + recognizedText);
            }
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
          isRecordingRef.current = false;
          setIsRecording(false);
          setIsListening(false);
          // Stop voice activity detection
          voiceDetectionRunningRef.current = false;
          // Clear voice activity detection
          if (silenceTimeoutRef.current) {
            clearTimeout(silenceTimeoutRef.current);
            silenceTimeoutRef.current = null;
          }
        }
      };
      
      recorder.onerror = (event) => {
        console.error('MediaRecorder error:', event.error);
        alert(`Recording error: ${event.error.message}`);
        stream.getTracks().forEach(track => track.stop());
        isRecordingRef.current = false;
        setIsRecording(false);
        setIsListening(false);
        // Stop voice activity detection
        voiceDetectionRunningRef.current = false;
        // Clear voice activity detection
        if (silenceTimeoutRef.current) {
          clearTimeout(silenceTimeoutRef.current);
          silenceTimeoutRef.current = null;
        }
      };
      
      // Start recording
      recorder.start(1000); // Collect data every second
      
      // Start voice activity detection after a small delay
      setTimeout(() => {
        console.log('Starting voice activity detection...');
        voiceDetectionRunningRef.current = true;
        checkVoiceActivity();
      }, 100);
      
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert(`Error accessing microphone: ${error.message}`);
      isRecordingRef.current = false;
      setIsRecording(false);
      setIsListening(false);
    }
  };

  const stopRecording = (isManualStop = false) => {
    if (mediaRecorderRef.current && isRecordingRef.current) {
      console.log(isManualStop ? '⏹️ Recording stopped manually' : '⏹️ Recording stopped automatically');
      
      mediaRecorderRef.current.stop();
      isRecordingRef.current = false;
      setIsRecording(false);
      setIsListening(false);
      
      // Stop voice activity detection
      voiceDetectionRunningRef.current = false;
      
      // Clear voice activity detection
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
        silenceTimeoutRef.current = null;
      }
      
      // Only exit conversation mode if this is a manual stop
      if (isManualStop && conversationModeRef.current) {
        console.log('💬 Exiting conversation mode');
        setConversationMode(false);
      }
    }
  };

  // Start conversation mode
  const startConversationMode = async () => {
    if (conversationMode) {
      // Stop conversation mode
      setConversationMode(false);
      if (isRecordingRef.current) {
        stopRecording(true); // Exit conversation mode on manual stop
      }
    } else {
      // Start conversation mode
      setConversationMode(true);
      // Clear any existing silence timeout when entering conversation mode
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
        silenceTimeoutRef.current = null;
        console.log('Cleared silence timeout when entering conversation mode');
      }
      await startRecording();
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
                      <LinkPreviewRenderer
                        text={msg.text}
                        className="text-gray-200 whitespace-pre-wrap text-sm lg:text-base leading-tight pl-0"
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
                      onClick={isRecording ? () => stopRecording(true) : (conversationMode ? startConversationMode : startRecording)}
                      disabled={isGenerating}
                      className={`p-2 rounded-full transition-colors duration-200 group ${
                        isRecording 
                          ? 'bg-red-500 hover:bg-red-600' 
                          : 'bg-gray-800 hover:bg-gray-700'
                      } ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                      title={isRecording ? 'Stop recording & exit conversation' : (conversationMode ? 'Toggle conversation mode' : 'Start recording')}
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
                      <span className="text-red-400 text-xs lg:text-sm animate-pulse">
                        {isRecording ? 'Listening...' : 'Processing...'}
                      </span>
                    )}
              </div>
            </div>
        </div>

        {/* AI Avatar - Full width on mobile, half width on desktop */}
         <div className="w-full lg:w-1/2 flex flex-col items-center justify-start pt-4 pb-4 px-4 lg:px-8 order-1 lg:order-1">
          <div className="mb-2 lg:mb-3 text-center">
            <h1 className="text-2xl lg:text-4xl font-bold mb-1 lg:mb-2">Hey, I&apos;m Matthew!</h1>
            <p className="text-gray-300 text-sm lg:text-base">I&apos;m a virtual 3D AI Clone. Ask me anything!</p>
            
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
                          console.log('Avatar finished speaking, resetting generating state');
                          setIsGenerating(false);
                          // Mark avatar as done speaking
                          isAvatarSpeakingRef.current = false;
                          console.log('Avatar finished speaking');
                          
                          // In conversation mode, restart recording
                          if (conversationModeRef.current && !isRecordingRef.current) {
                            console.log('Conversation mode: restarting recording');
                            setTimeout(async () => {
                              try {
                                await startRecording();
                                // Reset word tracking for new recording session
                                wordsSpokenInCurrentRecordingRef.current = false;
                                console.log('Recording restarted, waiting for user to speak');
                              } catch (error) {
                                console.error('Error restarting recording in conversation mode:', error);
                              }
                            }, 1000); // Longer delay to ensure avatar is completely done
                          }
                        }

                        return [...prev.slice(0, -1), { role: "Matthew", text: linkedText, isBuilding: !info?.isLastWord }];
                      }
                      return prev;
                    });
                  }}
                />
          </div>
          
          {/* Modern Conversation Mode Slider */}
          <div className="mt-4 flex items-center justify-center">
            <div className="flex items-center space-x-3">
              <span className="text-gray-400 text-sm font-medium">Conversation Mode</span>
              <button
                onClick={startConversationMode}
                disabled={isGenerating}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 ${
                  conversationMode ? 'bg-green-600' : 'bg-gray-600'
                } ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                role="switch"
                aria-checked={conversationMode}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    conversationMode ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
              <span className={`text-sm font-medium ${conversationMode ? 'text-green-400' : 'text-gray-400'}`}>
                {conversationMode ? 'ON' : 'OFF'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}