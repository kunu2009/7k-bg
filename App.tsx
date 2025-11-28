import React, { useState } from 'react';
import { UploadZone } from './components/UploadZone';
import { Editor } from './components/Editor';
import { ImageFile } from './types';
import { SparklesIcon } from './components/Icons';

function App() {
  const [activeImage, setActiveImage] = useState<ImageFile | null>(null);

  const handleImageSelect = (image: ImageFile) => {
    setActiveImage(image);
  };

  const handleReset = () => {
    setActiveImage(null);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 selection:bg-indigo-100 selection:text-indigo-700">
      
      {/* Header */}
      <header className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
              <SparklesIcon className="w-5 h-5" />
            </div>
            <span className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
              NanoSnap
            </span>
            <span className="hidden sm:inline-block px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 text-[10px] font-bold tracking-wide uppercase border border-yellow-200">
              Nano Banana
            </span>
          </div>
          
          <nav>
            <a 
              href="https://ai.google.dev" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors"
            >
              Gemini API Docs
            </a>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full">
        {!activeImage ? (
          <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center p-6 animate-in fade-in duration-700">
             <div className="text-center max-w-2xl mb-12 space-y-4">
               <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight">
                 Edit images with <br/>
                 <span className="text-indigo-600">natural language.</span>
               </h1>
               <p className="text-lg text-slate-600 max-w-lg mx-auto leading-relaxed">
                 Upload a photo and tell the AI what to change. Remove backgrounds, add objects, or change styles instantly using Gemini 2.5 Flash Image.
               </p>
             </div>
             
             <UploadZone onImageSelected={handleImageSelect} />
             
             <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                {['Remove background', 'Add filters', 'Clean up', 'Restyle'].map((feat, i) => (
                  <div key={i} className="px-4 py-2 bg-white rounded-full border border-slate-100 shadow-sm text-sm text-slate-500 font-medium">
                    {feat}
                  </div>
                ))}
             </div>
          </div>
        ) : (
          <div className="animate-in slide-in-from-bottom-4 duration-500">
            <Editor initialImage={activeImage} onReset={handleReset} />
          </div>
        )}
      </main>

    </div>
  );
}

export default App;