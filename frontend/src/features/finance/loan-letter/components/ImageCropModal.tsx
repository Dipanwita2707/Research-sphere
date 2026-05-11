'use client';

import { useState, useCallback } from 'react';
import Cropper, { Area } from 'react-easy-crop';
import { X, Crop, RotateCcw, ZoomIn, ZoomOut, Check } from 'lucide-react';

interface Props {
  imageUrl: string;
  /** 'header' (16:9-ish landscape) or 'watermark' (square / free) */
  type: 'header' | 'watermark';
  onConfirm: (croppedBlob: Blob) => void;
  onCancel: () => void;
}

/** Create the final cropped blob from original image + crop area */
async function getCroppedBlob(
  imageSrc: string,
  pixelCrop: Area,
  rotation: number,
  mimeType: string = 'image/png',
): Promise<Blob> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = imageSrc;
  });

  const radians = (rotation * Math.PI) / 180;
  const sin = Math.abs(Math.sin(radians));
  const cos = Math.abs(Math.cos(radians));
  const boundWidth = Math.ceil(image.width * cos + image.height * sin);
  const boundHeight = Math.ceil(image.width * sin + image.height * cos);

  const rotatedCanvas = document.createElement('canvas');
  rotatedCanvas.width = boundWidth;
  rotatedCanvas.height = boundHeight;
  const rotatedCtx = rotatedCanvas.getContext('2d');
  if (!rotatedCtx) {
    throw new Error('Canvas context unavailable');
  }

  rotatedCtx.translate(boundWidth / 2, boundHeight / 2);
  rotatedCtx.rotate(radians);
  rotatedCtx.drawImage(image, -image.width / 2, -image.height / 2);

  const canvas = document.createElement('canvas');
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas context unavailable');
  }

  ctx.drawImage(
    rotatedCanvas,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height,
  );

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Canvas toBlob failed')), mimeType, 0.92);
  });
}

export default function ImageCropModal({ imageUrl, type, onConfirm, onCancel }: Props) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [processing, setProcessing] = useState(false);

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  async function handleConfirm() {
    if (!croppedAreaPixels) return;
    setProcessing(true);
    try {
      const blob = await getCroppedBlob(imageUrl, croppedAreaPixels, rotation);
      onConfirm(blob);
    } catch (err) {
      console.error('Crop failed', err);
    } finally {
      setProcessing(false);
    }
  }

  const aspect = type === 'header' ? undefined : 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <Crop className="w-4 h-4 text-primary-600" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Crop {type === 'header' ? 'Header' : 'Watermark'} Image
            </h3>
          </div>
          <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Crop Area */}
        <div className="relative bg-gray-900" style={{ height: 380 }}>
          <Cropper
            image={imageUrl}
            crop={crop}
            zoom={zoom}
            minZoom={0.1}
            maxZoom={3}
            rotation={rotation}
            aspect={aspect}
            restrictPosition={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        {/* Controls */}
        <div className="px-5 py-4 border-t border-gray-100 dark:border-slate-800 space-y-3">
          {/* Zoom */}
          <div className="flex items-center gap-3">
            <ZoomOut className="w-4 h-4 text-gray-400 shrink-0" />
            <input
              type="range" min={0.1} max={3} step={0.05}
              value={zoom}
              onChange={e => setZoom(Number(e.target.value))}
              className="flex-1 accent-primary-600"
            />
            <ZoomIn className="w-4 h-4 text-gray-400 shrink-0" />
            <span className="text-xs text-gray-400 w-10 text-right">{zoom.toFixed(2)}x</span>
          </div>

          {/* Rotation */}
          <div className="flex items-center gap-3">
            <RotateCcw className="w-4 h-4 text-gray-400 shrink-0" />
            <input
              type="range" min={-180} max={180} step={1}
              value={rotation}
              onChange={e => setRotation(Number(e.target.value))}
              className="flex-1 accent-purple-500"
            />
            <button onClick={() => setRotation(0)} className="text-xs text-gray-400 hover:text-gray-600 px-1.5 py-0.5 border border-gray-200 rounded">0°</button>
            <span className="text-xs text-gray-400 w-10 text-right">{rotation}°</span>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button onClick={onCancel} className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 text-gray-600">
              Cancel
            </button>
            <button onClick={handleConfirm} disabled={processing}
              className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-medium disabled:opacity-60">
              {processing
                ? <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                : <Check className="w-4 h-4" />}
              {processing ? 'Cropping…' : 'Apply Crop'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
