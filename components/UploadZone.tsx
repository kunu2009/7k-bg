import React, { useRef, useState } from 'react';
import { UploadIcon, ImageIcon } from './Icons';
import { ImageFile } from '../types';
import { fileToBase64 } from '../utils/imageUtils';

interface UploadZoneProps {
  onImageSelected: (image: ImageFile) => void;
}

export const UploadZone: React.FC<UploadZoneProps> = ({ onImageSelected }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      await processFile(file);
    }
  };

  const processFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file (PNG, JPG, WebP).');
      return;
    }

    try {
      const base64 = await fileToBase64(file);
      const previewUrl = URL.createObjectURL(file);
      onImageSelected({
        file,
        previewUrl,
        base64,
        mimeType: file.type
      });
    } catch (error) {
      console.error('Error processing file:', error);
      alert('Failed to process image.');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await processFile(file);
    }
  };

  return (
    <div
      className={`relative group w-full max-w-2xl mx-auto h-96 rounded-3xl border-2 border-dashed transition-all duration-300 ease-in-out flex flex-col items-center justify-center text-center cursor-pointer overflow-hidden
        ${isDragging 
          ? 'border-indigo-500 bg-indigo-50/50 scale-[1.02] shadow-xl' 
          : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50'
        }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept="image/png, image/jpeg, image/jpg, image/webp"
      />
      
      <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

      <div className="z-10 p-8 flex flex-col items-center space-y-4">
        <div className={`p-4 rounded-full transition-colors duration-300 ${isDragging ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500 group-hover:bg-indigo-50 group-hover:text-indigo-500'}`}>
          {isDragging ? <UploadIcon className="w-10 h-10" /> : <ImageIcon className="w-10 h-10" />}
        </div>
        
        <div className="space-y-2">
          <h3 className="text-xl font-semibold text-slate-800">
            {isDragging ? 'Drop it like it\'s hot' : 'Upload your photo'}
          </h3>
          <p className="text-slate-500 max-w-sm mx-auto">
            Drag and drop your image here, or click to browse.
            <br />
            <span className="text-xs text-slate-400 mt-2 block">Supported: PNG, JPG, WebP</span>
          </p>
        </div>

        <button className="mt-4 px-6 py-2.5 rounded-full bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all hover:shadow-indigo-300">
          Select from device
        </button>
      </div>
    </div>
  );
};