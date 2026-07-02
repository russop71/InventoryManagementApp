import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Camera, Upload, X, Loader2, Check } from 'lucide-react';
import { Card, CardContent } from './ui/card';

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
    
    // Simulate OCR processing
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Mock extracted data
    const mockData = {
      menuItemName: 'Grilled Salmon Plate',
      category: 'Entrees',
      price: '24.99',
      ingredients: [
        'Salmon Fillet - 6 oz',
        'Olive Oil - 2 tbsp',
        'Lemon - 1 wedge',
        'Asparagus - 4 oz',
        'Garlic - 2 cloves',
        'Salt - 1 tsp',
        'Black Pepper - 0.5 tsp',
      ]
    };
    
    setExtractedData(mockData);
    setIsProcessing(false);
    setIsComplete(true);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const recipe = {
      menuItemName: formData.get('menuItemName') as string,
      category: formData.get('category') as string,
      price: Number(formData.get('price')),
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
    stopCamera();
    onClose();
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
                      <div className="flex items-center space-x-2">
                        <Check className="w-5 h-5 text-green-600" />
                        <p className="font-medium text-green-900">Recipe extracted!</p>
                      </div>
                    </CardContent>
                  </Card>

                  <div>
                    <Label htmlFor="menuItemName">Menu Item Name</Label>
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
                        <div className="space-y-1">
                          {extractedData.ingredients.map((ingredient, index) => (
                            <div key={index} className="flex items-center text-sm">
                              <span className="text-green-600 mr-2">✓</span>
                              <span className="text-gray-700">{ingredient}</span>
                            </div>
                          ))}
                        </div>
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
                      Continue to Recipe Builder
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
