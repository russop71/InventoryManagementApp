import { useInventory } from '../contexts/InventoryContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { DollarSign, TrendingUp, TrendingDown } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

export function CostBreakdown() {
  const { inventory, orders, forecasts } = useInventory();

  // Calculate total inventory value
  const totalInventoryValue = inventory.reduce(
    (sum, item) => sum + (item.currentStock * item.unitCost),
    0
  );

  // Calculate costs by category
  const categoryData = inventory.reduce((acc, item) => {
    const existing = acc.find(c => c.name === item.category);
    const value = item.currentStock * item.unitCost;
    if (existing) {
      existing.value += value;
    } else {
      acc.push({
        name: item.category,
        value: value,
      });
    }
    return acc;
  }, [] as { name: string; value: number }[]);

  // Calculate order costs by month
  const ordersByMonth = orders.reduce((acc, order) => {
    const month = new Date(order.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    const existing = acc.find(m => m.month === month);
    if (existing) {
      existing.value += order.totalCost;
      existing.count += 1;
    } else {
      acc.push({
        month,
        value: order.totalCost,
        count: 1,
      });
    }
    return acc;
  }, [] as { month: string; value: number; count: number }[]);

  // Calculate total orders cost
  const totalOrdersCost = orders.reduce((sum, order) => sum + order.totalCost, 0);
  const averageOrderCost = orders.length > 0 ? totalOrdersCost / orders.length : 0;

  // Most expensive items
  const expensiveItems = [...inventory]
    .sort((a, b) => (b.currentStock * b.unitCost) - (a.currentStock * a.unitCost))
    .slice(0, 5);

  // Supplier breakdown
  const supplierData = inventory.reduce((acc, item) => {
    const existing = acc.find(s => s.supplier === item.supplier);
    const value = item.currentStock * item.unitCost;
    if (existing) {
      existing.value += value;
      existing.items += 1;
    } else {
      acc.push({
        supplier: item.supplier,
        value: value,
        items: 1,
      });
    }
    return acc;
  }, [] as { supplier: string; value: number; items: number }[]);

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Cost Breakdown</h2>
        <p className="text-sm text-gray-600 mt-1">Analyze your costs</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Inventory Value</CardTitle>
            <DollarSign className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalInventoryValue.toFixed(2)}</div>
            <p className="text-xs text-gray-500 mt-1">
              Across {inventory.length} items
            </p>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium">Total Orders</CardTitle>
              <TrendingUp className="h-4 w-4 text-gray-500" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">${totalOrdersCost.toFixed(2)}</div>
              <p className="text-xs text-gray-500 mt-1">
                {orders.length} orders
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium">Avg Order</CardTitle>
              <TrendingDown className="h-4 w-4 text-gray-500" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">${averageOrderCost.toFixed(2)}</div>
              <p className="text-xs text-gray-500 mt-1">
                Per order
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Charts */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cost by Category</CardTitle>
          </CardHeader>
          <CardContent>
            {categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `$${Number(value).toFixed(2)}`} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-gray-500 text-sm">
                No data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Orders by Month</CardTitle>
          </CardHeader>
          <CardContent>
            {ordersByMonth.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={ordersByMonth}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value) => `$${Number(value).toFixed(2)}`} />
                  <Bar dataKey="value" fill="#3b82f6" name="Cost ($)" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-gray-500 text-sm">
                No orders yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tables */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Most Expensive Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {expensiveItems.map((item, index) => {
                const totalValue = item.currentStock * item.unitCost;
                const percentage = (totalValue / totalInventoryValue) * 100;
                
                return (
                  <div key={item.id} className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex items-start flex-1">
                        <div className="w-6 h-6 rounded-full bg-[#FEF9C3] text-[#2563EB] flex items-center justify-center text-xs font-medium mr-2 flex-shrink-0 mt-0.5">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-sm text-gray-900">{item.name}</p>
                          <p className="text-xs text-gray-500">
                            {item.currentStock} {item.unit} @ ${item.unitCost.toFixed(2)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-sm text-gray-900">${totalValue.toFixed(2)}</p>
                        <p className="text-xs text-gray-500">{percentage.toFixed(1)}%</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cost by Supplier</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {supplierData.sort((a, b) => b.value - a.value).map((supplier, index) => {
                const percentage = (supplier.value / totalInventoryValue) * 100;
                
                return (
                  <div key={supplier.supplier} className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex items-start flex-1">
                        <div 
                          className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium text-white mr-2 flex-shrink-0 mt-0.5"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        >
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-sm text-gray-900">{supplier.supplier}</p>
                          <p className="text-xs text-gray-500">
                            {supplier.items} items
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-sm text-gray-900">${supplier.value.toFixed(2)}</p>
                        <p className="text-xs text-gray-500">{percentage.toFixed(1)}%</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}