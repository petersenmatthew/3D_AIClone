export const runtime = 'nodejs';

import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const { text, voiceId = 'pNInz6obpgDQGcFmaJgB' } = await req.json(); // Default to Adam voice

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      throw new Error('ElevenLabs API key not configured on server.');
    }

    // Use the with-timestamps endpoint for better latency and simpler implementation
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.8,
          similarity_boost: true
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ElevenLabs API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    
    // Process the alignment data from the response
    const alignment = data.normalized_alignment || data.alignment;
    let visemeData = [];
    let wordData = [];

    if (alignment) {
      // Parse characters to words
      let word = '';
      let wordStartTime = 0;
      let wordDuration = 0;
      
      for (let i = 0; i < alignment.characters.length; i++) {
        const char = alignment.characters[i];
        const charStartTime = alignment.character_start_times_seconds[i] * 1000; // Convert to ms
        const charEndTime = alignment.character_end_times_seconds[i] * 1000; // Convert to ms
        const charDuration = charEndTime - charStartTime;
        
        if (word.length === 0) {
          wordStartTime = charStartTime;
        }
        
        if (char === ' ') {
          // End of word
          if (word.length > 0) {
            wordData.push({
              text: word,
              audioOffset: wordStartTime * 10000, // Convert to 100ns units like Azure
              duration: wordDuration * 10000
            });
            word = '';
            wordDuration = 0;
          }
        } else {
          word += char;
          wordDuration += charDuration;
        }
      }
      
      // Add the last word if it exists
      if (word.length > 0) {
        wordData.push({
          text: word,
          audioOffset: wordStartTime * 10000,
          duration: wordDuration * 10000
        });
      }
      
      // Replace pinyin syllables with original Chinese characters
      const originalText = text;
      
      // Check if text contains Chinese characters
      const hasChinese = /[\u4e00-\u9fff]/.test(originalText);
      
      if (hasChinese) {
        // For Chinese text, split into individual characters
        const originalChars = Array.from(originalText).filter(char => char.trim().length > 0);
        
        // Map each alignment word to a Chinese character
        for (let i = 0; i < wordData.length && i < originalChars.length; i++) {
          wordData[i].text = originalChars[i];
        }
        
        // Group Chinese characters into words for better display
        const groupedWords = [];
        let currentWord = '';
        
        for (let i = 0; i < wordData.length; i++) {
          const char = wordData[i].text;
          const isChinese = /[\u4e00-\u9fff]/.test(char);
          
          if (isChinese) {
            currentWord += char;
          } else {
            // Non-Chinese character (punctuation, etc.)
            if (currentWord) {
              groupedWords.push({
                text: currentWord,
                audioOffset: wordData[i - currentWord.length]?.audioOffset || 0,
                duration: wordData[i - 1]?.audioOffset + wordData[i - 1]?.duration - (wordData[i - currentWord.length]?.audioOffset || 0) || 0
              });
              currentWord = '';
            }
            groupedWords.push({
              text: char,
              audioOffset: wordData[i].audioOffset,
              duration: wordData[i].duration
            });
          }
        }
        
        // Add the last word if it exists
        if (currentWord) {
          const startIndex = wordData.length - currentWord.length;
          groupedWords.push({
            text: currentWord,
            audioOffset: wordData[startIndex]?.audioOffset || 0,
            duration: wordData[wordData.length - 1]?.audioOffset + wordData[wordData.length - 1]?.duration - (wordData[startIndex]?.audioOffset || 0) || 0
          });
        }
        
        // Replace wordData with grouped words
        wordData.length = 0;
        wordData.push(...groupedWords);
      } else {
        // For non-Chinese text, use word-based replacement
        const originalWords = originalText.split(/\s+/).filter(word => word.length > 0);
        
        // Map alignment words to original words by position
        for (let i = 0; i < wordData.length && i < originalWords.length; i++) {
          wordData[i].text = originalWords[i];
        }
      }

      // Convert character alignment to viseme data
      const charToViseme = {
        'a': 10, 'e': 11, 'i': 12, 'o': 13, 'u': 14,
        'b': 1, 'p': 1, 'm': 1,
        'f': 2, 'v': 2,
        't': 3, 'd': 4, 'n': 8, 'l': 8,
        'k': 5, 'g': 5, 'c': 5, 'q': 5,
        's': 7, 'z': 7, 'j': 6,
        'r': 9,
        ' ': 0, 'h': 0, 'w': 0, 'y': 0, 'x': 0
      };

      for (let i = 0; i < alignment.characters.length; i++) {
        const char = alignment.characters[i].toLowerCase();
        const startTime = alignment.character_start_times_seconds[i] * 1000; // Convert to ms
        
        visemeData.push({
          visemeId: charToViseme[char] || 0,
          audioOffset: startTime * 10000 // Convert to 100ns units like Azure
        });
      }
    }

    return NextResponse.json({
      audio: data.audio_base64,
      visemes: visemeData,
      words: wordData
    });

  } catch (err) {
    console.error('ElevenLabs TTS API error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

