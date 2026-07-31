import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Camera, Upload, X, Loader2, Check, Sparkles } from 'lucide-react';
import { Card, CardContent } from './ui/card';
import Tesseract from 'tesseract.js';
import { apiRequest } from '../utils/api';

interface RecipeScanProps {
  isOpen: boolean;
  onClose: () => void;
  onRecipeExtracted: (recipe: {
    menuItemName: string;
    category: string;
    price: number;
    ingredients: string[];
  }) => void;
}

export function RecipeScan({ isOpen, onClose, onRecipeExtracted }: RecipeScanProps) {
  const [image, setImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [extractedData, setExtractedData] = useState<{
    menuItemName: string;
    category: string;
    price: string;
    ingredients: string[];
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [aiStatus, setAiStatus] = useState<{ used: boolean; method: string } | null>(null);

  const normalizeIngredient = (ingredient: unknown): string | null => {
    if (typeof ingredient === 'string') {
      const value = ingredient.trim();
      return value.length > 0 ? value : null;
    }

    if (ingredient && typeof ingredient === 'object') {
      const record = ingredient as Record<string, unknown>;
      const name = typeof record.name === 'string' ? record.name.trim() : '';
      const quantity = record.quantity == null ? '' : String(record.quantity).trim();
      const unit = typeof record.unit === 'string' ? record.unit.trim() : '';
      const combined = [quantity, unit, name].filter(Boolean).join(' ').trim();
      return combined.length > 0 ? combined : null;
    }

    return null;
  };

  const normalizeIngredients = (ingredients: unknown): string[] => {
    if (!Array.isArray(ingredients)) return [];
    return ingredients
      .map(normalizeIngredient)
      .filter((value): value is string => Boolean(value));
  };

  const parseScanResponse = (json: any) => {
    const payload = json?.recipe || json?.data?.recipe || json?.data || json;
    const priceSource = payload?.price ?? payload?.price_usd ?? payload?.priceUsd ?? '0.00';
    const parsedPrice = Number.parseFloat(String(priceSource).replace(/[^\d.]/g, ''));

    return {
      menuItemName: payload?.menuItemName || payload?.menu_item_name || payload?.name || 'Scanned Recipe',
      category: payload?.category || 'Uncategorized',
      price: Number.isFinite(parsedPrice) ? parsedPrice.toFixed(2) : '0.00',
      ingredients: normalizeIngredients(payload?.ingredients),
    };
  };

  const fallbackParseFromText = (text: string) => {
    const noisePatterns = [
      /chrome|bookmarks|profiles|tab|window|help/i,
      /docs\.google\.com|drive\.google\.com|gmail\.com/i,
      /ask gemini|share|zoom|normal text|arial/i,
      /^https?:\/\//i,
    ];

    const instructionHeaderPattern = /^(method|instructions?|procedure|steps?|directions?|prep|preparation)\b/i;
    const ingredientHintPattern = /\b(garlic|onion|shallot|tomato|pepper|salt|sugar|oil|vinegar|lemon|lime|mustard|honey|butter|milk|cream|cheese|parsley|basil|oregano|thyme|cilantro|chicken|beef|pork|fish|shrimp|rice|flour|water|stock|broth|egg|eggs|carrot|celery|potato|anchovy|chili|chilli)\b/i;
    const measurePattern = /\b(oz|lb|lbs|g|gr|kg|cup|cups|tsp|tbsp|ml|l|clove|cloves|slice|slices|pinch|dash|gram|grams|can|cans|bunch)\b/i;
    const likelyInstructionVerbPattern = /^(mix|stir|whisk|combine|cook|bake|boil|simmer|saute|sauté|add|heat|pour|serve|garnish|preheat|blend|fold|season|drizzle)\b/i;

    const rawLines = text
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean);

    const lines = rawLines
      .map(line => line.replace(/\s+/g, ' ').trim())
      .filter(line => !noisePatterns.some(pattern => pattern.test(line)));

    const cleanLine = (line: string) => line
      .replace(/[|]/g, '')
      .replace(/^[-*\u2022\d.)\s]+/, '')
      .replace(/\s+/g, ' ')
      .trim();

    const isLikelyInstruction = (line: string) => {
      const normalized = cleanLine(line);
      if (instructionHeaderPattern.test(normalized)) return true;
      if (likelyInstructionVerbPattern.test(normalized) && normalized.split(' ').length >= 4) return true;
      return false;
    };

    const ingredientScore = (line: string) => {
      const normalized = cleanLine(line);
      if (!normalized || normalized.length < 2) return -10;
      if (/^name\b|^category\b|^price\b|^ingredients?\b/i.test(normalized)) return -10;
      if (isLikelyInstruction(normalized)) return -6;

      let score = 0;
      if (/^\d/.test(normalized)) score += 2;
      if (measurePattern.test(normalized)) score += 2;
      if (ingredientHintPattern.test(normalized)) score += 2;

      const wordCount = normalized.split(' ').length;
      if (wordCount >= 1 && wordCount <= 6) score += 1;
      if (wordCount > 10) score -= 2;
      if (/[.!?]/.test(normalized) && wordCount > 6) score -= 2;

      return score;
    };

    const findLabeledValue = (label: string) => {
      const regex = new RegExp(`^${label}\\s*[:\\-]\\s*(.+)$`, 'i');
      const hit = lines.find(line => regex.test(line));
      if (!hit) return '';
      return cleanLine(hit.replace(regex, '$1'));
    };

    const categoryLabel = findLabeledValue('category');
    const nameLabel = findLabeledValue('name') || findLabeledValue('recipe') || findLabeledValue('item');
    const priceLabel = findLabeledValue('price');

    const ingredientHeaderIndex = lines.findIndex(line => /^ingredients?\b\s*[:\-]?/i.test(line));
    const ingredientTail = ingredientHeaderIndex >= 0
      ? cleanLine(lines[ingredientHeaderIndex].replace(/^ingredients?\b\s*[:\-]?/i, ''))
      : '';

    const explicitIngredientLines = ingredientHeaderIndex >= 0
      ? lines
          .slice(ingredientHeaderIndex + 1)
          .map(cleanLine)
          .filter(line => line.length > 1)
          .filter(line => !instructionHeaderPattern.test(line))
      : [];

    const ingredientSearchPool = ingredientHeaderIndex >= 0
      ? explicitIngredientLines
      : lines.map(cleanLine);

    const ingredientCandidates = ingredientSearchPool
      .filter(line => ingredientScore(line) >= 2)
      .map(line => line.replace(/^[-*]\s*/, '').trim());

    const mergedIngredients = [
      ...(ingredientTail ? [ingredientTail] : []),
      ...ingredientCandidates,
    ];

    const dedupedIngredients: string[] = [];
    const seen = new Set<string>();
    for (const line of mergedIngredients) {
      const normalized = cleanLine(line);
      const key = normalized.toLowerCase();
      if (!normalized || seen.has(key)) continue;
      seen.add(key);
      dedupedIngredients.push(normalized);
    }

    const ingredients = dedupedIngredients
      .filter(line => line.length > 1)
      .slice(0, 30);

    const firstCleanContentLine = lines
      .map(cleanLine)
      .find(line => {
        if (line.length < 3) return false;
        if (/^ingredients?\b|^category\b|^price\b/i.test(line)) return false;
        if (/\$?\d+(?:\.\d{1,2})?/.test(line) && line.split(' ').length <= 3) return false;
        if (measurePattern.test(line)) return false;
        if (isLikelyInstruction(line)) return false;
        return line.split(' ').length <= 8;
      });

    const menuItemName = nameLabel || firstCleanContentLine || 'Scanned Recipe';

    const priceSource = priceLabel || lines.slice(0, 8).find(line => /\$?\d+(?:\.\d{1,2})?/.test(line)) || '';
    const price = priceSource ? (priceSource.match(/\$?(\d+(?:\.\d{1,2})?)/)?.[1] || '0.00') : '0.00';

    return {
      menuItemName,
      category: categoryLabel || 'Uncategorized',
      price,
      ingredients,
    };
  };

  const runBrowserOcr = async (imageData: string) => {
    const result = await Tesseract.recognize(imageData, 'eng', {
      logger: () => {},
    });
    return fallbackParseFromText(result.data.text || '');
  };

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setStream(mediaStream);
      setIsCameraActive(true);
    } catch (error) {
      console.error('Error accessing camera:', error);
      alert('Unable to access camera. Please upload an image instead.');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;

    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0);
      const imageData = canvas.toDataURL('image/jpeg');
      setImage(imageData);
      stopCamera();
      processImage(imageData);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const imageData = reader.result as string;
        setImage(imageData);
        processImage(imageData);
      };
      reader.readAsDataURL(file);
    }
  };

  const processImage = async (imageData: string) => {
    setIsProcessing(true);
    setIsComplete(false);
    setExtractedData(null);
    setAiStatus(null);

    const applyExtractedData = (parsed: { menuItemName: string; category: string; price: string; ingredients: string[] }) => {
      setExtractedData(parsed);
      setIsComplete(true);
    };

    try {
      try {
        const json = await apiRequest<any>('/api/scan', {
          method: 'POST',
          body: JSON.stringify({ imageData }),
        });
        applyExtractedData(parseScanResponse(json));
        const payload = json?.recipe || json?.data?.recipe || json?.data || json;
        if (typeof payload?.aiUsed === 'boolean') {
          setAiStatus({ used: Boolean(payload.aiUsed), method: payload.method || (payload.aiUsed ? 'openai' : 'heuristic') });
        }
      } catch (apiError) {
        console.warn('Backend scan unavailable, using browser OCR fallback', apiError);
        const parsed = await runBrowserOcr(imageData);
        applyExtractedData(parsed);
        setAiStatus({ used: false, method: 'ocr-local' });
      }
    } catch (ocrError) {
      console.error('Recipe scan error', ocrError);
      alert('Recipe scan failed. Please try again with a clearer photo.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const recipe = {
      menuItemName: formData.get('menuItemName') as string,
      category: formData.get('category') as string,
      price: Number(formData.get('price')) || 0,
      ingredients: extractedData?.ingredients || [],
    };
    
    onRecipeExtracted(recipe);
    handleReset();
  };

  const handleReset = () => {
    setImage(null);
    setIsProcessing(false);
    setIsComplete(false);
    setExtractedData(null);
    setIsEnhancing(false);
    setAiStatus(null);
    stopCamera();
    onClose();
  };

  const handleAiEnhance = async () => {
    if (!extractedData || isEnhancing) return;
    setIsEnhancing(true);

    try {
      const json = await apiRequest<any>('/api/scan/ai-enhance', {
        method: 'POST',
        body: JSON.stringify(extractedData),
      });
      const parsed = parseScanResponse(json);
      setExtractedData(parsed);

      const payload = json?.recipe || json?.data?.recipe || json?.data || json;
      setAiStatus({
        used: Boolean(payload?.aiUsed),
        method: payload?.method || (payload?.aiUsed ? 'openai' : 'heuristic'),
      });
    } catch (error) {
      console.error('AI enhancement failed', error);
      alert('AI enhancement is unavailable right now. Your current scan data is still ready to use.');
    } finally {
      setIsEnhancing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) handleReset();
    }}>
      <DialogContent className="max-w-[calc(100vw-2rem)] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>📸 Scan Recipe</DialogTitle>
          <DialogDescription>
            Take a photo or upload an image of a recipe card
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!image && !isCameraActive && (
            <div className="space-y-3">
              <Button
                type="button"
                className="w-full bg-[#0F172A] hover:bg-[#1E293B] text-white"
                onClick={startCamera}
              >
                <Camera className="w-4 h-4 mr-2" />
                Take Photo
              </Button>
              
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload Image
              </Button>
            </div>
          )}

          {isCameraActive && (
            <div className="space-y-3">
              <div className="relative bg-black rounded-lg overflow-hidden">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full"
                />
              </div>
              <div className="flex space-x-2">
                <Button
                  type="button"
                  className="flex-1 bg-[#0F172A] hover:bg-[#1E293B] text-white"
                  onClick={capturePhoto}
                >
                  <Camera className="w-4 h-4 mr-2" />
                  Capture
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={stopCamera}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {image && (
            <div className="space-y-4">
              <div className="relative rounded-lg overflow-hidden border-2 border-gray-200">
                <img src={image} alt="Recipe" className="w-full" />
                {!isProcessing && !isComplete && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="absolute top-2 right-2 bg-white"
                    onClick={() => setImage(null)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>

              {isProcessing && (
                <Card className="bg-[#FEFCE8] border-[#F5C10E]/30">
                  <CardContent className="py-6">
                    <div className="flex flex-col items-center space-y-3">
                      <Loader2 className="w-8 h-8 text-[#2563EB] animate-spin" />
                      <div className="text-center">
                        <p className="font-medium text-[#0F172A]">Processing Image...</p>
                        <p className="text-sm text-[#1D4ED8] mt-1">Extracting recipe details</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {isComplete && extractedData && (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <Card className="bg-green-50 border-green-200">
                    <CardContent className="py-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center space-x-2">
                          <Check className="w-5 h-5 text-green-600" />
                          <p className="font-medium text-green-900">Recipe extracted!</p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleAiEnhance}
                          disabled={isEnhancing}
                          className="bg-white"
                        >
                          {isEnhancing ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Enhancing...
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-4 h-4 mr-2" />
                              AI Enhance
                            </>
                          )}
                        </Button>
                      </div>
                      {aiStatus && (
                        <p className="text-xs mt-2 text-green-800">
                          {aiStatus.used
                            ? 'AI enhancement applied.'
                            : `AI unavailable, using ${aiStatus.method} parsing.`}
                        </p>
                      )}
                    </CardContent>
                  </Card>

                  <div>
                    <Label htmlFor="menuItemName">Name</Label>
                    <Input
                      id="menuItemName"
                      name="menuItemName"
                      required
                      defaultValue={extractedData.menuItemName}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="category">Category</Label>
                      <Input
                        id="category"
                        name="category"
                        required
                        defaultValue={extractedData.category}
                      />
                    </div>
                    <div>
                      <Label htmlFor="price">Price ($)</Label>
                      <Input
                        id="price"
                        name="price"
                        type="number"
                        step="0.01"
                        required
                        defaultValue={extractedData.price}
                      />
                    </div>
                  </div>

                  <div>
                    <Label>Detected Ingredients</Label>
                    <Card className="mt-2">
                      <CardContent className="py-3">
                        {extractedData.ingredients.length > 0 ? (
                          <div className="space-y-1">
                            {extractedData.ingredients.map((ingredient, index) => (
                              <div key={index} className="flex items-center text-sm">
                                <span className="text-green-600 mr-2">✓</span>
                                <span className="text-gray-700">{ingredient}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-600">No ingredients were detected. You can still continue and add ingredients manually.</p>
                        )}
                      </CardContent>
                    </Card>
                    <p className="text-xs text-gray-500 mt-2">
                      💡 You'll need to match these to your inventory items in the next step
                    </p>
                  </div>

                  <div className="flex space-x-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={handleReset}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      className="flex-1 bg-[#0F172A] hover:bg-[#1E293B] text-white"
                    >
                      Continue to Recipes
                    </Button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
