export const runtime = 'nodejs';

import { NextResponse } from 'next/server';

// Helper function to create WAV file header
function createWavHeader(dataLength) {
  const sampleRate = 44100; // Use 44.1kHz instead of 16kHz
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
    console.log('STT API called');
    const { audioData, mimeType } = await req.json();
    console.log('Audio data received:', audioData ? 'Yes' : 'No', audioData?.length || 0, 'bytes');
    console.log('MIME type:', mimeType);

    const subscriptionKey = process.env.AZURE_SPEECH_KEY;
    const region = process.env.AZURE_SPEECH_REGION || 'eastus';

    console.log('Azure key exists:', !!subscriptionKey);
    console.log('Azure region:', region);

    if (!subscriptionKey) {
      throw new Error('Azure key not configured on server.');
    }

    if (!audioData) {
      throw new Error('No audio data provided.');
    }

    // Convert array to buffer
    const audioBuffer = Buffer.from(audioData);
    console.log('Audio buffer size:', audioBuffer.length, 'bytes');

    let wavBuffer;
    
    if (mimeType === 'audio/wav') {
      // If it's already WAV, use as-is
      wavBuffer = audioBuffer;
      console.log('Using audio as-is (WAV format)');
    } else {
      // For other formats, create WAV header
      const wavHeader = createWavHeader(audioBuffer.length);
      wavBuffer = Buffer.concat([wavHeader, audioBuffer]);
      console.log('WAV file size:', wavBuffer.length, 'bytes');
    }

    const speechApiUrl = `https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=en-US&format=simple`;
    
    const response = await fetch(speechApiUrl, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': subscriptionKey,
        'Content-Type': 'audio/wav; codecs=audio/pcm; samplerate=44100',
        'Accept': 'application/json',
      },
      body: wavBuffer,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Azure API error:', response.status, errorText);
      throw new Error(`Azure API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('Azure API response:', data);

    if (data.RecognitionStatus === 'Success' && data.DisplayText && data.DisplayText.trim()) {
      return NextResponse.json({ text: data.DisplayText });
    } else if (data.RecognitionStatus === 'Success' && (!data.DisplayText || !data.DisplayText.trim())) {
      throw new Error('Audio was processed but no speech was detected. Please try speaking more clearly.');
    } else if (data.RecognitionStatus === 'NoMatch') {
      throw new Error('No speech could be recognized in the audio');
    } else {
      console.error('Azure recognition failed:', data);
      throw new Error(`Speech recognition failed: ${data.RecognitionStatus || 'Unknown error'}`);
    }
  } catch (err) {
    console.error('STT API error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}