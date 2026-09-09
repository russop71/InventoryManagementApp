import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router';
import { useInventory } from '../contexts/InventoryContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Upload, FileText, CheckCircle, XCircle, Loader2, Camera, Trash2 } from 'lucide-react';
import { apiRequest } from '../utils/api';
import { findBestSupplierMatch } from '../utils/supplierMatching.js';

interface InvoiceItem {
  name: string;
  quantity: number;
  unit: string;
  packSize?: number;
  packCount?: number;
  unitCost: number;
  totalCost: number;
  category: string;
}

interface ExtractedInvoice {
  vendor: string;
  invoiceNumber: string;
  date: string;
  items: InvoiceItem[];
  total: number;
}

export function InvoiceScanner() {
  const { importScannedInvoice, suppliers } = useInventory();
  const navigate = useNavigate();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedInvoice | null>(null);
  const [editedItems, setEditedItems] = useState<InvoiceItem[]>([]);
  const [supplierMatchMessage, setSupplierMatchMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    setIsCameraActive(false);
  };

  const selectFile = (file: File) => {
    if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.type)) {
      setErrorMessage('Upload a JPEG, PNG, WebP, or PDF invoice.');
      return false;
    }
    if (file.size > 4 * 1024 * 1024) {
      setErrorMessage('Use an invoice file smaller than 4 MB.');
      return false;
    }
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const url = URL.createObjectURL(file);
    previewUrlRef.current = url;
    setSelectedFile(file);
    setPreviewUrl(url);
    setExtractedData(null);
    setEditedItems([]);
    setSupplierMatchMessage('');
    setErrorMessage('');
    return true;
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && !selectFile(file)) event.target.value = '';
  };

  const startCamera = async () => {
    setErrorMessage('');
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } });
      streamRef.current = mediaStream;
      setIsCameraActive(true);
      window.setTimeout(() => {
        if (videoRef.current) videoRef.current.srcObject = mediaStream;
      }, 0);
    } catch (error) {
      console.error('Error accessing invoice camera', error);
      setErrorMessage('Camera access was blocked. Allow camera access or upload an invoice instead.');
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || videoRef.current.videoWidth === 0) {
      setErrorMessage('The camera is still starting. Wait a moment, then capture the invoice again.');
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const context = canvas.getContext('2d');
    if (!context) {
      setErrorMessage('This browser could not capture the photo. Upload an invoice image instead.');
      return;
    }
    context.drawImage(videoRef.current, 0, 0);
    canvas.toBlob(blob => {
      if (!blob) {
        setErrorMessage('This browser could not create the photo. Upload an invoice image instead.');
        return;
      }
      selectFile(new File([blob], `invoice-${Date.now()}.jpg`, { type: 'image/jpeg' }));
      stopCamera();
    }, 'image/jpeg', 0.9);
  };

  const handleScan = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setErrorMessage('');

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const dataUrl = reader.result as string;
        try {
          const json = await apiRequest<ExtractedInvoice>('/api/scan-invoice', {
            method: 'POST',
            body: JSON.stringify({ imageData: dataUrl })
          });
          // Normalize response
          const parsed: ExtractedInvoice = {
            vendor: json.vendor || 'Unknown',
            invoiceNumber: json.invoiceNumber || `INV-${Math.floor(Math.random() * 100000)}`,
            date: json.date || new Date().toISOString().split('T')[0],
            items: (json.items || []).map((it: any) => ({
              name: it.name || it.item || 'Item',
              quantity: Number(it.quantity) || 1,
              unit: it.unit || it.unit || 'ea',
              packSize: Number(it.packSize) || Number(it.quantity) || 1,
              packCount: Number(it.packCount) || 1,
              unitCost: Number(it.unitCost) || Number(it.price) || 0,
              totalCost: Number(it.totalCost) || (Number(it.quantity) || 1) * (Number(it.unitCost) || 0),
              category: it.category || 'Uncategorized'
            })),
            total: Number(json.total) || 0
          };

          const supplierMatch = findBestSupplierMatch(parsed.vendor, suppliers);
          if (supplierMatch) {
            setSupplierMatchMessage(parsed.vendor === supplierMatch.supplier.name
              ? `Using existing supplier: ${supplierMatch.supplier.name}`
              : `Matched “${parsed.vendor}” to existing supplier “${supplierMatch.supplier.name}”.`);
            parsed.vendor = supplierMatch.supplier.name;
          } else {
            setSupplierMatchMessage('No existing supplier matched. Review the supplier name before saving.');
          }
          setExtractedData(parsed);
          setEditedItems(parsed.items);
        } catch (err) {
          console.error('Invoice scan error', err);
          setErrorMessage(err instanceof Error ? err.message : 'Invoice scan failed.');
        } finally {
          setIsProcessing(false);
        }
      };
      reader.readAsDataURL(selectedFile);
    } catch (err) {
      console.error(err);
      setIsProcessing(false);
    }
  };

  const handleItemEdit = (index: number, field: keyof InvoiceItem, value: string | number) => {
    const updated = [...editedItems];
    updated[index] = { ...updated[index], [field]: value };

    if (field === 'packSize' || field === 'packCount') {
      updated[index].quantity = Number(updated[index].packSize || 0) * Number(updated[index].packCount || 0);
    }
    if (field === 'quantity' || field === 'unitCost' || field === 'packSize' || field === 'packCount') {
      updated[index].totalCost = updated[index].quantity * updated[index].unitCost;
    }

    setEditedItems(updated);
  };

  const handleRemoveItem = (index: number) => {
    const updated = editedItems.filter((_, i) => i !== index);
    setEditedItems(updated);
  };

  const handleSaveToInventory = () => {
    if (!extractedData) return;
    const result = importScannedInvoice({
      ...extractedData,
      items: editedItems,
      total: totalValue,
    });
    if (!result.success) {
      alert(result.error || 'The invoice could not be saved.');
      return;
    }

    // Reset form
    setSelectedFile(null);
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
    setPreviewUrl(null);
    setExtractedData(null);
    setEditedItems([]);
    setSupplierMatchMessage('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    // Take the operator straight to the record that was just posted. This makes
    // it clear that scanning creates both inventory updates and an invoice.
    navigate(`/app/invoices?invoice=${encodeURIComponent(result.invoice?.id || '')}`);
  };

  const handleClearAll = () => {
    stopCamera();
    setSelectedFile(null);
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
    setPreviewUrl(null);
    setExtractedData(null);
    setEditedItems([]);
    setSupplierMatchMessage('');
    setErrorMessage('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const totalValue = editedItems.reduce((sum, item) => sum + item.totalCost, 0);

  return (
    <div className="space-y-4 pb-20">
      <div>
        <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">Invoice Scanner</h2>
        <p className="text-sm text-gray-600 mt-1">AI-powered invoice processing</p>
      </div>

      {/* Upload Area */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center">
            <Camera className="w-5 h-5 mr-2 text-[#2563EB]" />
            Upload Invoice
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!selectedFile && !isCameraActive && <div className="grid gap-3 sm:grid-cols-2">
            <Button type="button" className="bg-[#303A43] text-white hover:bg-[#1E293B]" onClick={startCamera}>
              <Camera className="mr-2 h-4 w-4" /> Take Photo
            </Button>
            <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" /> Upload Invoice
            </Button>
          </div>}

          <div className="sr-only">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf,.pdf"
              onChange={handleFileSelect}
              className="hidden"
              id="invoice-upload"
            />
          </div>

          {!selectedFile && !isCameraActive && <p className="text-center text-xs text-gray-500">JPEG, PNG, WebP, or PDF up to 4 MB</p>}

          {isCameraActive && <div className="space-y-3">
            <div className="overflow-hidden rounded-xl bg-black"><video ref={videoRef} autoPlay playsInline className="w-full" /></div>
            <div className="flex gap-2">
              <Button type="button" className="flex-1 bg-[#303A43] text-white" onClick={capturePhoto}><Camera className="mr-2 h-4 w-4" /> Capture Invoice</Button>
              <Button type="button" variant="outline" aria-label="Close camera" onClick={stopCamera}><XCircle className="h-4 w-4" /></Button>
            </div>
          </div>}

          {errorMessage && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-800">{errorMessage}</div>}

          {selectedFile && (
            <div className="space-y-3">
              <div className="flex items-center justify-between bg-[#FEFCE8] p-3 rounded-lg">
                <div className="flex items-center space-x-3">
                  <FileText className="w-5 h-5 text-[#2563EB]" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{selectedFile.name}</p>
                    <p className="text-xs text-gray-500">
                      {(selectedFile.size / 1024).toFixed(2)} KB
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleClearAll}
                  className="bg-white"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>

              {previewUrl && selectedFile?.type === 'application/pdf' && (
                <iframe
                  src={previewUrl}
                  title="Invoice PDF preview"
                  className="h-80 w-full rounded-lg border border-gray-200 bg-gray-50"
                />
              )}

              {previewUrl && selectedFile?.type !== 'application/pdf' && (
                <div className="rounded-lg overflow-hidden border border-gray-200">
                  <img 
                    src={previewUrl} 
                    alt="Invoice preview" 
                    className="w-full max-h-64 object-contain bg-gray-50"
                  />
                </div>
              )}

              {!extractedData && (
                <Button
                  onClick={handleScan}
                  disabled={isProcessing}
                  className="w-full bg-[#303A43] hover:bg-[#1E293B] text-white"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing with AI...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Scan Invoice
                    </>
                  )}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Extracted Data */}
      {extractedData && (
        <>
          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center">
                  <CheckCircle className="w-5 h-5 mr-2 text-green-600" />
                  Invoice Extracted
                </CardTitle>
                <Badge className="bg-green-600 text-white">Success</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="scanned-invoice-vendor" className="text-xs text-green-700">Vendor</Label>
                  <Input id="scanned-invoice-vendor" value={extractedData.vendor} onChange={event => { setExtractedData({ ...extractedData, vendor: event.target.value }); setSupplierMatchMessage('Supplier name edited. Confirm it before saving.'); }} className="mt-1 bg-white text-sm font-semibold text-green-900" />
                  <p className="mt-1 text-[11px] leading-4 text-green-700">{supplierMatchMessage}</p>
                </div>
                <div>
                  <Label htmlFor="scanned-invoice-number" className="text-xs text-green-700">Invoice #</Label>
                  <Input id="scanned-invoice-number" value={extractedData.invoiceNumber} onChange={event => setExtractedData({ ...extractedData, invoiceNumber: event.target.value })} className="mt-1 bg-white text-sm font-semibold text-green-900" />
                </div>
                <div>
                  <Label htmlFor="scanned-invoice-date" className="text-xs text-green-700">Date</Label>
                  <Input id="scanned-invoice-date" type="date" value={extractedData.date} onChange={event => setExtractedData({ ...extractedData, date: event.target.value })} className="mt-1 bg-white text-sm font-semibold text-green-900" />
                </div>
                <div>
                  <p className="text-xs text-green-700">Total Value</p>
                  <p className="text-sm font-semibold text-green-900">
                    ${totalValue.toFixed(2)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Review & Edit Items</CardTitle>
              <p className="text-xs text-gray-500 mt-1">
                Verify the package size, unit and total amount before saving. “Quantity added” is the total stock that will be added to inventory.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {editedItems.map((item, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <Label htmlFor={`invoice-item-name-${index}`} className="text-xs text-gray-600">Item Name</Label>
                      <Input
                        id={`invoice-item-name-${index}`}
                        value={item.name}
                        onChange={(e) => handleItemEdit(index, 'name', e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRemoveItem(index)}
                      className="ml-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <XCircle className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor={`invoice-item-category-${index}`} className="text-xs text-gray-600">Category</Label>
                      <Input
                        id={`invoice-item-category-${index}`}
                        value={item.category}
                        onChange={(e) => handleItemEdit(index, 'category', e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`invoice-item-unit-${index}`} className="text-xs text-gray-600">Unit</Label>
                      <Input
                        id={`invoice-item-unit-${index}`}
                        value={item.unit}
                        onChange={(e) => handleItemEdit(index, 'unit', e.target.value)}
                        className="mt-1"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor={`invoice-item-pack-size-${index}`} className="text-xs text-gray-600">Pack size</Label>
                      <Input id={`invoice-item-pack-size-${index}`} type="number" min="0" step="0.01" value={item.packSize ?? item.quantity} onChange={(e) => handleItemEdit(index, 'packSize', parseFloat(e.target.value) || 0)} className="mt-1" />
                    </div>
                    <div>
                      <Label htmlFor={`invoice-item-pack-count-${index}`} className="text-xs text-gray-600">Packages on invoice</Label>
                      <Input id={`invoice-item-pack-count-${index}`} type="number" min="1" step="1" value={item.packCount ?? 1} onChange={(e) => handleItemEdit(index, 'packCount', parseFloat(e.target.value) || 1)} className="mt-1" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor={`invoice-item-quantity-${index}`} className="text-xs text-gray-600">Quantity</Label>
                      <Input
                        id={`invoice-item-quantity-${index}`}
                        type="number"
                        value={item.quantity}
                        onChange={(e) => handleItemEdit(index, 'quantity', parseFloat(e.target.value) || 0)}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`invoice-item-unit-cost-${index}`} className="text-xs text-gray-600">Unit Cost</Label>
                      <Input
                        id={`invoice-item-unit-cost-${index}`}
                        type="number"
                        step="0.01"
                        value={item.unitCost}
                        onChange={(e) => handleItemEdit(index, 'unitCost', parseFloat(e.target.value) || 0)}
                        className="mt-1"
                      />
                    </div>
                  </div>

                  <div className="bg-gray-50 p-2 rounded text-right">
                    <p className="text-xs text-gray-600">Total Cost</p>
                    <p className="text-lg font-bold text-gray-900">
                      ${item.totalCost.toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}

              <div className="border-t-2 border-gray-300 pt-3 mt-4">
                <div className="flex justify-between items-center mb-4">
                  <p className="text-sm font-semibold text-gray-900">Invoice Total</p>
                  <p className="text-xl font-bold text-[#303A43]">
                    ${totalValue.toFixed(2)}
                  </p>
                </div>

                <Button
                  onClick={handleSaveToInventory}
                  disabled={editedItems.length === 0 || !extractedData.vendor.trim() || !extractedData.invoiceNumber.trim() || !extractedData.date}
                  className="w-full bg-[#303A43] hover:bg-[#1E293B] text-white"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Save Invoice & Update Inventory ({editedItems.length} items)
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
