import { useState, useEffect } from 'react';
import { useInventory } from '../contexts/InventoryContext';
import { useToast } from '../contexts/ToastContext';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Plus, ChefHat, DollarSign, Trash2, Edit, RefreshCw, Camera } from 'lucide-react';
import { toast as showToast } from 'sonner';
import { RecipeScan } from '../components/RecipeScan';

export function Recipes() {
  const { inventory, recipes, addRecipe, updateRecipe, deleteRecipe, syncToastMenuItems } = useInventory();
  const { isConnected, menuItems } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isScanOpen, setIsScanOpen] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<string | null>(null);
  const [selectedIngredients, setSelectedIngredients] = useState<{
    inventoryItemId: string;
    quantity: number;
    unit: string;
  }[]>([]);
  const [modifiers, setModifiers] = useState<{
    name: string;
    ingredientChanges: { inventoryItemId: string; quantity: number }[];
  }[]>([]);
  const [scannedRecipeData, setScannedRecipeData] = useState<{
    menuItemName: string;
    category: string;
    price: number;
    ingredients: string[];
  } | null>(null);

  // Sync Toast menu items on mount if connected
  useEffect(() => {
    if (isConnected && menuItems.length > 0) {
      const hasToastRecipes = recipes.some(r => r.source === 'toast');
      if (!hasToastRecipes) {
        handleSyncToastItems();
      }
    }
  }, [isConnected, menuItems]);

  const handleSyncToastItems = () => {
    if (!isConnected) {
      showToast.error('Please connect to Toast POS first');
      return;
    }

    // Remove old Toast recipes
    const manualRecipes = recipes.filter(r => r.source !== 'toast');
    
    // Map Toast menu items to recipes
    const toastRecipes = menuItems.map(item => {
      const recipeId = `toast-${item.id}-${Date.now()}`;
      return {
        id: recipeId,
        menuItemName: item.name,
        category: item.category,
        price: item.price,
        ingredients: item.ingredients.map(ing => {
          const invItem = inventory.find(i => i.id === ing.inventoryItemId);
          return {
            inventoryItemId: ing.inventoryItemId,
            quantity: ing.quantity,
            unit: invItem?.unit || 'lbs'
          };
        }),
        source: 'toast' as const,
        externalId: item.id,
      };
    });

    // Combine manual and Toast recipes
    const allRecipes = [...manualRecipes, ...toastRecipes];
    
    // Update recipes in context
    allRecipes.forEach((recipe, index) => {
      if (recipe.source === 'toast' && !recipes.find(r => r.id === recipe.id)) {
        addRecipe(recipe);
      }
    });

    showToast.success(`Synced ${toastRecipes.length} menu items from Toast`);
  };

  const handleAddIngredient = (itemId: string) => {
    const item = inventory.find(i => i.id === itemId);
    if (!item) return;

    if (selectedIngredients.find(ing => ing.inventoryItemId === itemId)) {
      showToast.error('Ingredient already added');
      return;
    }

    setSelectedIngredients([
      ...selectedIngredients,
      { inventoryItemId: itemId, quantity: 0, unit: item.unit }
    ]);
  };

  const handleUpdateIngredientQuantity = (itemId: string, quantity: number) => {
    setSelectedIngredients(
      selectedIngredients.map(ing =>
        ing.inventoryItemId === itemId ? { ...ing, quantity } : ing
      )
    );
  };

  const handleRemoveIngredient = (itemId: string) => {
    setSelectedIngredients(selectedIngredients.filter(ing => ing.inventoryItemId !== itemId));
  };

  const handleAddModifier = () => {
    setModifiers([...modifiers, { name: '', ingredientChanges: [] }]);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const recipe = {
      menuItemName: formData.get('menuItemName') as string,
      category: formData.get('category') as string,
      price: Number(formData.get('price')),
      ingredients: selectedIngredients,
      modifiers: modifiers.filter(m => m.name && m.ingredientChanges.length > 0),
    };

    if (editingRecipe) {
      updateRecipe(editingRecipe, recipe);
      showToast.success('Recipe updated successfully');
    } else {
      addRecipe(recipe);
      showToast.success('Recipe added successfully');
    }

    setIsDialogOpen(false);
    setSelectedIngredients([]);
    setModifiers([]);
    setEditingRecipe(null);
    e.currentTarget.reset();
  };

  const handleEditRecipe = (recipeId: string) => {
    const recipe = recipes.find(r => r.id === recipeId);
    if (!recipe) return;

    setEditingRecipe(recipeId);
    setSelectedIngredients(recipe.ingredients);
    setModifiers(recipe.modifiers || []);
    setIsDialogOpen(true);
  };

  const handleDeleteRecipe = (recipeId: string, name: string) => {
    if (confirm(`Delete "${name}"? This cannot be undone.`)) {
      deleteRecipe(recipeId);
      showToast.success('Recipe deleted');
    }
  };

  const calculateRecipeCost = (recipeId: string) => {
    const recipe = recipes.find(r => r.id === recipeId);
    if (!recipe) return 0;

    return recipe.ingredients.reduce((total, ingredient) => {
      const item = inventory.find(i => i.id === ingredient.inventoryItemId);
      if (!item) return total;
      return total + (ingredient.quantity * item.unitCost);
    }, 0);
  };

  const handleRecipeScanned = (scannedData: {
    menuItemName: string;
    category: string;
    price: number;
    ingredients: string[];
  }) => {
    // Save scanned data and open regular dialog to map ingredients
    setScannedRecipeData(scannedData);
    setIsScanOpen(false);
    setIsDialogOpen(true);
    showToast.success('Recipe scanned! Now map ingredients to inventory items.');
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">Recipe Builder</h2>
          <p className="text-sm text-gray-600 mt-1">Define menu items & costs</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setEditingRecipe(null);
            setSelectedIngredients([]);
            setModifiers([]);
          }
        }}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-[#0F172A] hover:bg-[#1E293B] text-white">
              <Plus className="w-4 h-4 mr-1" />
              New
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[calc(100vw-2rem)] max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingRecipe ? 'Edit Recipe' : 'Create Recipe'}
              </DialogTitle>
              <DialogDescription>
                {editingRecipe ? 'Edit the recipe details below.' : 'Add a new recipe to your menu.'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="menuItemName">Menu Item Name</Label>
                <Input
                  id="menuItemName"
                  name="menuItemName"
                  required
                  placeholder="e.g., Chicken Sandwich"
                  defaultValue={
                    editingRecipe 
                      ? recipes.find(r => r.id === editingRecipe)?.menuItemName 
                      : scannedRecipeData?.menuItemName || ''
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="category">Category</Label>
                  <Input
                    id="category"
                    name="category"
                    required
                    placeholder="e.g., Entrees"
                    defaultValue={
                      editingRecipe 
                        ? recipes.find(r => r.id === editingRecipe)?.category 
                        : scannedRecipeData?.category || ''
                    }
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
                    placeholder="15.99"
                    defaultValue={
                      editingRecipe 
                        ? recipes.find(r => r.id === editingRecipe)?.price 
                        : scannedRecipeData?.price || ''
                    }
                  />
                </div>
              </div>

              {scannedRecipeData && (
                <Card className="bg-purple-50 border-purple-200">
                  <CardContent className="py-3">
                    <p className="text-sm font-medium text-purple-900 mb-2">
                      📸 Scanned Ingredients
                    </p>
                    <div className="space-y-1">
                      {scannedRecipeData.ingredients.map((ing, idx) => (
                        <p key={idx} className="text-xs text-purple-700">• {ing}</p>
                      ))}
                    </div>
                    <p className="text-xs text-purple-600 mt-2">
                      Match these to your inventory items below
                    </p>
                  </CardContent>
                </Card>
              )}

              <div>
                <Label>🧾 Ingredients</Label>
                <div className="mt-2 space-y-2">
                  <select
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    onChange={(e) => {
                      handleAddIngredient(e.target.value);
                      e.target.value = '';
                    }}
                    value=""
                  >
                    <option value="">➕ Add ingredient...</option>
                    {inventory.map(item => (
                      <option key={item.id} value={item.id}>
                        {item.name} ({item.unit}) - ${item.unitCost.toFixed(2)}
                      </option>
                    ))}
                  </select>

                  {selectedIngredients.length > 0 && (
                    <div className="border border-gray-200 rounded-md divide-y">
                      {selectedIngredients.map(ingredient => {
                        const item = inventory.find(i => i.id === ingredient.inventoryItemId);
                        if (!item) return null;

                        const cost = ingredient.quantity * item.unitCost;

                        return (
                          <div key={ingredient.inventoryItemId} className="p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <p className="font-medium text-sm">{item.name}</p>
                                <p className="text-xs text-gray-500">
                                  ${item.unitCost.toFixed(2)} per {item.unit}
                                </p>
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleRemoveIngredient(ingredient.inventoryItemId)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="Qty"
                                value={ingredient.quantity || ''}
                                onChange={(e) =>
                                  handleUpdateIngredientQuantity(
                                    ingredient.inventoryItemId,
                                    Number(e.target.value)
                                  )
                                }
                                className="flex-1"
                              />
                              <span className="text-sm text-gray-500 w-16">{item.unit}</span>
                              <span className="text-sm font-semibold text-gray-700 w-20 text-right">
                                ${cost.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {selectedIngredients.length > 0 && (
                    <div className="bg-[#FEFCE8] border border-[#F5C10E]/30 rounded p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-[#0F172A]">Total Cost</span>
                        <span className="text-lg font-bold text-[#0F172A]">
                          ${selectedIngredients.reduce((sum, ing) => {
                            const item = inventory.find(i => i.id === ing.inventoryItemId);
                            return sum + (item ? ing.quantity * item.unitCost : 0);
                          }, 0).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsDialogOpen(false);
                    setEditingRecipe(null);
                    setSelectedIngredients([]);
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={selectedIngredients.length === 0} className="bg-[#0F172A] hover:bg-[#1E293B] text-white disabled:bg-gray-400 disabled:hover:bg-gray-400">
                  {editingRecipe ? 'Update Recipe' : 'Create Recipe'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Recipe Scan Banner */}
      <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
                <Camera className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-semibold text-purple-900">Scan Recipe Card</p>
                <p className="text-xs text-purple-700 mt-0.5">
                  Take a photo to extract ingredients automatically
                </p>
              </div>
            </div>
            <Button
              size="sm"
              className="bg-purple-600 hover:bg-purple-700 text-white"
              onClick={() => setIsScanOpen(true)}
            >
              <Camera className="w-4 h-4 mr-1" />
              Scan
            </Button>
          </div>
        </CardContent>
      </Card>

      <RecipeScan
        isOpen={isScanOpen}
        onClose={() => setIsScanOpen(false)}
        onRecipeExtracted={handleRecipeScanned}
      />

      {/* Toast Sync Banner */}
      {isConnected && (
        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-orange-500 rounded flex items-center justify-center">
                  <span className="text-white font-bold text-sm">T</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-orange-900">Toast POS Connected</p>
                  <p className="text-xs text-orange-700">{menuItems.length} menu items available</p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="bg-white border-orange-300 text-orange-700 hover:bg-orange-50"
                onClick={handleSyncToastItems}
              >
                <RefreshCw className="w-4 h-4 mr-1" />
                Sync
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {recipes.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <ChefHat className="w-12 h-12 text-gray-400 mb-4" />
              <p className="text-gray-500 text-center text-sm">
                No recipes yet. Create your first recipe to start tracking costs.
              </p>
            </CardContent>
          </Card>
        ) : (
          recipes.map(recipe => {
            const recipeCost = calculateRecipeCost(recipe.id);
            const profitMargin = recipe.price - recipeCost;
            const profitPercentage = (profitMargin / recipe.price) * 100;

            return (
              <Card key={recipe.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <CardTitle className="text-base">{recipe.menuItemName}</CardTitle>
                        {recipe.source === 'toast' && (
                          <Badge className="bg-orange-500 text-white text-xs">
                            Toast
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">{recipe.category}</p>
                    </div>
                    <Badge className="bg-green-100 text-green-800">
                      ${recipe.price.toFixed(2)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Cost Breakdown */}
                  <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Food Cost</span>
                      <span className="font-semibold text-gray-900">${recipeCost.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Menu Price</span>
                      <span className="font-semibold text-gray-900">${recipe.price.toFixed(2)}</span>
                    </div>
                    <div className="pt-2 border-t border-gray-200">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">Profit Margin</span>
                        <div className="text-right">
                          <p className="font-bold text-green-600">${profitMargin.toFixed(2)}</p>
                          <p className="text-xs text-gray-500">{profitPercentage.toFixed(1)}%</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Ingredients */}
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">Ingredients</p>
                    <div className="space-y-1">
                      {recipe.ingredients.map(ingredient => {
                        const item = inventory.find(i => i.id === ingredient.inventoryItemId);
                        if (!item) return null;

                        return (
                          <div
                            key={ingredient.inventoryItemId}
                            className="flex items-center justify-between text-sm py-1"
                          >
                            <span className="text-gray-700">{item.name}</span>
                            <span className="text-gray-500">
                              {ingredient.quantity} {ingredient.unit}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Modifiers */}
                  {recipe.modifiers && recipe.modifiers.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-2">Modifiers</p>
                      <div className="space-y-1">
                        {recipe.modifiers.map((modifier, index) => (
                          <div key={index} className="text-sm text-gray-600">
                            • {modifier.name}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex space-x-2 pt-2 border-t">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => handleEditRecipe(recipe.id)}
                    >
                      <Edit className="w-4 h-4 mr-1" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDeleteRecipe(recipe.id, recipe.menuItemName)}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}