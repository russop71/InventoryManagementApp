import { useRef, useState } from 'react';
import { Camera, Check, Loader2, Upload, X } from 'lucide-react';
import { apiRequest } from '../utils/api';
import { convertQuantity } from '../utils/unitConversion';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';

interface InventoryCatalogItem {
  id: string;
  name: string;
  unit: string;
  supplier: string;
  unitCost: number;
}

export interface ScannedRecipeIngredient {
  rawText: string;
  name: string;
  quantity: number;
  unit: string;
  matchedInventoryItemId: string;
  matchedInventoryItemName: string;
  matchConfidence: number;
}

export interface ScannedRecipeData {
  menuItemName: string;
  category: string;
  price: number;
  yieldQuantity: number;
  yieldUnit: string;
  ingredients: ScannedRecipeIngredient[];
  aiUsed: boolean;
  method: string;
}

interface RecipeScanProps {
  isOpen: boolean;
  inventory: InventoryCatalogItem[];
  onClose: () => void;
  onRecipeExtracted: (recipe: ScannedRecipeData) => void;
}

const MIN_AUTO_MATCH_CONFIDENCE = 0.7;

export function RecipeScan({ isOpen, inventory, onClose, onRecipeExtracted }: RecipeScanProps) {
  const [image, setImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedData, setExtractedData] = useState<ScannedRecipeData | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const stopCamera = () => {
    stream?.getTracks().forEach(track => track.stop());
    setStream(null);
    setIsCameraActive(false);
  };

  const reset = () => {
    stopCamera();
    setImage(null);
    setIsProcessing(false);
    setExtractedData(null);
    setErrorMessage('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const close = () => {
    reset();
    onClose();
  };

  const processImage = async (imageData: string) => {
    if (inventory.length === 0) {
      setErrorMessage('Add inventory items first so AI can match and cost the recipe.');
      return;
    }

    setIsProcessing(true);
    setExtractedData(null);
    setErrorMessage('');
    try {
      const result = await apiRequest<ScannedRecipeData>('/api/scan', {
        method: 'POST',
        body: JSON.stringify({
          imageData,
          inventory: inventory.map(item => ({
            id: item.id,
            name: item.name,
            unit: item.unit,
            supplier: item.supplier,
          })),
        }),
      });
      setExtractedData(result);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Recipe scan failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  const startCamera = async () => {
    setErrorMessage('');
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
      });
      setStream(mediaStream);
      setIsCameraActive(true);
      window.setTimeout(() => {
        if (videoRef.current) videoRef.current.srcObject = mediaStream;
      }, 0);
    } catch (error) {
      console.error('Error accessing camera', error);
      setErrorMessage('Camera access was blocked. Allow camera access or upload a photo instead.');
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || videoRef.current.videoWidth === 0) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.drawImage(videoRef.current, 0, 0);
    const imageData = canvas.toDataURL('image/jpeg', 0.9);
    setImage(imageData);
    stopCamera();
    void processImage(imageData);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setErrorMessage('Upload a JPEG, PNG, or WebP recipe photo.');
      event.target.value = '';
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setErrorMessage('Use a recipe photo smaller than 4 MB.');
      event.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      const imageData = String(reader.result || '');
      setImage(imageData);
      void processImage(imageData);
    };
    reader.readAsDataURL(file);
  };

  const ingredientCost = (ingredient: ScannedRecipeIngredient) => {
    const item = inventory.find(entry => entry.id === ingredient.matchedInventoryItemId);
    if (!item || ingredient.matchConfidence < MIN_AUTO_MATCH_CONFIDENCE || ingredient.quantity <= 0) return null;
    const convertedQuantity = convertQuantity(ingredient.quantity, ingredient.unit, item.unit);
    if (convertedQuantity === null) return null;
    return convertedQuantity * item.unitCost;
  };

  const readyIngredientCount = extractedData?.ingredients.filter(ingredient => ingredientCost(ingredient) !== null).length || 0;
  const reviewIngredientCount = (extractedData?.ingredients.length || 0) - readyIngredientCount;
  const recipeCost = extractedData?.ingredients.reduce((sum, ingredient) => sum + (ingredientCost(ingredient) || 0), 0) || 0;

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && close()}>
      <DialogContent className="max-h-[88vh] max-w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>AI Recipe Scanner</DialogTitle>
          <DialogDescription>
            Photograph a handwritten or printed recipe. AI transcribes it and matches ingredients to current inventory for costing.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!image && !isCameraActive && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Button type="button" className="bg-[#0F172A] text-white hover:bg-[#1E293B]" onClick={startCamera} disabled={inventory.length === 0}>
                <Camera className="mr-2 h-4 w-4" /> Take Photo
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={inventory.length === 0}>
                <Upload className="mr-2 h-4 w-4" /> Upload Photo
              </Button>
              {inventory.length === 0 && (
                <p className="sm:col-span-2 text-sm text-amber-700">Add inventory items before scanning so every ingredient can be matched and costed.</p>
              )}
            </div>
          )}

          {isCameraActive && (
            <div className="space-y-3">
              <div className="overflow-hidden rounded-xl bg-black">
                <video ref={videoRef} autoPlay playsInline className="w-full" />
              </div>
              <div className="flex gap-2">
                <Button type="button" className="flex-1 bg-[#0F172A] text-white" onClick={capturePhoto}>
                  <Camera className="mr-2 h-4 w-4" /> Capture Recipe
                </Button>
                <Button type="button" variant="outline" onClick={stopCamera}><X className="h-4 w-4" /></Button>
              </div>
            </div>
          )}

          {image && (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
              <img src={image} alt="Recipe to scan" className="max-h-72 w-full object-contain" />
            </div>
          )}

          {isProcessing && (
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="flex items-center gap-3 py-5">
                <Loader2 className="h-6 w-6 animate-spin text-blue-700" />
                <div>
                  <p className="font-semibold text-blue-950">AI is reading the recipe</p>
                  <p className="text-sm text-blue-700">Transcribing handwriting and matching ingredients to inventory…</p>
                </div>
              </CardContent>
            </Card>
          )}

          {errorMessage && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="py-4 text-sm font-medium text-red-800">{errorMessage}</CardContent>
            </Card>
          )}

          {extractedData && (
            <form
              className="space-y-4"
              onSubmit={event => {
                event.preventDefault();
                onRecipeExtracted(extractedData);
                reset();
              }}
            >
              <Card className={reviewIngredientCount === 0 ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                  <div className="flex items-center gap-2">
                    <Check className="h-5 w-5 text-green-700" />
                    <div>
                      <p className="font-semibold">AI scan complete</p>
                      <p className="text-xs text-slate-600">{readyIngredientCount} cost-ready · {reviewIngredientCount} need review</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500">Matched ingredient cost</p>
                    <p className="text-lg font-black text-slate-950">${recipeCost.toFixed(2)}</p>
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="scanned-recipe-name">Recipe name</Label>
                  <Input id="scanned-recipe-name" value={extractedData.menuItemName} onChange={event => setExtractedData({ ...extractedData, menuItemName: event.target.value })} required />
                </div>
                <div>
                  <Label htmlFor="scanned-recipe-category">Category</Label>
                  <Input id="scanned-recipe-category" value={extractedData.category} onChange={event => setExtractedData({ ...extractedData, category: event.target.value })} required />
                </div>
                <div>
                  <Label htmlFor="scanned-recipe-yield">Yield quantity</Label>
                  <Input id="scanned-recipe-yield" type="number" min="0.01" step="0.01" value={extractedData.yieldQuantity} onChange={event => setExtractedData({ ...extractedData, yieldQuantity: Number(event.target.value) || 1 })} />
                </div>
                <div>
                  <Label htmlFor="scanned-recipe-yield-unit">Yield unit</Label>
                  <Input id="scanned-recipe-yield-unit" value={extractedData.yieldUnit} onChange={event => setExtractedData({ ...extractedData, yieldUnit: event.target.value })} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>AI ingredient matches</Label>
                {extractedData.ingredients.map((ingredient, index) => {
                  const cost = ingredientCost(ingredient);
                  const matchedItem = inventory.find(item => item.id === ingredient.matchedInventoryItemId);
                  return (
                    <div key={`${ingredient.rawText}-${index}`} className="rounded-xl border border-slate-200 bg-white p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-950">{ingredient.quantity} {ingredient.unit} {ingredient.name}</p>
                          <p className="mt-1 text-xs text-slate-500">Handwriting: {ingredient.rawText || ingredient.name}</p>
                          <p className="mt-1 text-xs text-slate-600">
                            {matchedItem ? `Inventory: ${matchedItem.name} · ${matchedItem.supplier}` : 'No inventory match'}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <Badge className={cost === null ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}>
                            {cost === null ? 'Review' : `${Math.round(ingredient.matchConfidence * 100)}% match`}
                          </Badge>
                          <p className="mt-2 text-sm font-bold text-slate-950">{cost === null ? 'Not costed' : `$${cost.toFixed(2)}`}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {reviewIngredientCount > 0 && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Items marked Review will not be silently costed. Continue to open the recipe editor and confirm their inventory item, quantity, or unit.
                </p>
              )}

              <div className="flex gap-2">
                <Button type="button" variant="outline" className="flex-1" onClick={close}>Cancel</Button>
                <Button type="submit" className="flex-1 bg-[#0F172A] text-white hover:bg-[#1E293B]">Review Recipe</Button>
              </div>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
