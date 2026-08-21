import { createBrowserRouter } from "react-router";
import { Dashboard } from "./pages/Dashboard";
import { Inventory } from "./pages/Inventory";
import { InventoryDetail } from "./pages/InventoryDetail";
import { InventoryCountEditor } from "./pages/InventoryCountEditor";
import { Recipes } from "./pages/Recipes";
import { Forecasting } from "./pages/Forecasting";
import { Orders } from "./pages/Orders";
import { AIOrders } from "./pages/AIOrders";
import { Invoices } from "./pages/Invoices";
import { CostBreakdown } from "./pages/CostBreakdown";
import { COGSBreakdown } from "./pages/COGSBreakdown";
import { Integrations } from "./pages/Integrations";
import { InvoiceScanner } from "./pages/InvoiceScanner";
import { Suppliers } from "./pages/Suppliers";
import { Login } from "./pages/Login";
import { Users } from "./pages/Users";
import { Account } from "./pages/Account";
import { PaymentMethod } from "./pages/PaymentMethod";
import { Payment } from "./pages/Payment";
import { Notifications } from "./pages/Notifications";
import { OrderAlarms } from "./pages/OrderAlarms";
import { Help } from "./pages/Help";
import { Contact } from "./pages/Contact";
import { Terms } from "./pages/Terms";
import { Privacy } from "./pages/Privacy";
import { AITransparency, CookiePolicy, LegalCenter, Subprocessors } from "./pages/LegalPages";
import { Landing } from "./pages/Landing";
import { ResetPassword } from "./pages/ResetPassword";
import { PlatformAdmin } from "./pages/PlatformAdmin";
import { Onboarding } from "./pages/Onboarding";
import { LaborScheduling } from "./pages/LaborScheduling";
import { EmployeeApp } from "./pages/EmployeeApp";
import { BeverageCosting } from "./pages/BeverageCosting";
import { BookDemo } from "./pages/BookDemo";
import { RestaurantBeverageSeo, RestaurantFoodCostSeo, RestaurantInventorySeo, RestaurantInvoiceScannerSeo, RestaurantLabourSeo, RestaurantOrderingSeo } from "./pages/RestaurantSeoPages";
import { Layout } from "./components/Layout";
import { AuthLayout } from "./components/AuthLayout";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Landing,
  },
  {
    path: "/login",
    Component: Login,
  },
  {
    path: "/book-demo",
    Component: BookDemo,
  },
  {
    path: "/privacy",
    Component: Privacy,
  },
  {
    path: "/terms",
    Component: Terms,
  },
  {
    path: "/legal",
    Component: LegalCenter,
  },
  {
    path: "/cookies",
    Component: CookiePolicy,
  },
  {
    path: "/ai-transparency",
    Component: AITransparency,
  },
  {
    path: "/subprocessors",
    Component: Subprocessors,
  },
  {
    path: "/restaurant-inventory-management-software",
    Component: RestaurantInventorySeo,
  },
  {
    path: "/restaurant-food-cost-software",
    Component: RestaurantFoodCostSeo,
  },
  {
    path: "/restaurant-invoice-scanner",
    Component: RestaurantInvoiceScannerSeo,
  },
  {
    path: "/restaurant-labour-scheduling-software",
    Component: RestaurantLabourSeo,
  },
  {
    path: "/restaurant-beverage-costing-software",
    Component: RestaurantBeverageSeo,
  },
  {
    path: "/restaurant-ordering-forecasting-software",
    Component: RestaurantOrderingSeo,
  },
  {
    path: "/reset-password",
    Component: ResetPassword,
  },
  {
    path: "/employee",
    Component: AuthLayout,
    children: [{ index: true, Component: EmployeeApp }],
  },
  {
    path: "/app",
    Component: AuthLayout,
    children: [
      {
        Component: Layout,
        children: [
          { index: true, Component: Dashboard },
          { path: "dashboard", Component: Dashboard },
          { path: "onboarding", Component: Onboarding },
          { path: "labor", Component: LaborScheduling },
          { path: "beverages", Component: BeverageCosting },
          { path: "inventory", Component: Inventory },
          { path: "inventory/counts/:countId", Component: InventoryCountEditor },
          { path: "inventory/:id", Component: InventoryDetail },
          { path: "recipes", Component: Recipes },
          { path: "forecasting", Component: Forecasting },
          { path: "orders", Component: Orders },
          { path: "invoices", Component: Invoices },
          { path: "ai-orders", Component: AIOrders },
          { path: "costs", Component: CostBreakdown },
          { path: "cogs", Component: COGSBreakdown },
          { path: "integrations", Component: Integrations },
          { path: "invoice-scanner", Component: InvoiceScanner },
          { path: "suppliers", Component: Suppliers },
          { path: "users", Component: Users },
          { path: "platform", Component: PlatformAdmin },
          { path: "account", Component: Account },
          { path: "payment-method", Component: PaymentMethod },
          { path: "payment", Component: Payment },
          { path: "notifications", Component: Notifications },
          { path: "order-alarms", Component: OrderAlarms },
          { path: "help", Component: Help },
          { path: "contact", Component: Contact },
          { path: "terms", Component: Terms },
          { path: "privacy", Component: Privacy },
        ],
      },
    ],
  },
]);
