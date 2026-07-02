import { useState } from 'react';
import { useInventory } from '../contexts/InventoryContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Upload, Download, CheckCircle, AlertCircle, ClipboardList } from 'lucide-react';
import { toast } from 'sonner';
import { read, utils, writeFile } from 'xlsx';

interface CountUpdate {
  itemName: string;
  currentStock: number;
  newCount: number;
  matched: boolean;
  itemId?: string;
}

export function InventoryCount() {
  const { inventory, updateInventoryItem } = useInventory();
  const [countUpdates, setCountUpdates] = useState<CountUpdate[]>([]);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const data = event.target?.result;
      
      if (file.name.endsWith('.csv')) {
        parseCSV(data as string);
      } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        parseExcel(data as ArrayBuffer);
      } else {
        toast.error('Please upload a CSV or Excel file');
      }
    };

    if (file.name.endsWith('.csv')) {
      reader.readAsText(file);
    } else {
      reader.readAsArrayBuffer(file);
    }
  };

  const parseCSV = (text: string) => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
      toast.error('CSV file is empty or invalid');
      return;
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const updates: CountUpdate[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      
      const itemName = values[headers.indexOf('name')] || 
                       values[headers.indexOf('item name')] || 
                       values[headers.indexOf('item')] || '';
      
      const newCount = Number(values[headers.indexOf('count')] || 
                             values[headers.indexOf('new count')] ||
                             values[headers.indexOf('current stock')] || 0);

      if (itemName && !isNaN(newCount)) {
        const matchedItem = inventory.find(
          item => item.name.toLowerCase() === itemName.toLowerCase()
        );

        updates.push({
          itemName,
          currentStock: matchedItem?.currentStock || 0,
          newCount,
          matched: !!matchedItem,
          itemId: matchedItem?.id
        });
      }
    }

    if (updates.length === 0) {
      toast.error('No valid count data found in file');
      return;
    }

    setCountUpdates(updates);
    setIsPreviewOpen(true);
  };

  const parseExcel = (data: ArrayBuffer) => {
    try {
      const workbook = read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData: any[] = utils.sheet_to_json(worksheet);

      if (jsonData.length === 0) {
        toast.error('Excel file is empty');
        return;
      }

      const updates: CountUpdate[] = [];

      jsonData.forEach((row: any) => {
        const itemName = row['Name'] || row['Item Name'] || row['Item'] || row['name'] || row['item name'] || row['item'] || '';
        const newCount = Number(row['Count'] || row['New Count'] || row['Current Stock'] || row['count'] || row['new count'] || row['current stock'] || 0);

        if (itemName && !isNaN(newCount)) {
          const matchedItem = inventory.find(
            item => item.name.toLowerCase() === itemName.toLowerCase()
          );

          updates.push({
            itemName,
            currentStock: matchedItem?.currentStock || 0,
            newCount,
            matched: !!matchedItem,
            itemId: matchedItem?.id
          });
        }
      });

      if (updates.length === 0) {
        toast.error('No valid count data found in Excel file');
        return;
      }

      setCountUpdates(updates);
      setIsPreviewOpen(true);
      toast.success(`Loaded ${updates.length} items from Excel`);
    } catch (error) {
      console.error('Excel parsing error:', error);
      toast.error('Failed to parse Excel file');
    }
  };

  const downloadCountTemplate = () => {
    // Create Excel template with current inventory
    const templateData = inventory.map(item => ({
      'Name': item.name,
      'Category': item.category,
      'Current Stock': item.currentStock,
      'Unit': item.unit,
      'Count': '' // Empty for user to fill in
    }));

    const worksheet = utils.json_to_sheet(templateData);
    const workbook = utils.book_new();
    utils.book_append_sheet(workbook, worksheet, 'Inventory Count');
    
    // Set column widths
    worksheet['!cols'] = [
      { wch: 25 }, // Name
      { wch: 15 }, // Category
      { wch: 15 }, // Current Stock
      { wch: 10 }, // Unit
      { wch: 15 }  // Count
    ];

    writeFile(workbook, '86d-inventory-count.xlsx');
    toast.success('Count template downloaded');
  };

  const applyCountUpdates = () => {
    let successCount = 0;
    let skippedCount = 0;

    countUpdates.forEach(update => {
      if (update.matched && update.itemId) {
        updateInventoryItem(update.itemId, { currentStock: update.newCount });
        successCount++;
      } else {
        skippedCount++;
      }
    });

    if (successCount > 0) {
      toast.success(`Updated ${successCount} items`);
    }
    if (skippedCount > 0) {
      toast.warning(`Skipped ${skippedCount} unmatched items`);
    }

    setIsPreviewOpen(false);
    setCountUpdates([]);
  };

  const matchedCount = countUpdates.filter(u => u.matched).length;
  const unmatchedCount = countUpdates.filter(u => !u.matched).length;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Inventory Count</h2>
        <p className="text-sm text-gray-600 mt-1">Update inventory counts by importing Excel or CSV files</p>
      </div>

      {/* Instructions Card */}
      <Card className="bg-[#FEFCE8] border-[#F5C10E]/30">
        <CardHeader>
          <CardTitle className="text-base text-[#0F172A] flex items-center">
            <ClipboardList className="w-5 h-5 mr-2" />
            How to Update Inventory Counts
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-[#1E3A5F]">
          <p><strong>Step 1:</strong> Download the count template with your current inventory items</p>
          <p><strong>Step 2:</strong> Fill in the "Count" column with your physical count numbers</p>
          <p><strong>Step 3:</strong> Upload the completed file to update your inventory</p>
          <p className="mt-3 text-xs text-[#2563EB]">Note: Item names must match exactly for updates to work</p>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Import Count Data</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button 
            className="bg-green-600 hover:bg-green-700 text-white w-full" 
            onClick={downloadCountTemplate}
          >
            <Download className="w-4 h-4 mr-2" />
            Download Count Template (Excel)
          </Button>

          <Input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileUpload}
            className="hidden"
            id="count-file"
          />
          <Label
            htmlFor="count-file"
            className="flex items-center justify-center bg-[#0F172A] hover:bg-[#1E293B] text-white cursor-pointer px-4 py-3 rounded-md text-sm font-medium transition-colors w-full"
          >
            <Upload className="w-4 h-4 mr-2" />
            Upload Count File (Excel or CSV)
          </Label>
        </CardContent>
      </Card>

      {/* Current Inventory Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Current Inventory</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-500">Total Items</p>
              <p className="text-2xl font-semibold text-gray-900">{inventory.length}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-500">Low Stock Items</p>
              <p className="text-2xl font-semibold text-red-600">
                {inventory.filter(item => (item.currentStock / item.parLevel) < 0.3).length}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Review Count Updates</DialogTitle>
            <DialogDescription>
              Review and confirm the inventory count updates
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pb-4">
            {/* Summary */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium text-green-900">
                    {matchedCount} Matched
                  </span>
                </div>
              </div>
              {unmatchedCount > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <div className="flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 text-yellow-600" />
                    <span className="text-sm font-medium text-yellow-900">
                      {unmatchedCount} Unmatched
                    </span>
                  </div>
                </div>
              )}
            </div>

            {matchedCount > 0 && (
              <Button 
                className="bg-[#0F172A] hover:bg-[#1E293B] text-white w-full text-base py-6" 
                onClick={applyCountUpdates}
              >
                Update {matchedCount} Item{matchedCount !== 1 ? 's' : ''}
              </Button>
            )}
          </div>

          {/* Updates List */}
          <div className="flex-1 overflow-y-auto space-y-2 pb-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
              Count Updates ({countUpdates.length} items)
            </p>
            {countUpdates.map((update, index) => (
              <div 
                key={index} 
                className={`border rounded-lg p-3 ${
                  update.matched ? 'bg-white border-gray-200' : 'bg-yellow-50 border-yellow-200'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <p className="font-semibold text-gray-900">{update.itemName}</p>
                  {update.matched ? (
                    <Badge className="bg-green-100 text-green-800 text-xs">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Matched
                    </Badge>
                  ) : (
                    <Badge className="bg-yellow-100 text-yellow-800 text-xs">
                      <AlertCircle className="w-3 h-3 mr-1" />
                      Not Found
                    </Badge>
                  )}
                </div>
                {update.matched && (
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center space-x-4">
                      <div>
                        <p className="text-xs text-gray-500">Current</p>
                        <p className="font-medium text-gray-900">{update.currentStock}</p>
                      </div>
                      <div className="text-gray-400">→</div>
                      <div>
                        <p className="text-xs text-gray-500">New Count</p>
                        <p className="font-medium text-[#0F172A]">{update.newCount}</p>
                      </div>
                    </div>
                    <div className={`text-sm font-medium ${
                      update.newCount > update.currentStock ? 'text-green-600' : 
                      update.newCount < update.currentStock ? 'text-red-600' : 'text-gray-500'
                    }`}>
                      {update.newCount > update.currentStock && `+${update.newCount - update.currentStock}`}
                      {update.newCount < update.currentStock && `${update.newCount - update.currentStock}`}
                      {update.newCount === update.currentStock && 'No change'}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-end space-x-2 pt-4 border-t bg-white shrink-0">
            <Button type="button" variant="outline" onClick={() => {
              setIsPreviewOpen(false);
              setCountUpdates([]);
            }}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
