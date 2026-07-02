import { useState, useRef } from 'react';
import { useInventory } from '../contexts/InventoryContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Upload, FileText, CheckCircle, XCircle, Loader2, Camera, Trash2 } from 'lucide-react';

interface InvoiceItem {
  name: string;
  quantity: number;
  unit: string;
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
  const { inventory, addInventoryItem, updateInventoryItem, suppliers, addSupplier, updateSupplier } = useInventory();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedInvoice | null>(null);
  const [editedItems, setEditedItems] = useState<InvoiceItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      setExtractedData(null);
      setEditedItems([]);
    }
  };

  const handleScan = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);

    // Simulate AI processing with a delay
    await new Promise(resolve => setTimeout(resolve, 2500));

    // Mock extracted data from AI vision model
    const mockData: ExtractedInvoice = {
      vendor: "Sysco Food Services",
      invoiceNumber: `INV-${Math.floor(Math.random() * 100000)}`,
      date: new Date().toISOString().split('T')[0],
      items: [
        {
          name: "Chicken Breast",
          quantity: 50,
          unit: "lbs",
          unitCost: 3.99,
          totalCost: 199.50,
          category: "Protein"
        },
        {
          name: "Roma Tomatoes",
          quantity: 25,
          unit: "lbs",
          unitCost: 2.49,
          totalCost: 62.25,
          category: "Produce"
        },
        {
          name: "Extra Virgin Olive Oil",
          quantity: 4,
          unit: "gallons",
          unitCost: 24.99,
          totalCost: 99.96,
          category: "Dry Goods"
        },
        {
          name: "Fresh Basil",
          quantity: 2,
          unit: "lbs",
          unitCost: 12.99,
          totalCost: 25.98,
          category: "Produce"
        }
      ],
      total: 387.69
    };

    setExtractedData(mockData);
    setEditedItems(mockData.items);
    setIsProcessing(false);
  };

  const handleItemEdit = (index: number, field: keyof InvoiceItem, value: string | number) => {
    const updated = [...editedItems];
    updated[index] = { ...updated[index], [field]: value };
    
    // Recalculate total cost if quantity or unit cost changes
    if (field === 'quantity' || field === 'unitCost') {
      updated[index].totalCost = updated[index].quantity * updated[index].unitCost;
    }
    
    setEditedItems(updated);
  };

  const handleRemoveItem = (index: number) => {
    const updated = editedItems.filter((_, i) => i !== index);
    setEditedItems(updated);
  };

  const handleSaveToInventory = () => {
    // First, handle supplier - add if new or update if exists
    if (extractedData?.vendor) {
      const existingSupplier = suppliers.find(s => 
        s.name.toLowerCase() === extractedData.vendor.toLowerCase()
      );

      if (!existingSupplier) {
        // Automatically add new supplier from invoice
        const inferredCategory = editedItems.length > 0 ? editedItems[0].category : 'Other';
        addSupplier({
          name: extractedData.vendor,
          contactPerson: '',
          email: '',
          phone: '',
          address: '',
          category: inferredCategory,
          paymentTerms: '',
          notes: `Auto-added from invoice ${extractedData.invoiceNumber} on ${new Date().toLocaleDateString()}`,
          source: 'invoice',
        });
      }
    }

    // Then handle inventory items
    editedItems.forEach(item => {
      // Check if item already exists in inventory
      const existingItem = inventory.find(inv => 
        inv.name.toLowerCase() === item.name.toLowerCase()
      );

      if (existingItem) {
        // Update existing item - add to current stock
        updateInventoryItem(existingItem.id, {
          currentStock: existingItem.currentStock + item.quantity,
          unitCost: item.unitCost,
          supplier: extractedData?.vendor || existingItem.supplier,
          lastUpdated: new Date().toISOString()
        });
      } else {
        // Create new inventory item
        addInventoryItem({
          id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: item.name,
          category: item.category,
          currentStock: item.quantity,
          unit: item.unit,
          unitCost: item.unitCost,
          parLevel: item.quantity * 2, // Set default par level to 2x initial quantity
          supplier: extractedData?.vendor || 'Unknown',
          reorderPoint: item.quantity * 0.5,
          lastUpdated: new Date().toISOString(),
          history: [{
            date: new Date().toISOString(),
            change: item.quantity,
            reason: `Initial stock from invoice ${extractedData?.invoiceNumber}`,
            newStock: item.quantity
          }]
        });
      }
    });

    // Reset form
    setSelectedFile(null);
    setPreviewUrl(null);
    setExtractedData(null);
    setEditedItems([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    alert(`Successfully added ${editedItems.length} items to inventory!${extractedData?.vendor ? `\n\nSupplier "${extractedData.vendor}" has been added to your supplier list.` : ''}`);
  };

  const handleClearAll = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setExtractedData(null);
    setEditedItems([]);
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
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
              id="invoice-upload"
            />
            <label htmlFor="invoice-upload" className="cursor-pointer">
              <Upload className="w-12 h-12 mx-auto text-gray-400 mb-3" />
              <p className="text-sm font-medium text-gray-700">
                Click to upload invoice image
              </p>
              <p className="text-xs text-gray-500 mt-1">
                PNG, JPG, or PDF up to 10MB
              </p>
            </label>
          </div>

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

              {previewUrl && (
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
                  className="w-full bg-[#0F172A] hover:bg-[#1E293B] text-white"
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
                  <p className="text-xs text-green-700">Vendor</p>
                  <p className="text-sm font-semibold text-green-900">{extractedData.vendor}</p>
                </div>
                <div>
                  <p className="text-xs text-green-700">Invoice #</p>
                  <p className="text-sm font-semibold text-green-900">{extractedData.invoiceNumber}</p>
                </div>
                <div>
                  <p className="text-xs text-green-700">Date</p>
                  <p className="text-sm font-semibold text-green-900">
                    {new Date(extractedData.date).toLocaleDateString()}
                  </p>
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
                Verify extracted data before saving to inventory
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {editedItems.map((item, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <Label className="text-xs text-gray-600">Item Name</Label>
                      <Input
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
                      <Label className="text-xs text-gray-600">Category</Label>
                      <Input
                        value={item.category}
                        onChange={(e) => handleItemEdit(index, 'category', e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-600">Unit</Label>
                      <Input
                        value={item.unit}
                        onChange={(e) => handleItemEdit(index, 'unit', e.target.value)}
                        className="mt-1"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-gray-600">Quantity</Label>
                      <Input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => handleItemEdit(index, 'quantity', parseFloat(e.target.value) || 0)}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-600">Unit Cost</Label>
                      <Input
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
                  <p className="text-xl font-bold text-[#0F172A]">
                    ${totalValue.toFixed(2)}
                  </p>
                </div>

                <Button
                  onClick={handleSaveToInventory}
                  className="w-full bg-[#0F172A] hover:bg-[#1E293B] text-white"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Save to Inventory ({editedItems.length} items)
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}