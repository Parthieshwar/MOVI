"""
Automatic Speech Recognition using OpenAI Whisper
Processes audio files and returns transcribed text
"""
import whisper
import os

# Load Whisper base model (cached after first load)
_model = None

def load_model():
    """Load Whisper base model (lazy loading)"""
    global _model
    if _model is None:
        print("[ASR] Loading Whisper base model...")
        _model = whisper.load_model("base")
        print("[ASR] Whisper base model loaded successfully!")
    return _model

def transcribe_audio(audio_path: str) -> str:
    """
    Transcribe audio file using Whisper base model
    
    Args:
        audio_path: Path to the audio file (WAV, MP3, etc.)
    
    Returns:
        Transcribed text as string
    """
    try:
        if not os.path.exists(audio_path):
            print(f"[ASR] Error: Audio file not found: {audio_path}")
            return ""
        
        print(f"[ASR] Processing audio file: {audio_path}")
        model = load_model()
        
        # Transcribe audio
        result = model.transcribe(audio_path)
        transcribed_text = result["text"].strip()
        
        print(f"[ASR] Transcription completed!")
        print(f"[ASR] Extracted speech: {transcribed_text}")
        
        return transcribed_text
    except Exception as e:
        print(f"[ASR] Error during transcription: {str(e)}")
        return ""

