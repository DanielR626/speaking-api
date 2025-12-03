// api/transcribe.js
// Este archivo va en una carpeta "api" en tu proyecto

const fetch = require('node-fetch');
const FormData = require('form-data');

module.exports = async (req, res) => {
  // CORS headers para permitir peticiones desde GitHub Pages
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Manejar preflight request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Tu API key de AssemblyAI (guardada como variable de entorno)
    const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY;

    if (!ASSEMBLYAI_API_KEY) {
      throw new Error('API key not configured');
    }

    // Obtener el archivo de audio del request
    const audioBuffer = req.body;

    // 1. Subir audio a AssemblyAI
    const uploadResponse = await fetch('https://api.assemblyai.com/v2/upload', {
      method: 'POST',
      headers: {
        'authorization': ASSEMBLYAI_API_KEY,
      },
      body: audioBuffer
    });

    if (!uploadResponse.ok) {
      throw new Error('Failed to upload audio');
    }

    const { upload_url } = await uploadResponse.json();

    // 2. Solicitar transcripción
    const transcriptResponse = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: {
        'authorization': ASSEMBLYAI_API_KEY,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        audio_url: upload_url,
        language_code: 'en'
      })
    });

    if (!transcriptResponse.ok) {
      throw new Error('Failed to request transcription');
    }

    const { id } = await transcriptResponse.json();

    // 3. Esperar a que la transcripción esté lista (polling)
    let result;
    let attempts = 0;
    const maxAttempts = 60; // 60 segundos máximo

    do {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const pollResponse = await fetch(`https://api.assemblyai.com/v2/transcript/${id}`, {
        headers: { 'authorization': ASSEMBLYAI_API_KEY }
      });

      result = await pollResponse.json();
      attempts++;

      if (attempts >= maxAttempts) {
        throw new Error('Transcription timeout');
      }

    } while (result.status !== 'completed' && result.status !== 'error');

    // 4. Devolver resultado
    if (result.status === 'completed') {
      res.status(200).json({
        success: true,
        text: result.text || 'No speech detected in audio.'
      });
    } else {
      throw new Error('Transcription failed');
    }

  } catch (error) {
    console.error('Transcription error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Transcription failed'
    });
  }
};
