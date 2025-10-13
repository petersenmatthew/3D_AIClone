'use client';
import { forwardRef, useImperativeHandle, useRef, useState, useEffect, useCallback } from "react";
import * as THREE from 'three';
import { linkMappings } from '../utils/linkMappings.js';

const TalkingHeadDemo = forwardRef((props, ref) => {
  const avatarRef = useRef(null);
  const headRef = useRef(null);
  const currentImageBoxRef = useRef(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  // Function to detect links in text and find their timing
  const detectLinksInText = (text, words, wtimes) => {
    const linkPhrases = Object.keys(linkMappings);
    const detectedLinks = [];
    
    // Find all link phrases in the text
    linkPhrases.forEach(phrase => {
      const regex = phrase.startsWith('@')
        ? new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
        : new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
      
      let match;
      while ((match = regex.exec(text)) !== null) {
        const startIndex = match.index;
        const endIndex = startIndex + phrase.length;
        
        // Find which word contains this phrase
        let wordIndex = 0;
        let currentPos = 0;
        
        for (let i = 0; i < words.length; i++) {
          const wordStart = currentPos;
          const wordEnd = currentPos + words[i].length;
          
          if (startIndex >= wordStart && startIndex < wordEnd) {
            wordIndex = i;
            break;
          }
          currentPos = wordEnd + 1; // +1 for space
        }
        
        detectedLinks.push({
          phrase,
          wordIndex,
          startTime: wtimes[wordIndex] || 0,
          linkData: linkMappings[phrase]
        });
      }
    });
    
    return detectedLinks;
  };

  // Helper function to remove existing image box
  const removeCurrentImageBox = useCallback(() => {
    if (currentImageBoxRef.current && headRef.current?.scene) {
      headRef.current.scene.remove(currentImageBoxRef.current);
      currentImageBoxRef.current = null;
    }
  }, []);

  // Helper function to add/update image rectangle
  const addImageRectangle = (imagePath, position = { x: 0, y: 1.3, z: 0.4 }, onClick = null) => {
    if (!headRef.current) {
      return null;
    }
    
    // Remove existing image box first
    removeCurrentImageBox();
    
    const scene = headRef.current.scene;
    if (!scene) {
      console.error('Scene not available');
      return null;
    }
    
    // Create a group to hold both the image and the close button
    const imageGroup = new THREE.Group();
    imageGroup.position.set(position.x, position.y, position.z);
    
    // Create the main image box
    const textureLoader = new THREE.TextureLoader();
    const texture = textureLoader.load(imagePath);
    
    const geometry = new THREE.BoxGeometry(0.50, 0.28125, 0.02);
    const material = new THREE.MeshPhongMaterial({ 
      map: texture,
      side: THREE.FrontSide // Only render front side to avoid ghosting
    });
    
    const imageBox = new THREE.Mesh(geometry, material);
    imageBox.position.set(0, 0, 0);
    
    // Create a clean border using a simple approach
    const borderThickness = 0.005;
    
    // Create the main border frame (slightly larger than the image)
    const borderGeometry = new THREE.BoxGeometry(0.51, 0.29125, borderThickness);
    const borderMaterial = new THREE.MeshPhongMaterial({ 
      color: 0x888888, // Light grey color
      side: THREE.FrontSide,
      transparent: true,
      opacity: 0.9
    });
    
    const borderBox = new THREE.Mesh(borderGeometry, borderMaterial);
    borderBox.position.set(0, 0, -0.001); // Slightly behind the image
    
    // Create a subtle shadow/glow effect
    const shadowGeometry = new THREE.BoxGeometry(0.52, 0.30125, 0.001);
    const shadowMaterial = new THREE.MeshPhongMaterial({ 
      color: 0x000000,
      side: THREE.FrontSide,
      transparent: true,
      opacity: 0.1
    });
    
    const shadowBox = new THREE.Mesh(shadowGeometry, shadowMaterial);
    shadowBox.position.set(0, 0, -0.002); // Behind the border
    
    // No corner elements needed - keep it clean and simple
    const corners = [];
    
    // Add click detection if onClick is provided
    if (onClick) {
      imageBox.userData = { 
        isClickable: true, 
        onClick: onClick
      };
    }
    
    // Create the X close button using the SVG texture
    const closeButtonTexture = textureLoader.load('/images/x_button.svg');
    const closeButtonGeometry = new THREE.PlaneGeometry(0.03, 0.03); // Use PlaneGeometry for flat surface
    const closeButtonMaterial = new THREE.MeshPhongMaterial({ 
      map: closeButtonTexture,
      side: THREE.FrontSide, // Only render front side
      transparent: true
    });
    
    const closeButton = new THREE.Mesh(closeButtonGeometry, closeButtonMaterial);
    // Position the close button in the top-left corner
    closeButton.position.set(-0.225, 0.115, 0.015); // Slightly in front of the image
    closeButton.userData = { 
      isClickable: true, 
      onClick: () => {
        console.log('Close button clicked');
        
        // Animate the close with a smooth scale-down animation
        const animateClose = () => {
          const startTime = Date.now();
          const duration = 200; // 200ms animation (faster than appearance)
          
          const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Use easeInCubic for smooth acceleration
            const easeInCubic = Math.pow(progress, 3);
            const scale = 1 - easeInCubic; // Scale from 1 to 0
            
            imageGroup.scale.set(scale, scale, scale);
            
            if (progress < 1) {
              requestAnimationFrame(animate);
            } else {
              // Remove the box after animation completes
              removeCurrentImageBox();
            }
          };
          
          requestAnimationFrame(animate);
        };
        
        // Start the close animation
        animateClose();
      }
    };
    
    // Add all elements to the group
    imageGroup.add(shadowBox); // Add shadow first (behind everything)
    imageGroup.add(borderBox); // Add border second (behind image)
    imageGroup.add(imageBox);
    imageGroup.add(closeButton);
    
    // Add the group to the scene
    scene.add(imageGroup);
    currentImageBoxRef.current = imageGroup;
    
    // Animate the appearance with a smooth scale animation
    imageGroup.scale.set(0, 0, 0); // Start with no scale
    
    // Create smooth scale animation
    const animateAppearance = () => {
      const startTime = Date.now();
      const duration = 300; // 300ms animation
      
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Use easeOutCubic for smooth deceleration
        const easeOutCubic = 1 - Math.pow(1 - progress, 3);
        const scale = easeOutCubic;
        
        imageGroup.scale.set(scale, scale, scale);
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };
      
      requestAnimationFrame(animate);
    };
    
    // Start the animation
    animateAppearance();
    
    return imageGroup;
  };

  // Expose `speak(textOrObj, voice, provider)` and `addImageRectangle` to parent via ref
  useImperativeHandle(ref, () => ({
    speak: async (textOrObj, voice = 'en-CA-LiamNeural', provider = 'azure') => {
      if (!isInitialized || isPlaying) return;
      setIsPlaying(true);

      // Clear any existing image box when starting a new message
      removeCurrentImageBox();

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

        // Detect links in the text
        const detectedLinks = detectLinksInText(text, words, wtimes);
        
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


        // Handle link detection - show image and play gesture
        detectedLinks.forEach(link => {
          const delayMs = link.startTime; // Already in milliseconds from the TTS data
          
          setTimeout(() => {
            // Play present gesture when link is mentioned
            if (headRef.current) {
              headRef.current.playGesture('present', 2, false, 1000);
            }
            
            // Show the appropriate image for the link
            addImageRectangle(link.linkData.image, { x: 0, y: 1.3, z: 0.4 }, () => {
              window.open(link.linkData.url, '_blank');
            });
          }, delayMs); // Use the delay directly
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
        // If there's an error, still call the last word callback to reset generating state
        if (props.onWord) {
          props.onWord("", 0, { isLastWord: true, error: true });
        }
      } finally {
        setIsPlaying(false);
      }
      
    },
    addImageRectangle,
    removeCurrentImageBox
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
          cameraRotateX: 0,
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

        // Set up raycasting for click detection on dynamic image boxes
        setTimeout(() => {
          try {
            const scene = head.scene;
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
              
              // Check if we clicked on any clickable object
              for (let intersect of intersects) {
                if (intersect.object.userData.isClickable) {
                  intersect.object.userData.onClick();
                  break;
                }
              }
            };
            
            // Add click event listener to the renderer's DOM element
            head.renderer.domElement.addEventListener('click', onMouseClick);
            
            console.log('Click detection set up for dynamic image rectangles');
          } catch (error) {
            console.error('Error setting up click detection:', error);
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
                // head.playGesture('present', 5, false, 1000);
                // head.playAnimation('/animations/pointbackwards.fbx', null, 0.69, 0, 0.01);
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

    return () => {
      removeCurrentImageBox();
      headRef.current?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
