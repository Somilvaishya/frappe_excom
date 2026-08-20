import {
  Phone,
  Video,
  Mic,
  MicOff,
  VideoOff,
  PhoneOff,
  Volume2,
  VolumeX,
  Minimize2,
} from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { useState, useEffect } from "react";

interface CallScreenProps {
  contact: { name: string; avatar: string; company?: string };
  callType: "voice" | "video";
  onEndCall: () => void;
  onMinimize?: () => void;
}

export function CallScreen({
  contact,
  callType,
  onEndCall,
  onMinimize,
}: CallScreenProps) {
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(callType === "video");
  const [callStatus, setCallStatus] = useState<
    "connecting" | "ringing" | "active"
  >("connecting");

  useEffect(() => {
    const connectTimer = setTimeout(() => setCallStatus("ringing"), 1000);
    const answerTimer = setTimeout(() => setCallStatus("active"), 3000);
    return () => {
      clearTimeout(connectTimer);
      clearTimeout(answerTimer);
    };
  }, []);

  useEffect(() => {
    if (callStatus !== "active") return;
    const timer = setInterval(() => setDuration((prev) => prev + 1), 1000);
    return () => clearInterval(timer);
  }, [callStatus]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const statusText =
    callStatus === "connecting"
      ? "Connecting..."
      : callStatus === "ringing"
      ? "Ringing..."
      : formatDuration(duration);

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-b from-zinc-100 via-white to-black flex flex-col">
      <div className="p-3 flex items-center justify-between">
        <Badge className="bg-green-500/10 text-green-700 border-green-500/20 border">
          <Phone className="w-3 h-3 mr-1 animate-pulse" />
          {callStatus === "active" ? "Active" : "Calling"}
        </Badge>
        {onMinimize && (
          <Button
            onClick={onMinimize}
            variant="ghost"
            size="icon"
            className="text-zinc-600 hover:text-zinc-900"
          >
            <Minimize2 className="w-5 h-5" />
          </Button>
        )}
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4">
        {callType === "video" && callStatus === "active" ? (
          <div className="w-full max-w-sm aspect-[3/4] bg-zinc-50 rounded-2xl overflow-hidden relative mb-4">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
              <div className="text-center">
                <Video className="w-16 h-16 text-zinc-900/50 mx-auto mb-2" />
                <p className="text-zinc-900/50 text-sm">Video feed</p>
              </div>
            </div>
            <div className="absolute top-4 right-4 w-24 h-32 bg-zinc-100 rounded-lg overflow-hidden border-2 border-zinc-300">
              {contact.avatar && (
                <img
                  src={contact.avatar}
                  alt="You"
                  className="w-full h-full object-cover opacity-50"
                />
              )}
            </div>
          </div>
        ) : (
          <div className="mb-8">
            <div className="w-32 h-32 mx-auto mb-4 relative">
              {contact.avatar ? (
                <img
                  src={contact.avatar}
                  alt={contact.name}
                  className="w-full h-full rounded-full object-cover ring-4 ring-zinc-200"
                />
              ) : (
                <div className="w-full h-full rounded-full bg-gradient-to-br from-blue-500 to-purple-600 ring-4 ring-zinc-200 flex items-center justify-center text-white text-3xl font-medium">
                  {contact.name[0]}
                </div>
              )}
              {callStatus === "active" && (
                <div className="absolute inset-0 rounded-full border-4 border-blue-500/50 animate-ping" />
              )}
            </div>
          </div>
        )}

        <h2 className="text-2xl font-semibold text-zinc-900 mb-2">
          {contact.name}
        </h2>
        {contact.company && (
          <p className="text-zinc-600 mb-3">{contact.company}</p>
        )}
        <div className="flex items-center gap-2 text-zinc-700">
          {callType === "video" ? (
            <Video className="w-4 h-4" />
          ) : (
            <Phone className="w-4 h-4" />
          )}
          <span className="text-lg">{statusText}</span>
        </div>
      </div>

      <div className="p-4 pb-8">
        <div className="flex items-center justify-center gap-3 mb-4">
          <button
            onClick={() => setIsMuted(!isMuted)}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
              isMuted
                ? "bg-red-500 hover:bg-red-600"
                : "bg-zinc-100 hover:bg-zinc-200"
            }`}
          >
            {isMuted ? (
              <MicOff className="w-6 h-6 text-zinc-900" />
            ) : (
              <Mic className="w-6 h-6 text-zinc-900" />
            )}
          </button>

          <button
            onClick={onEndCall}
            className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-all shadow-lg shadow-red-500/50"
          >
            <PhoneOff className="w-7 h-7 text-zinc-900" />
          </button>

          {callType === "video" ? (
            <button
              onClick={() => setIsVideoOff(!isVideoOff)}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                isVideoOff
                  ? "bg-red-500 hover:bg-red-600"
                  : "bg-zinc-100 hover:bg-zinc-200"
              }`}
            >
              {isVideoOff ? (
                <VideoOff className="w-6 h-6 text-zinc-900" />
              ) : (
                <Video className="w-6 h-6 text-zinc-900" />
              )}
            </button>
          ) : (
            <button
              onClick={() => setIsSpeakerOn(!isSpeakerOn)}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                isSpeakerOn
                  ? "bg-blue-500 hover:bg-blue-600"
                  : "bg-zinc-100 hover:bg-zinc-200"
              }`}
            >
              {isSpeakerOn ? (
                <Volume2 className="w-6 h-6 text-zinc-900" />
              ) : (
                <VolumeX className="w-6 h-6 text-zinc-900" />
              )}
            </button>
          )}
        </div>

        <div className="flex items-center justify-center gap-5 text-xs text-zinc-600">
          <span>{isMuted ? "Muted" : "Mic on"}</span>
          <span>End call</span>
          <span>
            {callType === "video"
              ? isVideoOff
                ? "Video off"
                : "Video on"
              : isSpeakerOn
              ? "Speaker"
              : "Earpiece"}
          </span>
        </div>
      </div>
    </div>
  );
}
