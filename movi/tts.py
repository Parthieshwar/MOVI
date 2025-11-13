"""
Text-to-Speech using pyttsx3 or gTTS
Generates audio from text for Movi's responses
"""
import os
import tempfile

try:
    import pyttsx3
    PYTTSX3_AVAILABLE = True
except ImportError:
    PYTTSX3_AVAILABLE = False

try:
    from gtts import gTTS
    import io
    GTTS_AVAILABLE = True
except ImportError:
    GTTS_AVAILABLE = False

_tts_engine = None

def get_tts_engine():
    """Initialize TTS engine (prefer pyttsx3, fallback to gTTS)"""
    global _tts_engine
    
    if _tts_engine is not None:
        return _tts_engine
    
    if PYTTSX3_AVAILABLE:
        try:
            engine = pyttsx3.init()
            # Set properties for better voice
            voices = engine.getProperty('voices')
            if voices:
                # Try to use a female voice if available
                for voice in voices:
                    if 'female' in voice.name.lower() or 'zira' in voice.name.lower():
                        engine.setProperty('voice', voice.id)
                        break
            engine.setProperty('rate', 150)  # Speed of speech
            engine.setProperty('volume', 0.9)  # Volume level
            _tts_engine = engine
            print("[TTS] Using pyttsx3 engine")
            return engine
        except Exception as e:
            print(f"[TTS] pyttsx3 initialization failed: {e}")
    
    if GTTS_AVAILABLE:
        print("[TTS] Using gTTS engine (will save to file)")
        return "gtts"
    
    print("[TTS] No TTS engine available")
    return None

def text_to_speech(text: str, output_path: str = None) -> str:
    """
    Convert text to speech and save to audio file
    
    Args:
        text: Text to convert to speech
        output_path: Optional path to save audio file. If None, creates temp file.
    
    Returns:
        Path to the generated audio file, or None if TTS is not available
    """
    if not text or not text.strip():
        return None
    
    engine = get_tts_engine()
    
    if engine is None:
        return None
    
    try:
        if PYTTSX3_AVAILABLE and isinstance(engine, type(pyttsx3.init())):
            # Use pyttsx3
            if output_path is None:
                # Create temp file
                fd, output_path = tempfile.mkstemp(suffix='.wav')
                os.close(fd)
            
            engine.save_to_file(text, output_path)
            engine.runAndWait()
            
            print(f"[TTS] Generated audio file: {output_path}")
            return output_path
        
        elif GTTS_AVAILABLE and engine == "gtts":
            # Use gTTS (Google Text-to-Speech)
            if output_path is None:
                fd, output_path = tempfile.mkstemp(suffix='.mp3')
                os.close(fd)
            
            tts = gTTS(text=text, lang='en', slow=False)
            tts.save(output_path)
            
            print(f"[TTS] Generated audio file: {output_path}")
            return output_path
        
    except Exception as e:
        print(f"[TTS] Error generating speech: {e}")
        return None
    
    return None

def speak_text(text: str) -> bool:
    """
    Speak text directly (for immediate playback)
    
    Args:
        text: Text to speak
    
    Returns:
        True if successful, False otherwise
    """
    if not text or not text.strip():
        return False
    
    engine = get_tts_engine()
    
    if engine is None:
        return False
    
    try:
        if PYTTSX3_AVAILABLE and isinstance(engine, type(pyttsx3.init())):
            engine.say(text)
            engine.runAndWait()
            return True
    except Exception as e:
        print(f"[TTS] Error speaking text: {e}")
        return False
    
    return False

