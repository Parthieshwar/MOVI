import { useState, useRef, useEffect } from "react";
import { MessageSquare, X, Send, Mic, Volume2, ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";

interface Message {
  id: string;
  text: string;
  sender: "user" | "movi";
  timestamp: Date;
}

export const MoviChat = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isListening, setIsListening] = useState(false);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const location = useLocation();
  
  // Determine current page from location
  const getCurrentPage = (): string => {
    const path = location.pathname;
    if (path === "/dashboard" || path.startsWith("/dashboard")) {
      return "busDashboard";
    } else if (path === "/" || path.startsWith("/")) {
      return "manageRoute";
    }
    return "busDashboard"; // default
  };

  const encodeWav = (audioBuffer: AudioBuffer) => {
    const numChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const length = audioBuffer.length * numChannels * 2 + 44; // 16-bit PCM, header 44 bytes
    const buffer = new ArrayBuffer(length);
    const view = new DataView(buffer);

    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };

    const writePCM16 = (output: DataView, offset: number, input: Float32Array) => {
      let pos = offset;
      for (let i = 0; i < input.length; i++, pos += 2) {
        let s = Math.max(-1, Math.min(1, input[i]));
        output.setInt16(pos, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      }
    };

    // RIFF header
    writeString(0, 'RIFF');
    view.setUint32(4, length - 8, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true); // PCM chunk size
    view.setUint16(20, 1, true); // PCM format
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * 2, true); // byte rate
    view.setUint16(32, numChannels * 2, true); // block align
    view.setUint16(34, 16, true); // bits per sample
    writeString(36, 'data');
    view.setUint32(40, length - 44, true);

    // Data
    const channels: Float32Array[] = [];
    for (let c = 0; c < numChannels; c++) channels.push(audioBuffer.getChannelData(c));
    let offset = 44;
    for (let i = 0; i < audioBuffer.length; i++) {
      for (let c = 0; c < numChannels; c++) {
        const sample = channels[c][i];
        let s = Math.max(-1, Math.min(1, sample));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
        offset += 2;
      }
    }

    return new Blob([view], { type: 'audio/wav' });
  };

  const convertToWav = async (blob: Blob) => {
    const arrayBuffer = await blob.arrayBuffer();
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const decoded = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
    const wavBlob = encodeWav(decoded);
    return wavBlob;
  };

  const playTTSAudio = (audioUrl: string) => {
    try {
      // Stop any currently playing audio
      if (audioElementRef.current) {
        audioElementRef.current.pause();
        audioElementRef.current = null;
      }
      
      // Create new audio element
      const audio = new Audio(audioUrl);
      audioElementRef.current = audio;
      audio.play().catch((err) => {
        console.error("Error playing TTS audio:", err);
      });
      
      // Clean up when done
      audio.onended = () => {
        audioElementRef.current = null;
      };
    } catch (error) {
      console.error("Error initializing TTS audio:", error);
    }
  };

  const finalizeAudio = async (audioBlob: Blob) => {
    // Upload to endpoint for server-side saving and agent processing
    try {
      const form = new FormData();
      form.append("type", "audio");
      form.append("currentPage", getCurrentPage());
      const wavBlob = await convertToWav(audioBlob);
      form.append("audio", wavBlob, `voice_${Date.now()}.wav`);
      // If an image is currently selected, include it too
      if (selectedImage) {
        try {
          const res = await fetch(selectedImage);
          const imgBlob = await res.blob();
          form.append("image", imgBlob, `image_${Date.now()}.png`);
        } catch {}
      }
      // If there is current text input, include it as well
      if (inputValue && inputValue.trim()) {
        form.append("text", inputValue.trim());
      }
      
      const response = await api.sendMoviMessage(form);
      const data = await response.json();
      
      // Show user message
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          text: "🎤 Voice message",
          sender: "user",
          timestamp: new Date(),
        },
      ]);
      
      // Display agent response
      if (data.response) {
        const moviResponse: Message = {
          id: (Date.now() + 1).toString(),
          text: data.response,
          sender: "movi",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, moviResponse]);
        
        // Play TTS audio if available
        if (data.audio_url) {
          // Convert relative path to absolute
          const audioUrl = data.audio_url.startsWith('http') 
            ? data.audio_url 
            : `http://localhost:5000${data.audio_url}`;
          setTimeout(() => playTTSAudio(audioUrl), 100); // Small delay to ensure message is displayed
        }
      }
    } catch {
      // Show fallback message on error
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          text: "Voice message recorded and sent",
          sender: "user",
          timestamp: new Date(),
        },
      ]);
    }
  };

  const handleSend = async () => {
    if (!inputValue.trim() && !selectedImage) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputValue || (selectedImage ? "[Image attached]" : ""),
      sender: "user",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const currentInput = inputValue;
    const currentImage = selectedImage;
    setInputValue("");
    setSelectedImage(null);

    // Send to agent endpoint
    try {
      const form = new FormData();
      form.append("type", "message");
      form.append("currentPage", getCurrentPage());
      if (currentInput.trim()) form.append("text", currentInput.trim());
      if (currentImage) {
        const res = await fetch(currentImage);
        const blob = await res.blob();
        form.append("image", blob, `image_${Date.now()}.png`);
      }
      
      const response = await api.sendMoviMessage(form);
      const data = await response.json();
      
      // Display agent response
      if (data.response) {
        const moviResponse: Message = {
          id: (Date.now() + 1).toString(),
          text: data.response,
          sender: "movi",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, moviResponse]);
        
        // Play TTS audio if available
        if (data.audio_url) {
          // Convert relative path to absolute
          const audioUrl = data.audio_url.startsWith('http') 
            ? data.audio_url 
            : `http://localhost:5000${data.audio_url}`;
          setTimeout(() => playTTSAudio(audioUrl), 100); // Small delay to ensure message is displayed
        }
      }
    } catch (error) {
      // Fallback to local response on error
      setTimeout(() => {
        const moviResponse: Message = {
          id: (Date.now() + 1).toString(),
          text: generateResponse(currentInput),
          sender: "movi",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, moviResponse]);
      }, 600);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const generateResponse = (input: string) => {
    const lowerInput = input.toLowerCase();
    
    if (lowerInput.includes("route")) {
      return "I can help you with route management. You can create new routes, edit existing ones, or view route details. What would you like to do?";
    } else if (lowerInput.includes("trip") || lowerInput.includes("vehicle")) {
      return "For trip and vehicle management, I can help you assign drivers, check booking status, or monitor live statuses. What do you need?";
    } else if (lowerInput.includes("driver")) {
      return "I can help you manage driver assignments. Would you like to assign a driver to a trip or view driver availability?";
    }
    
    return "I'm here to help with route management, trip scheduling, and vehicle assignments. Could you be more specific about what you need?";
  };

  const handleVoiceInput = async () => {
    // Record raw audio for upload via MediaRecorder
    try {
      if (!isListening) {
        mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioChunksRef.current = [];
        const recorder = new MediaRecorder(mediaStreamRef.current);
        mediaRecorderRef.current = recorder;
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data);
        };
        recorder.onstop = async () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
          await finalizeAudio(audioBlob);
        };
        recorder.start();
        setIsListening(true);
      } else {
        mediaRecorderRef.current?.stop();
        mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
        setIsListening(false);
      }
    } catch {
      setIsListening(false);
    }
  };

  return (
    <>
      {/* Chat Button */}
      <Button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-gradient-accent shadow-xl transition-transform hover:scale-110",
          isOpen && "scale-0"
        )}
      >
        <MessageSquare className="h-6 w-6 text-white" />
      </Button>

      {/* Chat Panel */}
      <div
        className={cn(
          "fixed bottom-6 right-6 z-50 flex h-[600px] w-96 flex-col rounded-2xl border border-border bg-background/95 backdrop-blur shadow-2xl transition-all duration-300",
          isOpen ? "scale-100 opacity-100" : "scale-0 opacity-0"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between rounded-t-2xl bg-gradient-accent px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 backdrop-blur">
              <MessageSquare className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-white tracking-tight">Movi</h3>
              <p className="text-xs text-white/80">AI Assistant</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsOpen(false)}
            className="h-8 w-8 text-white hover:bg-white/20 rounded-full"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Messages */}
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex",
                message.sender === "user" ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[80%] rounded-2xl px-4 py-2 shadow-sm",
                  message.sender === "user"
                    ? "bg-gradient-primary text-white"
                    : "bg-secondary/70 text-foreground"
                )}
              >
                <p className="text-sm">{message.text}</p>
                <p
                  className={cn(
                    "mt-1 text-xs",
                    message.sender === "user"
                      ? "text-white/70"
                      : "text-muted-foreground"
                  )}
                >
                  {message.timestamp.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-border p-4">
          {selectedImage && (
            <div className="mb-3 relative inline-block">
              <img
                src={selectedImage}
                alt="Upload preview"
                className="h-20 w-20 object-cover rounded-lg border border-border"
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-destructive text-white hover:bg-destructive/90"
                onClick={() => setSelectedImage(null)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              className="h-10 w-10 rounded-full hover:bg-primary/10 hover:text-primary"
            >
              <ImagePlus className="h-5 w-5" />
            </Button>
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSend()}
              placeholder="Ask Movi anything..."
              className="flex-1 rounded-full"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={handleVoiceInput}
              className={cn(
                "h-10 w-10 rounded-full",
                isListening ? "bg-destructive text-white" : "hover:bg-primary/10 hover:text-primary"
              )}
            >
              {isListening ? (
                <Volume2 className="h-5 w-5" />
              ) : (
                <Mic className="h-5 w-5" />
              )}
            </Button>
            <Button
              onClick={handleSend}
              className="h-10 w-10 bg-gradient-primary rounded-full shadow"
              size="icon"
            >
              <Send className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
      
      {/* Hidden audio element for TTS playback */}
      <audio ref={audioElementRef} style={{ display: 'none' }} />
    </>
  );
};
