'use client';
import { forwardRef, useImperativeHandle, useRef, useState, useEffect } from "react";
import * as THREE from 'three';

const TalkingHeadDemo = forwardRef((props, ref) => {
  const avatarRef = useRef(null);
  const headRef = useRef(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  // Helper function to add/update image rectangle
  const addImageRectangle = (imagePath, position = { x: -1.5, y: 1.2, z: 0 }, onClick = null) => {
    if (!headRef.current) return null;
    
    const scene = headRef.current.scene;
    if (!scene) {
      console.error('Scene not available');
      return null;
    }
    
    const textureLoader = new THREE.TextureLoader();
    const texture = textureLoader.load(imagePath);
    
    const geometry = new THREE.BoxGeometry(1, 0.75, 0.02);
    const material = new THREE.MeshBasicMaterial({ 
      map: texture,
      side: THREE.DoubleSide 
    });
    
    const imageBox = new THREE.Mesh(geometry, material);
    imageBox.position.set(position.x, position.y, position.z);
    
    // Add click detection if onClick is provided
    if (onClick) {
      imageBox.userData = { 
        isClickable: true, 
        onClick: onClick
      };
    }
    
    scene.add(imageBox);
    return imageBox;
  };

  // Expose `speak(textOrObj, voice, provider)` and `addImageRectangle` to parent via ref
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
      
    },
    addImageRectangle
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

        // Add 3D image rectangle after avatar is fully loaded
        setTimeout(() => {
          try {
            const scene = head.scene; // Get the Three.js scene from TalkingHead

            // Create texture loader
            const textureLoader = new THREE.TextureLoader();
            const texture = textureLoader.load('/images/4sight.png');

            // Create thin rectangular geometry
            const geometry = new THREE.BoxGeometry(0.25, 0.14, 0.02); // Medium rectangle (1m x 0.75m x 2cm)

            // Create material with the image texture
            const material = new THREE.MeshPhongMaterial({ 
              map: texture,
              side: THREE.DoubleSide 
            });

            // Create mesh and position it
            const imageBox = new THREE.Mesh(geometry, material);
            imageBox.position.set(-0.3, 1.75, 0); // Top-left of avatar (adjust as needed)
            
            // Add click detection
            imageBox.userData = { 
              isClickable: true, 
              onClick: () => {
                console.log('3D Rectangle clicked!');
                alert('You clicked the 3D image rectangle! This is a placeholder.');
              }
            };

            // Add to scene
            scene.add(imageBox);
            
            // Set up raycasting for click detection
            const raycaster = new THREE.Raycaster();
            const mouse = new THREE.Vector2();
            
            const onMouseClick = (event) => {
              // Calculate mouse position in normalized device coordinates
              const rect = head.renderer.domElement.getBoundingClientRect();
              mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
              mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
              
              // Update the picking ray with the camera and mouse position
              raycaster.setFromCamera(mouse, head.camera);
              
              // Calculate objects intersecting the picking ray
              const intersects = raycaster.intersectObjects(scene.children, true);
              
              // Check if we clicked on our image box
              for (let intersect of intersects) {
                if (intersect.object.userData.isClickable) {
                  intersect.object.userData.onClick();
                  break;
                }
              }
            };
            
            // Add click event listener to the renderer's DOM element
            head.renderer.domElement.addEventListener('click', onMouseClick);
            
            // Store the click handler for cleanup
            imageBox.userData.clickHandler = onMouseClick;
            
            console.log('3D image rectangle added successfully with click detection');
          } catch (error) {
            console.error('Error adding 3D image rectangle:', error);
          }
        }, 2000); // Wait 2 seconds for TalkingHead to fully initialize
        
        // Force a pose change shortly after load to trigger logging in setPoseFromTemplate
        if (typeof window !== 'undefined') {
          setTimeout(() => {
            try {
              console.log('[TalkingHeadDemo] Forcing pose change to ...');
              head.setPoseFromTemplate(head.poseTemplates.straight, 800);
              
              // Play pointing animation after thumbup gesture
              setTimeout(() => {
                console.log('[TalkingHeadDemo] Playing pointing animation...');
                // head.playGesture('pointright', 5, false, 300);
                head.playAnimation('/animations/pointbackwards.fbx', null, 0.69, 0, 0.01);
              }, 600); // 500ms gesture + 100ms buffer
              
              // -y fw, z up : rotated 180 degrees on y axis
            } catch(e) {
              console.error('[TalkingHeadDemo] Error playing gesture:', e);
            }
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
        // Use the more accurate mapping from TalkingHead website
        const visemeMap = [
          "sil", 'aa', 'aa', 'O', 'E',     // 0 - 4
          'E', 'I', 'U', 'O', 'aa',        // 5 - 9
          'O', 'I', 'kk', 'RR', 'nn',      // 10 - 14
          'SS', 'SS', 'TH', 'FF', 'DD',    // 15 - 19
          'kk', 'PP'                       // 20 - 21
        ];

        const convertedVisemes = [];
        const times = [];
        const durations = [];

        for (let i = 0; i < visemes.length; i++) {
          const viseme = visemeMap[visemes[i].visemeId] || 'sil';
          const time = visemes[i].audioOffset / 10000;

          // Skip silence at the beginning
          if (convertedVisemes.length === 0 && viseme === 'sil') {
            continue;
          }

          // Calculate duration dynamically
          if (convertedVisemes.length > 0) {
            const prevTime = times[times.length - 1];
            durations[durations.length - 1] = time - prevTime;
          }

          convertedVisemes.push(viseme);
          times.push(time);
          durations.push(75); // Will be fixed on next iteration
        }

        // Fix the last duration
        if (durations.length > 0) {
          durations[durations.length - 1] = 100; // Default duration for last viseme
        }

        return { visemes: convertedVisemes, times, durations };
      };

  return (
    <div ref={avatarRef} className="w-full max-w-4xl h-[60vh] mx-auto" />
  );
});

TalkingHeadDemo.displayName = "TalkingHeadDemo";
export default TalkingHeadDemo;
