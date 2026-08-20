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
import { Landing } from "./pages/Landing";
import { ResetPassword } from "./pages/ResetPassword";
import { PlatformAdmin } from "./pages/PlatformAdmin";
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
    path: "/reset-password",
    Component: ResetPassword,
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
