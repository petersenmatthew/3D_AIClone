export const runtime = 'nodejs';

import { NextResponse } from 'next/server';

// Helper function to create WAV file header
function createWavHeader(dataLength, sampleRate = 16000) {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * bitsPerSample / 8;
  const blockAlign = numChannels * bitsPerSample / 8;
  const totalLength = 36 + dataLength;
  
  const buffer = Buffer.alloc(44);
  
  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(totalLength, 4);
  buffer.write('WAVE', 8);
  
  // fmt chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  
  // data chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataLength, 40);
  
  return buffer;
}

export async function POST(req) {
  try {
    const { audioData, mimeType } = await req.json();

    const subscriptionKey = process.env.AZURE_SPEECH_KEY;
    const region = process.env.AZURE_SPEECH_REGION || 'eastus';

    if (!subscriptionKey) {
      throw new Error('Azure key not configured on server.');
    }

    if (!audioData) {
      throw new Error('No audio data provided.');
    }

    // Convert array to buffer
    const audioBuffer = Buffer.from(audioData);

    // Create multipart form data manually
    const boundary = '----formdata-' + Math.random().toString(36).substring(2);
    
    let formData = '';
    
    // Add the definition part with language detection
    formData += `--${boundary}\r\n`;
    formData += `Content-Disposition: form-data; name="definition"\r\n`;
    formData += `Content-Type: application/json\r\n\r\n`;
    formData += JSON.stringify({ 
      locales: [
        'en-US',
        'zh-CN', 'zh-HK',
        'ja-JP', 'ko-KR',
        'es-ES', 'fr-FR',
      ]
    }) + '\r\n';
    
    // Add the audio part
    formData += `--${boundary}\r\n`;
    formData += `Content-Disposition: form-data; name="audio"; filename="audio.webm"\r\n`;
    formData += `Content-Type: ${mimeType}\r\n\r\n`;
    
    // Convert form data string to buffer and append audio buffer
    const formDataBuffer = Buffer.concat([
      Buffer.from(formData, 'utf8'),
      audioBuffer,
      Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8')
    ]);

    const fastTranscriptionUrl = `https://${region}.api.cognitive.microsoft.com/speechtotext/transcriptions:transcribe?api-version=2024-11-15`;
    
    const response = await fetch(fastTranscriptionUrl, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': subscriptionKey,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': formDataBuffer.length.toString(),
      },
      body: formDataBuffer,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Azure Fast Transcription API error:', response.status, errorText);
      
      // Handle "No language was identified" error gracefully
      if (response.status === 422 && errorText.includes('NoLanguageIdentified')) {
        console.log('No language identified in audio - returning empty response');
        return NextResponse.json({ text: '', language: 'en-US', confidence: 0 });
      }
      
      throw new Error(`Azure Fast Transcription API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    // Extract text and language information from the response
    let detectedLanguage = 'en-US'; // Default fallback
    let confidence = 0;
    
    // Get language info from phrases if available
    if (data.phrases && data.phrases.length > 0) {
      // Use the language from the first phrase as the primary detected language
      detectedLanguage = data.phrases[0].locale || 'en-US';
      confidence = data.phrases[0].confidence || 0;
    }

    // Extract text from the response
    if (data.combinedPhrases && data.combinedPhrases.length > 0) {
      const combinedText = data.combinedPhrases[0].text;
      if (combinedText && combinedText.trim()) {
        return NextResponse.json({ 
          text: combinedText.trim(),
          language: detectedLanguage,
          confidence: confidence
        });
      }
    }

    // If no combined phrases, check individual phrases
    if (data.phrases && data.phrases.length > 0) {
      const phrases = data.phrases.map(phrase => phrase.text).join(' ');
      if (phrases && phrases.trim()) {
        return NextResponse.json({ 
          text: phrases.trim(),
          language: detectedLanguage,
          confidence: confidence
        });
      }
    }

    // No speech detected - return empty text instead of error
    return NextResponse.json({ text: '', language: detectedLanguage, confidence: 0 });

  } catch (err) {
    console.error('Fast Transcription API error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}