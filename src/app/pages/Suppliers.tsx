import { useState } from 'react';
import { useInventory } from '../contexts/InventoryContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Truck, Plus, Pencil, Trash2, Mail, Phone, MapPin, ChevronDown, ChevronRight, FileText, DollarSign, Users } from 'lucide-react';
import { toast } from 'sonner';

export function Suppliers() {
  const { suppliers, addSupplier, updateSupplier, deleteSupplier } = useInventory();
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
      ccEmails: String(formData.get('ccEmails') || '')
        .split(/[;,\n]/)
        .map(email => email.trim().toLowerCase())
        .filter((email, index, emails) => email && emails.indexOf(email) === index),
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

  const editingSupplierData = editingSupplier 
    ? suppliers.find(s => s.id === editingSupplier)
    : null;
  const contactableSuppliers = suppliers.filter(supplier => supplier.contactPerson || supplier.email || supplier.phone).length;

  return (
    <div className="space-y-4 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight flex items-center">
            <Truck className="w-6 h-6 mr-2 text-[#0F172A]" />
            Suppliers
          </h2>
          <p className="text-sm text-gray-600 mt-1">Manage supplier contact information</p>
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
            <form key={editingSupplierData?.id || 'new-supplier'} onSubmit={handleAddSupplier} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-4 rounded-2xl border border-gray-100 bg-gray-50/80 p-4">
                  <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-gray-400">
                    <FileText className="h-3.5 w-3.5" />
                    Supplier details
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="name">Supplier Name *</Label>
                    <Input
                      id="name"
                      name="name"
                      required
                      defaultValue={editingSupplierData?.name}
                      placeholder="US Foods"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="category">Category *</Label>
                    <select
                      id="category"
                      name="category"
                      required
                      defaultValue={editingSupplierData?.category || ''}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    >
                      <option value="">Select category...</option>
                      <option value="Proteins">Proteins</option>
                      <option value="Produce">Produce</option>
                      <option value="Dairy">Dairy</option>
                      <option value="Dry Goods">Dry Goods</option>
                      <option value="Beverages">Beverages</option>
                      <option value="Pantry">Pantry</option>
                      <option value="Seafood">Seafood</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="paymentTerms">Payment Terms</Label>
                    <Input
                      id="paymentTerms"
                      name="paymentTerms"
                      defaultValue={editingSupplierData?.paymentTerms}
                      placeholder="Net 30"
                    />
                  </div>
                </div>

                <div className="space-y-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-gray-400">
                    <Phone className="h-3.5 w-3.5" />
                    Contact information
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="contactPerson">Contact Person</Label>
                    <Input
                      id="contactPerson"
                      name="contactPerson"
                      defaultValue={editingSupplierData?.contactPerson}
                      placeholder="John Smith"
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        defaultValue={editingSupplierData?.email}
                        placeholder="orders@supplier.com"
                      />
                    </div>
                    <div className="space-y-1.5">
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
                  <div className="space-y-1.5">
                    <Label htmlFor="address">Address</Label>
                    <Input
                      id="address"
                      name="address"
                      defaultValue={editingSupplierData?.address}
                      placeholder="123 Main St, City, State ZIP"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ccEmails">Default order email CC</Label>
                    <textarea
                      id="ccEmails"
                      name="ccEmails"
                      defaultValue={editingSupplierData?.ccEmails?.join(', ') || ''}
                      rows={3}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                      placeholder="souschef@restaurant.com, manager@restaurant.com"
                    />
                    <p className="text-xs text-gray-500">These team members are copied automatically on every order sent to this supplier.</p>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="notes">Notes</Label>
                <textarea
                  id="notes"
                  name="notes"
                  defaultValue={editingSupplierData?.notes}
                  rows={4}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
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
            <p className="text-xs text-[#1D4ED8] mt-1">Vendor directory</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-xs font-medium text-blue-900">Contactable</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold text-blue-900">{contactableSuppliers}</div>
            <p className="text-xs text-blue-700 mt-1">Have contact details</p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
        <CardContent className="pt-4">
          <div className="flex items-start space-x-3">
            <div className="bg-green-600 rounded-lg p-2">
              <Truck className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-green-900">Contact directory</h3>
              <p className="text-sm text-green-800 mt-1">
                This view is focused on supplier names and contact details only. Inventory item links are intentionally hidden for now.
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
                No suppliers yet. Add your first supplier contact.
              </p>
            </CardContent>
          </Card>
        ) : (
          suppliers.map(supplier => {
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
                            <span className="text-xs text-gray-500">Contact details</span>
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
                      {supplier.ccEmails && supplier.ccEmails.length > 0 && (
                        <div className="flex items-start space-x-2 text-sm">
                          <Users className="mt-0.5 h-4 w-4 text-gray-500" />
                          <div>
                            <span className="font-medium text-gray-700">Order email CC:</span>
                            <div className="mt-1 flex flex-wrap gap-1.5">
                              {supplier.ccEmails.map(email => (
                                <Badge key={email} variant="outline" className="font-normal">{email}</Badge>
                              ))}
                            </div>
                          </div>
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
                    <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-3 text-sm text-gray-500">
                      Inventory item links are hidden in this view. Add or edit contact details above.
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
