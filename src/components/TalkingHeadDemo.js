'use client';
import { forwardRef, useImperativeHandle, useRef, useState, useEffect } from "react";

const TalkingHeadDemo = forwardRef((props, ref) => {
  const avatarRef = useRef(null);
  const headRef = useRef(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  // Expose `speak(textOrObj, voice, provider)` to parent via ref
  useImperativeHandle(ref, () => ({
    speak: async (textOrObj, voice = 'en-CA-LiamNeural', provider = 'azure') => {
      if (!isInitialized || isPlaying) return;
      setIsPlaying(true);

      try {
        // Accept either a plain text string, or { message, voice }
        const text = typeof textOrObj === 'string' ? textOrObj : (textOrObj?.message || '');
        const overrideVoice = typeof textOrObj === 'object' && textOrObj?.voice ? textOrObj.voice : voice;

        let res;
        if (provider === 'elevenlabs') {
          res = await fetch("/api/elevenlabs-tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text, voiceId: overrideVoice }),
          });
        } else {
          res = await fetch("/api/azure-tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text, voice: overrideVoice }),
          });
        }
        
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        const audioBytes = Uint8Array.from(atob(data.audio), c => c.charCodeAt(0));
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const audioBuffer = await audioContext.decodeAudioData(audioBytes.buffer);

        const processedVisemes = convertVisemesToOculus(data.visemes);
        
        const words = data.words.map(w => w.text);
        const wtimes = data.words.map(w => w.audioOffset / 10000);
        const wdurations = data.words.map(w => w.duration / 10000);

        // Use the real timing data from ElevenLabs WebSocket
        headRef.current.speakAudio({
          audio: audioBuffer,
          words,
          wtimes,
          wdurations,
          visemes: processedVisemes.visemes,
          vtimes: processedVisemes.times,
          vdurations: processedVisemes.durations,
        });

        // 👇 Fire callback back to ChatUI
        if (props.onWord) {
          words.forEach((word, i) => {
            setTimeout(() => {
              props.onWord(word, i, { isLastWord: i === words.length - 1 });
            }, wtimes[i]); // use real timing from ElevenLabs
          });
        }
      } catch (err) {
        console.error("TTS error:", err);
      } finally {
        setIsPlaying(false);
      }
      
    }
  }));

  useEffect(() => {
    const initAvatar = async () => {
      try {
        const { TalkingHead: TH } = await import('@met4citizen/talkinghead');

        // ✅ Patch updateMorphTargets to skip missing slider elements
        const originalUpdate = TH.prototype.updateMorphTargets;
        TH.prototype.updateMorphTargets = function(...args) {
          try {
            originalUpdate.apply(this, args);
          } catch(e) {
            if (!e.message.includes("Cannot read properties of undefined")) throw e;
          }
        };

        const dummyJwtGet = () => Promise.resolve("dummy-jwt");

        const head = new TH(avatarRef.current, {
          ttsEndpoint: "/dummy-tts",
          jwtGet: dummyJwtGet,
          avatarSpeaking: { HeadMove: 0, EyeContact: 0.5 },
          avatarIdle: { HeadMove: 0, EyeContact: 0.2 },
          lipsyncModules: ["en"],
          lipsyncLang: 'en',
          cameraView: 'upper',           // 'full', 'mid', 'upper', 'head'
          cameraRotateX: 0.6,
          cameraY: 0.5,       // Move camera down
          cameraRotateEnable: true,     // allow user rotation
          cameraPanEnable: true,       // allow user panning
          cameraZoomEnable: true,      // allow user zooming
          avatarMood: 'happy',
          modelFPS: 30,
          lightAmbientIntensity: 1.5,
          lightDirectIntensity: 20,
          mixerGainSpeech: 1.0,

        });

        // Expose instance for debugging
        if (typeof window !== 'undefined') {
          window.th = head;
          console.log('[TalkingHeadDemo] TalkingHead instance ready as window.th');
        }

        

        headRef.current = head;

        await head.showAvatar({
          // url: 'https://models.readyplayer.me/68acae8875e83eeb007cd7a7.glb?morphTargets=ARKit,Oculus+Visemes,mouthOpen,mouthSmile,eyesClosed,eyesLookUp,eyesLookDown&textureSizeLimit=1024&textureFormat=png',
          // url: '/avatars/rigged_avatar.glb',
          url: '/avatars/rigged_avatar_rpm4.glb',
          body: 'F',
          avatarMood: 'happy',
          lipsyncLang: 'en'
        });
        
        // Force a pose change shortly after load to trigger logging in setPoseFromTemplate
        if (typeof window !== 'undefined') {
          setTimeout(() => {
            try {
              console.log('[TalkingHeadDemo] Forcing pose change to ...');
              head.setPoseFromTemplate(head.poseTemplates.straight, 800);
            } catch(e) {}
          }, 1500);
        }

        setIsInitialized(true);


      } catch (err) {
        console.error("Failed to initialize TalkingHead:", err);
      }
    };

    initAvatar();

    return () => headRef.current?.stop();
  }, []);

  const convertVisemesToOculus = visemes => {
    const visemeToOculusMap = {
      0: 'sil', 1: 'PP', 2: 'FF', 3: 'TH', 4: 'DD', 5: 'kk', 6: 'CH',
      7: 'SS', 8: 'nn', 9: 'RR', 10: 'aa', 11: 'E', 12: 'I', 13: 'O', 14: 'U',
      15: 'PP', 16: 'aa', 17: 'E', 18: 'I', 19: 'O', 20: 'U', 21: 'sil'
    };
    const convertedVisemes = visemes.map(v => visemeToOculusMap[v.visemeId] || 'sil');
    const times = visemes.map(v => v.audioOffset / 10000);
    const durations = visemes.map((v, i) =>
      i < visemes.length - 1
        ? (visemes[i + 1].audioOffset - v.audioOffset) / 10000
        : 100
    );
    return { visemes: convertedVisemes, times, durations };
  };

  return (
    <div ref={avatarRef} className="w-full max-w-4xl h-[60vh] mx-auto" />
  );
});

TalkingHeadDemo.displayName = "TalkingHeadDemo";
export default TalkingHeadDemo;
