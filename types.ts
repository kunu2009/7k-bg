import React from 'react';

export interface ImageFile {
  file: File;
  previewUrl: string;
  base64: string;
  mimeType: string;
}

export interface GeneratedImage {
  imageUrl: string;
  prompt: string;
  timestamp: number;
}

export enum EditorStatus {
  IDLE = 'IDLE',
  UPLOADING = 'UPLOADING',
  READY = 'READY',
  PROCESSING = 'PROCESSING',
  COMPLETE = 'COMPLETE',
  ERROR = 'ERROR'
}

export interface PresetPrompt {
  label: string;
  prompt: string;
  icon: React.ReactNode;
}