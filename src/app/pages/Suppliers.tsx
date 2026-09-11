import { useState } from 'react';
import { useInventory } from '../contexts/InventoryContext';
import { Card, CardContent, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Truck, Plus, Pencil, Trash2, Mail, Phone, MapPin, ChevronDown, ChevronRight, FileText, DollarSign, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { getInvalidEmailListEntries, parseEmailList } from '../utils/supplierEmailDraft.js';
import { useNavigate } from 'react-router';

function SupplierCategoryField({ initialValue = '', options }: { initialValue?: string; options: string[] }) {
  const [category, setCategory] = useState(initialValue);
  const [isCustom, setIsCustom] = useState(Boolean(initialValue && !options.includes(initialValue)));

  return (
    <div className="space-y-1.5">
      <Label htmlFor="category-choice">Category *</Label>
      <input type="hidden" name="category" value={category} />
      <select
        id="category-choice"
        value={isCustom ? '__custom__' : category}
        onChange={event => {
          if (event.target.value === '__custom__') {
            setCategory('');
            setIsCustom(true);
            return;
          }
          setCategory(event.target.value);
          setIsCustom(false);
        }}
        className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm"
        aria-required="true"
      >
        <option value="">Select category...</option>
        {options.map(option => <option key={option} value={option}>{option}</option>)}
        <option value="__custom__">+ Add custom category...</option>
      </select>
      {isCustom && (
        <Input
          id="category"
          value={category}
          onChange={event => setCategory(event.target.value)}
          placeholder="Enter a new category"
          autoFocus
          required
          className="border-[#F5D62E] bg-[#FFFBE7]"
        />
      )}
      <p className="text-xs text-gray-500">Choose an existing category or add one that fits this supplier.</p>
    </div>
  );
}

export function Suppliers() {
  const navigate = useNavigate();
  const { suppliers, categories, addSupplier, updateSupplier, deleteSupplier } = useInventory();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<string | null>(null);
  const [expandedSupplier, setExpandedSupplier] = useState<string | null>(null);

  const handleAddSupplier = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const ccEmailValue = formData.get('ccEmails') as string;
    const category = String(formData.get('category') || '').trim();
    if (!category) {
      toast.error('Choose or add a supplier category');
      return;
    }
    const invalidCcEmails = getInvalidEmailListEntries(ccEmailValue);
    if (invalidCcEmails.length > 0) {
      toast.error(`Check the CC email${invalidCcEmails.length === 1 ? '' : 's'}: ${invalidCcEmails.join(', ')}`);
      return;
    }
    
    const newSupplier = {
      name: formData.get('name') as string,
      contactPerson: formData.get('contactPerson') as string,
      email: formData.get('email') as string,
      ccEmails: parseEmailList(ccEmailValue),
      phone: formData.get('phone') as string,
      address: formData.get('address') as string,
      category,
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
  const supplierCategoryOptions = categories.map(category => category.name);
  return (
    <div className="space-y-3 pb-20">
      <div className="flex items-center justify-between gap-3 rounded-2xl bg-[#303A43] px-4 py-3 shadow-sm">
        <div className="min-w-0">
          <h2 className="flex items-center text-xl font-extrabold tracking-tight text-white">
            <span className="mr-2 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#F5D62E]">
              <Truck className="h-4 w-4 text-[#303A43]" />
            </span>
            Suppliers
          </h2>
          <p className="mt-0.5 truncate pl-10 text-xs text-gray-300">Contacts, terms and ordering details</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button size="sm" variant="outline" onClick={() => navigate('/app/costs?categories=open')} className="h-10 rounded-xl border-white/30 bg-white/10 px-3 font-bold text-white hover:bg-white/20 hover:text-white">Categories</Button>
        <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
          setIsAddDialogOpen(open);
          if (!open) setEditingSupplier(null);
        }}>
          <DialogTrigger asChild>
            <Button size="sm" className="h-10 shrink-0 rounded-xl bg-[#F5D62E] px-4 font-bold text-[#303A43] hover:bg-[#E9C900]">
              <Plus className="w-4 h-4 mr-1" />
              Add supplier
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-4xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}</DialogTitle>
              <DialogDescription>
                {editingSupplier ? 'Update supplier information' : 'Add a new supplier to your network'}
              </DialogDescription>
            </DialogHeader>
            <form key={editingSupplierData?.id || 'new-supplier'} onSubmit={handleAddSupplier} className="space-y-4">
              <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
                <div className="mb-4 flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-gray-500">
                  <FileText className="h-4 w-4 text-[#B58B00]" />
                  Supplier and contact information
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1.5 md:col-span-2">
                    <Label htmlFor="name">Supplier name *</Label>
                    <Input id="name" name="name" required defaultValue={editingSupplierData?.name} placeholder="US Foods" />
                  </div>
                  <SupplierCategoryField initialValue={editingSupplierData?.category} options={supplierCategoryOptions} />
                  <div className="space-y-1.5">
                    <Label htmlFor="paymentTerms">Payment terms</Label>
                    <Input id="paymentTerms" name="paymentTerms" defaultValue={editingSupplierData?.paymentTerms} placeholder="Net 30" />
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <Label htmlFor="contactPerson">Contact person</Label>
                    <Input id="contactPerson" name="contactPerson" defaultValue={editingSupplierData?.contactPerson} placeholder="John Smith" />
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <Label htmlFor="email">Supplier order email</Label>
                    <Input id="email" name="email" type="email" defaultValue={editingSupplierData?.email} placeholder="orders@supplier.com" />
                  </div>
                  <div className="space-y-2 rounded-xl border border-[#F5D62E]/60 bg-[#FFFBE7] p-3 md:col-span-2">
                    <Label htmlFor="ccEmails" className="flex items-center gap-2 font-bold text-[#303A43]">
                      <Mail className="h-4 w-4 text-[#B58B00]" />
                      CC team members on every order
                    </Label>
                    <Input id="ccEmails" name="ccEmails" defaultValue={editingSupplierData?.ccEmails?.join(', ')} placeholder="souschef@restaurant.ca, manager@restaurant.ca" className="bg-white" />
                    <p className="text-xs leading-5 text-gray-600">Add as many addresses as needed, separated by commas. You can still change them before sending an individual order.</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="phone">Phone</Label>
                    <Input id="phone" name="phone" type="tel" defaultValue={editingSupplierData?.phone} placeholder="(555) 123-4567" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="address">Address</Label>
                    <Input id="address" name="address" defaultValue={editingSupplierData?.address} placeholder="Toronto, ON" />
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <Label htmlFor="notes">Notes</Label>
                    <textarea id="notes" name="notes" defaultValue={editingSupplierData?.notes} rows={3} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" placeholder="Delivery days, minimum order, cutoff time..." />
                  </div>
                </div>
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
                <Button type="submit" className="bg-[#303A43] hover:bg-[#1E293B] text-white">
                  {editingSupplier ? 'Update' : 'Add'} Supplier
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-[#F5D62E]/50 bg-[#FFFBE7] px-4 py-2.5 text-xs text-[#303A43] shadow-sm">
        <Truck className="h-4 w-4 shrink-0 text-[#B58B00]" />
        <span>Supplier contacts and ordering details. Select a supplier to view more.</span>
      </div>

      {/* Suppliers List */}
      <div className="space-y-2">
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
              <Card
                key={supplier.id}
                className={`gap-0 overflow-hidden rounded-xl bg-white shadow-sm transition-colors ${isExpanded ? 'border-[#F5D62E]' : 'border-gray-200 hover:border-[#F5D62E]/70'}`}
              >
                <div className="flex items-stretch">
                  <button
                    type="button"
                    aria-expanded={isExpanded}
                    aria-controls={`supplier-details-${supplier.id}`}
                    className="min-w-0 flex-1 px-4 py-3 text-left transition-colors hover:bg-[#FFFBE7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#F5D62E]"
                    onClick={() => toggleSupplier(supplier.id)}
                  >
                    <div className="flex items-center gap-2.5">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 shrink-0 text-[#B58B00]" />
                        ) : (
                          <ChevronRight className="h-4 w-4 shrink-0 text-gray-500" />
                        )}
                        <div className="min-w-0">
                          <CardTitle className="truncate text-sm font-bold">{supplier.name}</CardTitle>
                          <div className="mt-1 flex items-center gap-2">
                            <Badge className="h-5 bg-[#FEF9C3] px-2 text-[11px] font-semibold text-[#1E3A5F]">
                              {supplier.category}
                            </Badge>
                            <span className="hidden text-xs text-gray-500 sm:inline">Contact details</span>
                          </div>
                        </div>
                    </div>
                  </button>
                  <div className="flex shrink-0 items-center gap-1.5 p-2">
                      <Button
                        size="sm"
                        variant="outline"
                        aria-label={`Edit ${supplier.name}`}
                        className="h-9 w-9 rounded-lg p-0"
                        onClick={() => handleEdit(supplier)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        aria-label={`Delete ${supplier.name}`}
                        className="h-9 w-9 rounded-lg p-0"
                        onClick={() => handleDelete(supplier.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-red-600" />
                      </Button>
                  </div>
                </div>

                {isExpanded && (
                  <CardContent id={`supplier-details-${supplier.id}`} className="border-t border-[#F5D62E]/40 px-4 py-2.5">
                    <div className="rounded-lg bg-gray-50 px-3 py-2.5">
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-[1.35fr_1.55fr_1fr_1fr_.75fr]">
                        <div className="min-w-0 text-[13px]">
                          <span className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                            <UserRound className="h-3.5 w-3.5 shrink-0 text-gray-400" /> Contact
                          </span>
                          <span className="block truncate text-gray-900">{supplier.contactPerson || '—'}</span>
                        </div>
                        <div className="min-w-0 text-[13px]">
                          <span className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                            <Mail className="h-3.5 w-3.5 shrink-0 text-gray-400" /> Email
                          </span>
                          {supplier.email ? (
                          <a href={`mailto:${supplier.email}`} className="truncate text-[#2563EB] hover:underline">
                            {supplier.email}
                          </a>
                          ) : <span className="text-gray-400">—</span>}
                        </div>
                        <div className="min-w-0 text-[13px]">
                          <span className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                            <Phone className="h-3.5 w-3.5 shrink-0 text-gray-400" /> Phone
                          </span>
                          {supplier.phone ? (
                          <a href={`tel:${supplier.phone}`} className="text-[#2563EB] hover:underline">
                            {supplier.phone}
                          </a>
                          ) : <span className="text-gray-400">—</span>}
                        </div>
                        <div className="min-w-0 text-[13px]">
                          <span className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                            <MapPin className="h-3.5 w-3.5 shrink-0 text-gray-400" /> Address
                          </span>
                          <span className="block truncate text-gray-900">{supplier.address || '—'}</span>
                        </div>
                        <div className="min-w-0 text-[13px]">
                          <span className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                            <DollarSign className="h-3.5 w-3.5 shrink-0 text-gray-400" /> Terms
                          </span>
                          <span className="block truncate text-gray-900">{supplier.paymentTerms || '—'}</span>
                        </div>
                      </div>
                      {supplier.ccEmails && supplier.ccEmails.length > 0 && (
                        <div className="mt-2 grid min-w-0 grid-cols-[92px_minmax(0,1fr)] items-start gap-3 border-t border-gray-200 pt-2 text-[13px]">
                          <span className="flex items-center gap-1.5 font-semibold text-gray-500">
                            <Mail className="h-3.5 w-3.5 shrink-0 text-[#B58B00]" />
                            CC
                          </span>
                          <span className="min-w-0 break-words text-gray-900">{supplier.ccEmails.join(', ')}</span>
                        </div>
                      )}
                      {supplier.notes && (
                        <div className="mt-2 grid min-w-0 grid-cols-[92px_minmax(0,1fr)] items-start gap-3 border-t border-gray-200 pt-2 text-[13px]">
                          <span className="font-semibold text-gray-500">Notes</span>
                          <span className="text-gray-900">{supplier.notes}</span>
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
