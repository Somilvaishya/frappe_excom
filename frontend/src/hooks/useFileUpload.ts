import { useRef, useCallback, useState } from "react";
import { useFrappeFileUpload } from "frappe-react-sdk";

const ACCEPTED_TYPES: Record<string, string[]> = {
  image: ["image/jpeg", "image/png", "image/gif", "image/webp"],
  document: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ],
  video: ["video/mp4", "video/webm"],
  audio: ["audio/ogg", "audio/mpeg", "audio/mp3"],
};

const ALL_ACCEPTED = Object.values(ACCEPTED_TYPES).flat().join(",");

function detectMessageType(mime: string): string {
  for (const [type, mimes] of Object.entries(ACCEPTED_TYPES)) {
    if (mimes.some((m) => mime.startsWith(m.split("/")[0]) || m === mime)) {
      return type.charAt(0).toUpperCase() + type.slice(1);
    }
  }
  return "Document";
}

/**
 * Hook for file attachment: provides a hidden input ref, open trigger,
 * upload function, and drag-and-drop handlers.
 */
export function useFileUpload(
  onFileReady: (fileUrl: string, messageType: string, fileName: string) => void,
) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const { upload, loading: uploading, progress } = useFrappeFileUpload();

  const openFilePicker = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const uploadFile = useCallback(
    async (file: File) => {
      const messageType = detectMessageType(file.type);
      const result = await upload(file, {
        isPrivate: true,
      });
      onFileReady(result.file_url, messageType, result.file_name);
    },
    [upload, onFileReady],
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) uploadFile(file);
      if (inputRef.current) inputRef.current.value = "";
    },
    [uploadFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) uploadFile(file);
    },
    [uploadFile],
  );

  return {
    inputRef,
    openFilePicker,
    handleFileChange,
    uploading,
    progress,
    isDragging,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    acceptedTypes: ALL_ACCEPTED,
  };
}
