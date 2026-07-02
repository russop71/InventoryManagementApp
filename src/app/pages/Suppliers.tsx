import { useState } from 'react';
import { useInventory } from '../contexts/InventoryContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Truck, Plus, Pencil, Trash2, Mail, Phone, MapPin, Package, DollarSign, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

export function Suppliers() {
  const { inventory, suppliers, addSupplier, updateSupplier, deleteSupplier } = useInventory();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<string | null>(null);
  const [expandedSupplier, setExpandedSupplier] = useState<string | null>(null);

  const handleAddSupplier = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const newSupplier = {
      name: formData.get('name') as string,
      contactPerson: formData.get('contactPerson') as string,
      email: formData.get('email') as string,
      phone: formData.get('phone') as string,
      address: formData.get('address') as string,
      category: formData.get('category') as string,
      paymentTerms: formData.get('paymentTerms') as string,
      notes: formData.get('notes') as string,
    };

    if (editingSupplier) {
      updateSupplier(editingSupplier, newSupplier);
      toast.success('Supplier updated successfully');
      setEditingSupplier(null);
    } else {
      addSupplier(newSupplier);
      toast.success('Supplier added successfully');
    }
    
    setIsAddDialogOpen(false);
    (e.target as HTMLFormElement).reset();
  };

  const handleEdit = (supplier: any) => {
    setEditingSupplier(supplier.id);
    setIsAddDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this supplier?')) {
      deleteSupplier(id);
      toast.success('Supplier deleted');
    }
  };

  const toggleSupplier = (supplierId: string) => {
    setExpandedSupplier(expandedSupplier === supplierId ? null : supplierId);
  };

  // Get items supplied by each supplier
  const getSupplierItems = (supplierName: string) => {
    return inventory.filter(item => item.supplier === supplierName);
  };

  // Calculate total value for each supplier
  const getSupplierValue = (supplierName: string) => {
    return getSupplierItems(supplierName).reduce(
      (sum, item) => sum + (item.currentStock * item.unitCost),
      0
    );
  };

  const editingSupplierData = editingSupplier 
    ? suppliers.find(s => s.id === editingSupplier)
    : null;

  return (
    <div className="space-y-4 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight flex items-center">
            <Truck className="w-6 h-6 mr-2 text-[#0F172A]" />
            Suppliers
          </h2>
          <p className="text-sm text-gray-600 mt-1">Manage supplier relationships</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
          setIsAddDialogOpen(open);
          if (!open) setEditingSupplier(null);
        }}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-[#0F172A] hover:bg-[#1E293B] text-white">
              <Plus className="w-4 h-4 mr-1" />
              Add
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[calc(100vw-2rem)] max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}</DialogTitle>
              <DialogDescription>
                {editingSupplier ? 'Update supplier information' : 'Add a new supplier to your network'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddSupplier} className="space-y-4">
              <div>
                <Label htmlFor="name">Supplier Name *</Label>
                <Input 
                  id="name" 
                  name="name" 
                  required 
                  defaultValue={editingSupplierData?.name}
                  placeholder="US Foods"
                />
              </div>
              
              <div>
                <Label htmlFor="category">Category *</Label>
                <select
                  id="category"
                  name="category"
                  required
                  defaultValue={editingSupplierData?.category || ''}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                >
                  <option value="">Select category...</option>
                  <option value="Proteins">Proteins</option>
                  <option value="Produce">Produce</option>
                  <option value="Dairy">Dairy</option>
                  <option value="Dry Goods">Dry Goods</option>
                  <option value="Beverages">Beverages</option>
                  <option value="Pantry">Pantry</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <Label htmlFor="contactPerson">Contact Person</Label>
                <Input 
                  id="contactPerson" 
                  name="contactPerson" 
                  defaultValue={editingSupplierData?.contactPerson}
                  placeholder="John Smith"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input 
                    id="email" 
                    name="email" 
                    type="email"
                    defaultValue={editingSupplierData?.email}
                    placeholder="orders@supplier.com"
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input 
                    id="phone" 
                    name="phone" 
                    type="tel"
                    defaultValue={editingSupplierData?.phone}
                    placeholder="(555) 123-4567"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="address">Address</Label>
                <Input 
                  id="address" 
                  name="address"
                  defaultValue={editingSupplierData?.address}
                  placeholder="123 Main St, City, State ZIP"
                />
              </div>

              <div>
                <Label htmlFor="paymentTerms">Payment Terms</Label>
                <Input 
                  id="paymentTerms" 
                  name="paymentTerms"
                  defaultValue={editingSupplierData?.paymentTerms}
                  placeholder="Net 30"
                />
              </div>

              <div>
                <Label htmlFor="notes">Notes</Label>
                <textarea
                  id="notes"
                  name="notes"
                  defaultValue={editingSupplierData?.notes}
                  rows={3}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  placeholder="Additional notes about this supplier..."
                />
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setIsAddDialogOpen(false);
                    setEditingSupplier(null);
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" className="bg-[#0F172A] hover:bg-[#1E293B] text-white">
                  {editingSupplier ? 'Update' : 'Add'} Supplier
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-gradient-to-br from-[#FEFCE8] to-[#FEF9C3] border-[#F5C10E]/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-xs font-medium text-[#0F172A]">Total Suppliers</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold text-[#0F172A]">{suppliers.length}</div>
            <p className="text-xs text-[#1D4ED8] mt-1">In network</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-xs font-medium text-purple-900">Total Value</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold text-purple-900">
              ${suppliers.reduce((sum, supplier) => sum + getSupplierValue(supplier.name), 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </div>
            <p className="text-xs text-purple-700 mt-1">Inventory value</p>
          </CardContent>
        </Card>
      </div>

      {/* AI Scanner Info */}
      <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
        <CardContent className="pt-4">
          <div className="flex items-start space-x-3">
            <div className="bg-green-600 rounded-lg p-2">
              <Truck className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-green-900">Auto-Add from Invoices</h3>
              <p className="text-sm text-green-800 mt-1">
                Suppliers are automatically added when you scan invoices. The AI extracts supplier information and adds them to this list.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Suppliers List */}
      <div className="space-y-3">
        {suppliers.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Truck className="w-12 h-12 text-gray-400 mb-4" />
              <p className="text-gray-500 text-center text-sm">
                No suppliers yet. Add your first supplier or scan an invoice.
              </p>
            </CardContent>
          </Card>
        ) : (
          suppliers.map(supplier => {
            const supplierItems = getSupplierItems(supplier.name);
            const supplierValue = getSupplierValue(supplier.name);
            const isExpanded = expandedSupplier === supplier.id;

            return (
              <Card key={supplier.id} className="overflow-hidden">
                <CardHeader 
                  className="cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => toggleSupplier(supplier.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        {isExpanded ? (
                          <ChevronDown className="w-5 h-5 text-gray-500" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-gray-500" />
                        )}
                        <div>
                          <CardTitle className="text-base">{supplier.name}</CardTitle>
                          <div className="flex items-center space-x-2 mt-1">
                            <Badge className="bg-[#FEF9C3] text-[#1E3A5F] text-xs">
                              {supplier.category}
                            </Badge>
                            <span className="text-xs text-gray-500">
                              {supplierItems.length} items • ${supplierValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex space-x-1" onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(supplier)}
                      >
                        <Pencil className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(supplier.id)}
                      >
                        <Trash2 className="w-3 h-3 text-red-600" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                {isExpanded && (
                  <CardContent className="space-y-4 pt-0">
                    {/* Contact Information */}
                    <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                      {supplier.contactPerson && (
                        <div className="flex items-center space-x-2 text-sm">
                          <span className="font-medium text-gray-700">Contact:</span>
                          <span className="text-gray-900">{supplier.contactPerson}</span>
                        </div>
                      )}
                      {supplier.email && (
                        <div className="flex items-center space-x-2 text-sm">
                          <Mail className="w-4 h-4 text-gray-500" />
                          <a href={`mailto:${supplier.email}`} className="text-[#2563EB] hover:underline">
                            {supplier.email}
                          </a>
                        </div>
                      )}
                      {supplier.phone && (
                        <div className="flex items-center space-x-2 text-sm">
                          <Phone className="w-4 h-4 text-gray-500" />
                          <a href={`tel:${supplier.phone}`} className="text-[#2563EB] hover:underline">
                            {supplier.phone}
                          </a>
                        </div>
                      )}
                      {supplier.address && (
                        <div className="flex items-center space-x-2 text-sm">
                          <MapPin className="w-4 h-4 text-gray-500" />
                          <span className="text-gray-900">{supplier.address}</span>
                        </div>
                      )}
                      {supplier.paymentTerms && (
                        <div className="flex items-center space-x-2 text-sm">
                          <DollarSign className="w-4 h-4 text-gray-500" />
                          <span className="text-gray-900">Payment Terms: {supplier.paymentTerms}</span>
                        </div>
                      )}
                      {supplier.notes && (
                        <div className="pt-2 border-t border-gray-200">
                          <p className="text-xs font-medium text-gray-500 mb-1">Notes:</p>
                          <p className="text-sm text-gray-900">{supplier.notes}</p>
                        </div>
                      )}
                    </div>

                    {/* Supplied Items */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-semibold text-gray-900 flex items-center">
                          <Package className="w-4 h-4 mr-1" />
                          Supplied Items ({supplierItems.length})
                        </h4>
                        <span className="text-sm font-bold text-gray-900">
                          ${supplierValue.toFixed(2)}
                        </span>
                      </div>
                      {supplierItems.length === 0 ? (
                        <p className="text-xs text-gray-500 text-center py-4">
                          No items from this supplier yet
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {supplierItems.map(item => (
                            <div key={item.id} className="bg-white border border-gray-200 rounded-lg p-2">
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <p className="font-medium text-sm text-gray-900">{item.name}</p>
                                  <p className="text-xs text-gray-500">
                                    {item.category} • {item.currentStock} {item.unit} @ ${item.unitCost.toFixed(2)}/{item.unit}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="font-semibold text-sm text-gray-900">
                                    ${(item.currentStock * item.unitCost).toFixed(2)}
                                  </p>
                                  <Badge className={`text-xs ${
                                    item.currentStock < item.parLevel * 0.3 
                                      ? 'bg-red-100 text-red-800' 
                                      : 'bg-green-100 text-green-800'
                                  }`}>
                                    {((item.currentStock / item.parLevel) * 100).toFixed(0)}% stock
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
