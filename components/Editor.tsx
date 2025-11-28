import React, { useState, useRef, useEffect } from 'react';
import { ImageFile, EditorStatus, GeneratedImage } from '../types';
import { 
  WandIcon, DownloadIcon, LoaderIcon, RefreshCwIcon, ArrowRightIcon, 
  SparklesIcon, SunIcon, LayersIcon, ScanIcon, EyeIcon, CropIcon,
  UndoIcon, RedoIcon, MaximizeIcon
} from './Icons';
import { editImageWithGemini } from '../services/geminiService';
import { downloadImage } from '../utils/imageUtils';

interface EditorProps {
  initialImage: ImageFile;
  onReset: () => void;
}

type EditorTab = 'refine' | 'lighting' | 'background' | 'crop' | 'upscale';

const LIGHTING_PRESETS = [
  { label: 'Soft Studio', prompt: 'Apply soft, diffuse studio lighting to the product, removing harsh shadows.' },
  { label: 'Natural Sunlight', prompt: 'Simulate bright, natural sunlight coming from the side with soft shadows.' },
  { label: 'Golden Hour', prompt: 'Apply warm, golden hour lighting to the scene.' },
  { label: 'Cyber Neon', prompt: 'Apply cool blue and magenta neon lighting effects.' },
  { label: 'Product Fix', prompt: 'Fix under and overexposed areas, balance the lighting evenly, and enhance details.' },
];

const BACKGROUND_PRESETS = [
  { label: 'Pure White', prompt: 'Change the background to a clean, pure white studio backdrop.' },
  { label: 'Luxury Marble', prompt: 'Place the product on a luxury marble countertop with a blurred background.' },
  { label: 'Wooden Table', prompt: 'Place the object on a rustic wooden table.' },
  { label: 'Lifestyle Living Room', prompt: 'Place the object in a cozy, modern living room setting with bokeh.' },
  { label: 'Nature', prompt: 'Place the object in a peaceful outdoor nature scene with greenery.' },
];

export const Editor: React.FC<EditorProps> = ({ initialImage, onReset }) => {
  // History Management
  const [history, setHistory] = useState<ImageFile[]>([initialImage]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [currentImage, setCurrentImage] = useState<ImageFile>(initialImage);

  const [generatedImage, setGeneratedImage] = useState<GeneratedImage | null>(null);
  const [status, setStatus] = useState<EditorStatus>(EditorStatus.READY);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // UI State
  const [activeTab, setActiveTab] = useState<EditorTab>('refine');
  const [customPrompt, setCustomPrompt] = useState('');
  
  // Refine Tool State
  const [targetObject, setTargetObject] = useState('');
  const [editAction, setEditAction] = useState('');

  // Crop Tool State
  const imageRef = useRef<HTMLImageElement>(null);
  const [cropStart, setCropStart] = useState<{ x: number, y: number } | null>(null);
  const [cropEnd, setCropEnd] = useState<{ x: number, y: number } | null>(null);
  const [isDraggingCrop, setIsDraggingCrop] = useState(false);

  // History Helper Functions
  const addToHistory = (newImage: ImageFile) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newImage);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setCurrentImage(newImage);
  };

  const undo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setCurrentImage(history[newIndex]);
      setGeneratedImage(null); // Clear preview when moving through history
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setCurrentImage(history[newIndex]);
      setGeneratedImage(null);
    }
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Undo: Ctrl+Z
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      // Redo: Ctrl+Shift+Z or Ctrl+Y
      if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [historyIndex, history]);

  const handleGenerate = async (
    finalPrompt: string, 
    isMaskRequest: boolean = false, 
    config: { model?: string, imageSize?: '1K' | '2K' | '4K' } = {}
  ) => {
    if (!finalPrompt.trim()) return;

    setStatus(EditorStatus.PROCESSING);
    setErrorMessage(null);

    try {
      const result = await editImageWithGemini(
        currentImage.base64,
        currentImage.mimeType,
        finalPrompt,
        config
      );

      if (result.imageUrl) {
        setGeneratedImage({
          imageUrl: result.imageUrl,
          prompt: finalPrompt,
          timestamp: Date.now()
        });
        setStatus(EditorStatus.COMPLETE);
      } else {
        throw new Error("The model did not return an image.");
      }
    } catch (error: any) {
      console.error('Generation failed:', error);
      setErrorMessage(error.message || "Failed to generate image.");
      setStatus(EditorStatus.ERROR);
    }
  };

  const handleDownload = () => {
    if (generatedImage) {
      downloadImage(generatedImage.imageUrl, `nanosnap-edit-${Date.now()}.png`);
    }
  };

  const handleUseAsSource = () => {
    if (generatedImage) {
      const mimeMatch = generatedImage.imageUrl.match(/data:([^;]+);/);
      const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
      
      const newImage: ImageFile = {
        ...currentImage,
        base64: generatedImage.imageUrl,
        previewUrl: generatedImage.imageUrl,
        mimeType: mimeType
      };
      
      addToHistory(newImage);
      setGeneratedImage(null);
      setTargetObject('');
      setEditAction('');
      setStatus(EditorStatus.READY);
    }
  };

  // Tool Handlers
  const handleRefineSubmit = () => {
    if (!targetObject || !editAction) return;
    const prompt = `Select the ${targetObject} and ${editAction}.`;
    handleGenerate(prompt);
  };

  const handleVisualizeSelection = () => {
    if (!targetObject) return;
    const prompt = `Highlight the ${targetObject} with a bright lime green overlay mask. Keep the rest of the image unchanged.`;
    handleGenerate(prompt, true);
  };

  const handlePresetClick = (presetPrompt: string) => {
    handleGenerate(presetPrompt);
  };

  const handleUpscale = async (size: '2K' | '4K') => {
    // Check for API key presence if needed
    if ((window as any).aistudio) {
        try {
           const hasKey = await (window as any).aistudio.hasSelectedApiKey();
           if (!hasKey) {
               await (window as any).aistudio.openSelectKey();
           }
        } catch (e) {
           console.error("API Key check failed", e);
        }
    }

    const prompt = "High resolution, highly detailed version of this image. Preserve all details and content exactly.";
    handleGenerate(prompt, false, { model: 'gemini-3-pro-image-preview', imageSize: size });
  };

  // Crop Handlers
  const handleCropMouseDown = (e: React.MouseEvent<HTMLImageElement>) => {
    if (activeTab !== 'crop') return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setCropStart({ x, y });
    setCropEnd({ x, y });
    setIsDraggingCrop(true);
  };

  const handleCropMouseMove = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!isDraggingCrop || !cropStart || activeTab !== 'crop') return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const y = Math.max(0, Math.min(e.clientY - rect.top, rect.height));
    setCropEnd({ x, y });
  };

  const handleCropMouseUp = () => {
    setIsDraggingCrop(false);
  };

  const applyCrop = () => {
    if (!imageRef.current || !cropStart || !cropEnd) return;

    const img = imageRef.current;
    const rect = img.getBoundingClientRect();
    
    // Calculate scaling factor between displayed image and natural image
    const scaleX = img.naturalWidth / rect.width;
    const scaleY = img.naturalHeight / rect.height;

    const startX = Math.min(cropStart.x, cropEnd.x);
    const startY = Math.min(cropStart.y, cropEnd.y);
    const width = Math.abs(cropEnd.x - cropStart.x);
    const height = Math.abs(cropEnd.y - cropStart.y);

    if (width < 10 || height < 10) return; // Ignore tiny crops

    const canvas = document.createElement('canvas');
    canvas.width = width * scaleX;
    canvas.height = height * scaleY;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      ctx.drawImage(
        img,
        startX * scaleX,
        startY * scaleY,
        width * scaleX,
        height * scaleY,
        0,
        0,
        canvas.width,
        canvas.height
      );

      const croppedBase64 = canvas.toDataURL(currentImage.mimeType);
      
      const newImage: ImageFile = {
        ...currentImage,
        base64: croppedBase64,
        previewUrl: croppedBase64,
      };

      addToHistory(newImage);
      
      // Reset crop state
      setCropStart(null);
      setCropEnd(null);
      setGeneratedImage(null); // Clear any generated results as they don't match the new crop
    }
  };

  const resetCrop = () => {
    setCropStart(null);
    setCropEnd(null);
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-4 md:p-6 gap-6 grid grid-cols-1 lg:grid-cols-12 min-h-[600px]">
      
      {/* LEFT COLUMN: Controls */}
      <div className="lg:col-span-4 flex flex-col gap-6 order-2 lg:order-1">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full">
          
          {/* Tabs Header */}
          <div className="grid grid-cols-5 border-b border-slate-100">
            <button
              onClick={() => setActiveTab('refine')}
              className={`py-3 text-[10px] sm:text-xs font-semibold flex flex-col items-center gap-1 transition-colors ${activeTab === 'refine' ? 'text-indigo-600 bg-indigo-50/50 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
            >
              <ScanIcon className="w-4 h-4" />
              Refine
            </button>
            <button
              onClick={() => setActiveTab('lighting')}
              className={`py-3 text-[10px] sm:text-xs font-semibold flex flex-col items-center gap-1 transition-colors ${activeTab === 'lighting' ? 'text-indigo-600 bg-indigo-50/50 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
            >
              <SunIcon className="w-4 h-4" />
              Light
            </button>
            <button
              onClick={() => setActiveTab('background')}
              className={`py-3 text-[10px] sm:text-xs font-semibold flex flex-col items-center gap-1 transition-colors ${activeTab === 'background' ? 'text-indigo-600 bg-indigo-50/50 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
            >
              <LayersIcon className="w-4 h-4" />
              Back
            </button>
            <button
              onClick={() => setActiveTab('crop')}
              className={`py-3 text-[10px] sm:text-xs font-semibold flex flex-col items-center gap-1 transition-colors ${activeTab === 'crop' ? 'text-indigo-600 bg-indigo-50/50 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
            >
              <CropIcon className="w-4 h-4" />
              Crop
            </button>
            <button
              onClick={() => setActiveTab('upscale')}
              className={`py-3 text-[10px] sm:text-xs font-semibold flex flex-col items-center gap-1 transition-colors ${activeTab === 'upscale' ? 'text-indigo-600 bg-indigo-50/50 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
            >
              <MaximizeIcon className="w-4 h-4" />
              Scale
            </button>
          </div>

          {/* Tab Content */}
          <div className="p-6 flex-1 overflow-y-auto">
            
            {/* REFINE TAB */}
            {activeTab === 'refine' && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="space-y-2">
                  <h3 className="font-semibold text-slate-800">Targeted Selection</h3>
                  <p className="text-xs text-slate-500">Identify an object and describe how to change it.</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Select Object</label>
                    <input 
                      type="text" 
                      value={targetObject}
                      onChange={(e) => setTargetObject(e.target.value)}
                      placeholder="e.g., the coffee mug, the shoes"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Action</label>
                    <textarea 
                      value={editAction}
                      onChange={(e) => setEditAction(e.target.value)}
                      placeholder="e.g., remove the shadow, change color to red, make it metallic"
                      rows={3}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-sm resize-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button 
                    onClick={handleVisualizeSelection}
                    disabled={!targetObject || status === EditorStatus.PROCESSING}
                    className="flex items-center justify-center px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50 hover:border-slate-300 transition-all disabled:opacity-50"
                  >
                    <EyeIcon className="w-4 h-4 mr-2" />
                    Preview Mask
                  </button>
                  <button 
                    onClick={handleRefineSubmit}
                    disabled={!targetObject || !editAction || status === EditorStatus.PROCESSING}
                    className="flex items-center justify-center px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 shadow-md hover:shadow-indigo-200 transition-all disabled:opacity-50"
                  >
                    <WandIcon className="w-4 h-4 mr-2" />
                    Apply Edit
                  </button>
                </div>

                <div className="pt-4 border-t border-slate-100">
                  <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">Or type a custom prompt</h4>
                  <div className="relative">
                    <input
                      type="text"
                      value={customPrompt}
                      onChange={(e) => setCustomPrompt(e.target.value)}
                      placeholder="Describe any change..."
                      className="w-full pl-4 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500"
                      onKeyDown={(e) => e.key === 'Enter' && handleGenerate(customPrompt)}
                    />
                    <button
                      onClick={() => handleGenerate(customPrompt)}
                      disabled={!customPrompt.trim()}
                      className="absolute right-2 top-2 bottom-2 p-1.5 bg-white text-indigo-600 rounded-lg shadow-sm hover:bg-indigo-50 disabled:opacity-50"
                    >
                      <ArrowRightIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* LIGHTING TAB */}
            {activeTab === 'lighting' && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="space-y-2">
                  <h3 className="font-semibold text-slate-800">Smart Lighting</h3>
                  <p className="text-xs text-slate-500">Simulate studio conditions and fix exposure.</p>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {LIGHTING_PRESETS.map((preset, i) => (
                    <button
                      key={i}
                      onClick={() => handlePresetClick(preset.prompt)}
                      disabled={status === EditorStatus.PROCESSING}
                      className="group flex items-center p-3 text-left bg-white border border-slate-200 rounded-xl hover:border-indigo-400 hover:shadow-md transition-all"
                    >
                      <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                        <SunIcon className="w-5 h-5" />
                      </div>
                      <div className="ml-3">
                        <span className="block text-sm font-medium text-slate-700 group-hover:text-indigo-900">{preset.label}</span>
                      </div>
                    </button>
                  ))}
                </div>
                
                <div className="mt-4">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Custom Lighting Prompt</label>
                    <textarea 
                      value={customPrompt}
                      onChange={(e) => setCustomPrompt(e.target.value)}
                      placeholder="e.g. Add blue rim lighting from the left..."
                      rows={2}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-sm resize-none"
                    />
                    <button 
                      onClick={() => handleGenerate(customPrompt)}
                      disabled={!customPrompt.trim()}
                      className="w-full mt-2 py-2 bg-indigo-100 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-200"
                    >
                      Apply Custom Lighting
                    </button>
                </div>
              </div>
            )}

            {/* BACKGROUND TAB */}
            {activeTab === 'background' && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="space-y-2">
                  <h3 className="font-semibold text-slate-800">Background Gen</h3>
                  <p className="text-xs text-slate-500">Teleport your object to a new scene.</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {BACKGROUND_PRESETS.map((preset, i) => (
                    <button
                      key={i}
                      onClick={() => handlePresetClick(preset.prompt)}
                      disabled={status === EditorStatus.PROCESSING}
                      className="flex flex-col items-center justify-center p-4 text-center bg-white border border-slate-200 rounded-xl hover:border-indigo-400 hover:bg-indigo-50 transition-all aspect-[4/3]"
                    >
                      <span className="text-sm font-medium text-slate-700">{preset.label}</span>
                    </button>
                  ))}
                </div>

                <div className="pt-4 border-t border-slate-100">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Custom Background</label>
                  <textarea 
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder="e.g. On a sandy beach at sunset..."
                    rows={2}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-sm resize-none"
                  />
                  <button 
                    onClick={() => handleGenerate(customPrompt)}
                    disabled={!customPrompt.trim()}
                    className="w-full mt-2 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
                  >
                    Generate Background
                  </button>
                </div>
              </div>
            )}

            {/* CROP TAB */}
            {activeTab === 'crop' && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="space-y-2">
                  <h3 className="font-semibold text-slate-800">Image Crop</h3>
                  <p className="text-xs text-slate-500">Drag on the image to select the area to crop.</p>
                </div>
                
                <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100 text-indigo-700 text-sm">
                  <p className="flex items-center">
                    <CropIcon className="w-4 h-4 mr-2" />
                    <strong>How to crop:</strong>
                  </p>
                  <ul className="list-disc list-inside mt-2 text-xs opacity-90 space-y-1">
                    <li>Click and drag on the image area on the right.</li>
                    <li>Adjust until you are happy with the selection.</li>
                    <li>Click 'Apply Crop' below.</li>
                  </ul>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={resetCrop}
                    disabled={!cropStart}
                    className="py-2.5 px-4 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50 transition-all"
                  >
                    Clear Selection
                  </button>
                  <button 
                    onClick={applyCrop}
                    disabled={!cropStart}
                    className="py-2.5 px-4 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 shadow-md transition-all disabled:opacity-50"
                  >
                    Apply Crop
                  </button>
                </div>
              </div>
            )}

            {/* UPSCALE TAB */}
            {activeTab === 'upscale' && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="space-y-2">
                  <h3 className="font-semibold text-slate-800">AI Upscaler</h3>
                  <p className="text-xs text-slate-500">Enhance resolution and details up to 4K.</p>
                </div>

                <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100 text-indigo-700 text-sm">
                  <p className="flex items-center font-medium mb-1">
                    <SparklesIcon className="w-4 h-4 mr-2" />
                    Pro Feature
                  </p>
                  <p className="text-xs opacity-90 leading-relaxed">
                    Upscaling uses the <strong>Gemini 3 Pro</strong> model. You may need to connect a paid API key to use high-resolution generation.
                  </p>
                </div>

                <div className="space-y-3">
                  <button 
                    onClick={() => handleUpscale('2K')}
                    disabled={status === EditorStatus.PROCESSING}
                    className="w-full flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl hover:border-indigo-400 hover:shadow-md transition-all group text-left"
                  >
                     <div>
                       <span className="block text-sm font-bold text-slate-700 group-hover:text-indigo-700">Upscale to 2K</span>
                       <span className="text-xs text-slate-400">2048 x 2048 resolution</span>
                     </div>
                     <MaximizeIcon className="w-5 h-5 text-slate-300 group-hover:text-indigo-500" />
                  </button>

                  <button 
                    onClick={() => handleUpscale('4K')}
                    disabled={status === EditorStatus.PROCESSING}
                    className="w-full flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl hover:border-indigo-400 hover:shadow-md transition-all group text-left"
                  >
                     <div>
                       <span className="block text-sm font-bold text-slate-700 group-hover:text-indigo-700">Upscale to 4K</span>
                       <span className="text-xs text-slate-400">4096 x 4096 resolution</span>
                     </div>
                     <div className="flex items-center text-xs font-bold px-2 py-1 bg-indigo-100 text-indigo-700 rounded ml-2">
                        PRO
                     </div>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Workspace */}
      <div className="lg:col-span-8 flex flex-col gap-6 order-1 lg:order-2">
        
        {/* Top Actions */}
        <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2">
            <button 
              onClick={onReset}
              className="flex items-center px-3 py-2 text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-lg transition-colors text-sm font-medium"
            >
              <ArrowRightIcon className="w-4 h-4 mr-2 rotate-180" />
              New Image
            </button>
            <div className="h-6 w-px bg-slate-200 mx-1" />
            <button
              onClick={undo}
              disabled={historyIndex === 0}
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-lg transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
              title="Undo (Ctrl+Z)"
            >
              <UndoIcon className="w-5 h-5" />
            </button>
            <button
              onClick={redo}
              disabled={historyIndex === history.length - 1}
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-lg transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
              title="Redo (Ctrl+Y)"
            >
              <RedoIcon className="w-5 h-5" />
            </button>
          </div>
          
          <div className="flex gap-2">
             {generatedImage && activeTab !== 'crop' && (
                <button
                  onClick={handleUseAsSource}
                  className="flex items-center px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors text-sm font-medium border border-slate-200"
                >
                  <RefreshCwIcon className="w-4 h-4 mr-2" />
                  Keep & Continue
                </button>
             )}
             {generatedImage && activeTab !== 'crop' && (
                <button
                  onClick={handleDownload}
                  className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm text-sm font-medium"
                >
                  <DownloadIcon className="w-4 h-4 mr-2" />
                  Download
                </button>
             )}
          </div>
        </div>

        {/* Canvas Area */}
        <div 
          className="flex-1 min-h-[500px] bg-slate-100/50 rounded-2xl border border-slate-200/60 p-4 md:p-8 flex items-center justify-center relative overflow-hidden select-none"
          onMouseUp={handleCropMouseUp}
          onMouseLeave={handleCropMouseUp}
        >
          {/* Background Grid Pattern */}
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#4f46e5 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>

          {activeTab === 'crop' ? (
            /* CROP MODE VIEW */
            <div className="relative flex items-center justify-center w-full h-full max-w-full max-h-full">
              <div className="relative inline-flex items-center justify-center shadow-lg shadow-black/5">
                <img 
                  ref={imageRef}
                  src={currentImage.previewUrl} 
                  alt="Source for cropping" 
                  className="w-auto h-auto max-w-full max-h-[70vh] object-contain cursor-crosshair select-none"
                  draggable={false}
                  onMouseDown={handleCropMouseDown}
                  onMouseMove={handleCropMouseMove}
                />
                
                {/* Crop Selection Overlay */}
                {cropStart && cropEnd && (
                  <div 
                    className="absolute border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] pointer-events-none"
                    style={{
                      left: Math.min(cropStart.x, cropEnd.x),
                      top: Math.min(cropStart.y, cropEnd.y),
                      width: Math.abs(cropEnd.x - cropStart.x),
                      height: Math.abs(cropEnd.y - cropStart.y),
                    }}
                  >
                    {/* Corner handles (visual only) */}
                    <div className="absolute -top-1 -left-1 w-2 h-2 bg-indigo-500 border border-white"></div>
                    <div className="absolute -top-1 -right-1 w-2 h-2 bg-indigo-500 border border-white"></div>
                    <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-indigo-500 border border-white"></div>
                    <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-indigo-500 border border-white"></div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* STANDARD VIEW */
            <div className="flex flex-col md:flex-row gap-8 w-full h-full items-center justify-center relative z-10">
              
              {/* Original Image */}
              <div className={`relative transition-all duration-500 ${generatedImage ? 'w-full md:w-1/2 h-[300px] md:h-full' : 'w-full h-full max-w-2xl'}`}>
                 <div className="absolute -top-8 left-0 text-xs font-bold text-slate-400 uppercase tracking-wider">Source</div>
                 <div className="w-full h-full bg-white rounded-xl shadow-sm border border-slate-200 p-2 overflow-hidden flex items-center justify-center">
                   <img 
                      src={currentImage.previewUrl} 
                      alt="Original" 
                      className="max-w-full max-h-full object-contain"
                    />
                 </div>
              </div>

              {/* Generated Image Overlay/Side-by-side */}
              {generatedImage || status === EditorStatus.PROCESSING || status === EditorStatus.ERROR ? (
                 <div className="w-full md:w-1/2 h-[300px] md:h-full relative animate-in slide-in-from-right-4 duration-500">
                    <div className="absolute -top-8 left-0 text-xs font-bold text-indigo-500 uppercase tracking-wider">
                      {status === EditorStatus.PROCESSING ? 'Processing...' : 'Result'}
                    </div>
                    
                    <div className="w-full h-full bg-white rounded-xl shadow-lg shadow-indigo-100 border border-indigo-100 p-2 overflow-hidden flex items-center justify-center relative">
                      {status === EditorStatus.PROCESSING && (
                        <div className="absolute inset-0 bg-white/90 backdrop-blur-[2px] z-20 flex flex-col items-center justify-center text-indigo-600">
                          <LoaderIcon className="w-12 h-12 animate-spin mb-4" />
                          <p className="text-sm font-medium animate-pulse">Gemini is thinking...</p>
                        </div>
                      )}
                      
                      {generatedImage && (
                        <img 
                          src={generatedImage.imageUrl} 
                          alt="Generated" 
                          className="max-w-full max-h-full object-contain"
                        />
                      )}

                      {status === EditorStatus.ERROR && (
                        <div className="text-center p-6">
                          <p className="text-red-500 text-sm font-medium">{errorMessage}</p>
                        </div>
                      )}
                    </div>
                 </div>
              ) : (
                <div className="hidden md:flex items-center justify-center w-12 text-slate-300">
                  <ArrowRightIcon className="w-8 h-8" />
                </div>
              )}

            </div>
          )}
        </div>
        
        <div className="text-center">
           <p className="text-xs text-slate-400">Powered by Gemini 2.5 Flash Image & Gemini 3 Pro</p>
        </div>

      </div>
    </div>
  );
};