import { lazy } from "react";
const UsageVariance = lazy(() => import("./pages/UsageVariance").then(module => ({ default: module.UsageVariance })));
import { createBrowserRouter, Navigate, useLocation } from "react-router";
import { RouteError } from "./components/RouteError";

const Landing = lazy(() => import("./pages/Landing").then(module => ({ default: module.Landing })));
const Login = lazy(() => import("./pages/Login").then(module => ({ default: module.Login })));
const Terms = lazy(() => import("./pages/Terms").then(module => ({ default: module.Terms })));
const Privacy = lazy(() => import("./pages/Privacy").then(module => ({ default: module.Privacy })));
const AITransparency = lazy(() => import("./pages/LegalPages").then(module => ({ default: module.AITransparency })));
const CookiePolicy = lazy(() => import("./pages/LegalPages").then(module => ({ default: module.CookiePolicy })));
const LegalCenter = lazy(() => import("./pages/LegalPages").then(module => ({ default: module.LegalCenter })));
const Subprocessors = lazy(() => import("./pages/LegalPages").then(module => ({ default: module.Subprocessors })));
const BookDemo = lazy(() => import("./pages/BookDemo").then(module => ({ default: module.BookDemo })));
const BookDemoThankYou = lazy(() => import("./pages/BookDemo").then(module => ({ default: module.BookDemoThankYou })));
const MultiLocationSeo = lazy(() => import("./pages/RestaurantSeoPages").then(module => ({ default: module.MultiLocationSeo })));
const PosIntegrationsSeo = lazy(() => import("./pages/RestaurantSeoPages").then(module => ({ default: module.PosIntegrationsSeo })));
const RestaurantBeverageSeo = lazy(() => import("./pages/RestaurantSeoPages").then(module => ({ default: module.RestaurantBeverageSeo })));
const RestaurantFoodCostSeo = lazy(() => import("./pages/RestaurantSeoPages").then(module => ({ default: module.RestaurantFoodCostSeo })));
const RestaurantInventorySeo = lazy(() => import("./pages/RestaurantSeoPages").then(module => ({ default: module.RestaurantInventorySeo })));
const RestaurantInvoiceScannerSeo = lazy(() => import("./pages/RestaurantSeoPages").then(module => ({ default: module.RestaurantInvoiceScannerSeo })));
const RestaurantLabourSeo = lazy(() => import("./pages/RestaurantSeoPages").then(module => ({ default: module.RestaurantLabourSeo })));
const RestaurantOrderingSeo = lazy(() => import("./pages/RestaurantSeoPages").then(module => ({ default: module.RestaurantOrderingSeo })));
const CanadianOwnedPage = lazy(() => import("./pages/PublicMarketingPages").then(module => ({ default: module.CanadianOwnedPage })));
const CapabilitiesPage = lazy(() => import("./pages/PublicMarketingPages").then(module => ({ default: module.CapabilitiesPage })));
const PricingPage = lazy(() => import("./pages/PublicMarketingPages").then(module => ({ default: module.PricingPage })));
const ProductTourPage = lazy(() => import("./pages/PublicMarketingPages").then(module => ({ default: module.ProductTourPage })));
const PublicContactPage = lazy(() => import("./pages/PublicMarketingPages").then(module => ({ default: module.PublicContactPage })));
const RestaurantFoodCostCalculator = lazy(() => import("./pages/RestaurantSeoGuides").then(module => ({ default: module.RestaurantFoodCostCalculator })));
const RestaurantInventoryBuyerGuide = lazy(() => import("./pages/RestaurantSeoGuides").then(module => ({ default: module.RestaurantInventoryBuyerGuide })));
const RestaurantInventoryManagementGuide = lazy(() => import("./pages/RestaurantSeoGuides").then(module => ({ default: module.RestaurantInventoryManagementGuide })));

const Account = lazy(() => import("./pages/Account").then(module => ({ default: module.Account })));
const AuthLayout = lazy(() => import("./components/AuthLayout").then(module => ({ default: module.AuthLayout })));
const BeverageCosting = lazy(() => import("./pages/BeverageCosting").then(module => ({ default: module.BeverageCosting })));
const Contact = lazy(() => import("./pages/Contact").then(module => ({ default: module.Contact })));
const CostBreakdown = lazy(() => import("./pages/CostBreakdown").then(module => ({ default: module.CostBreakdown })));
const Dashboard = lazy(() => import("./pages/Dashboard").then(module => ({ default: module.Dashboard })));
const EmployeeApp = lazy(() => import("./pages/EmployeeApp").then(module => ({ default: module.EmployeeApp })));
const Forecasting = lazy(() => import("./pages/Forecasting").then(module => ({ default: module.Forecasting })));
const Help = lazy(() => import("./pages/Help").then(module => ({ default: module.Help })));
const Integrations = lazy(() => import("./pages/Integrations").then(module => ({ default: module.Integrations })));
const Inventory = lazy(() => import("./pages/Inventory").then(module => ({ default: module.Inventory })));
const InventoryCountEditor = lazy(() => import("./pages/InventoryCountEditor").then(module => ({ default: module.InventoryCountEditor })));
const InventoryDetail = lazy(() => import("./pages/InventoryDetail").then(module => ({ default: module.InventoryDetail })));
const InvoiceScanner = lazy(() => import("./pages/InvoiceScanner").then(module => ({ default: module.InvoiceScanner })));
const Invoices = lazy(() => import("./pages/Invoices").then(module => ({ default: module.Invoices })));
const LaborEmployeeForm = lazy(() => import("./pages/LaborEmployeeForm").then(module => ({ default: module.LaborEmployeeForm })));
const LaborScheduling = lazy(() => import("./pages/LaborScheduling").then(module => ({ default: module.LaborScheduling })));
const Layout = lazy(() => import("./components/Layout").then(module => ({ default: module.Layout })));
const Mfa = lazy(() => import("./pages/Mfa").then(module => ({ default: module.Mfa })));
const Notifications = lazy(() => import("./pages/Notifications").then(module => ({ default: module.Notifications })));
const Onboarding = lazy(() => import("./pages/Onboarding").then(module => ({ default: module.Onboarding })));
const OrderAlarms = lazy(() => import("./pages/OrderAlarms").then(module => ({ default: module.OrderAlarms })));
const Orders = lazy(() => import("./pages/Orders").then(module => ({ default: module.Orders })));
const Payment = lazy(() => import("./pages/Payment").then(module => ({ default: module.Payment })));
const PaymentMethod = lazy(() => import("./pages/PaymentMethod").then(module => ({ default: module.PaymentMethod })));
const PlatformAdmin = lazy(() => import("./pages/PlatformAdmin").then(module => ({ default: module.PlatformAdmin })));
const PrivateAppProviders = lazy(() => import("./components/PrivateAppProviders").then(module => ({ default: module.PrivateAppProviders })));
const Recipes = lazy(() => import("./pages/Recipes").then(module => ({ default: module.Recipes })));
const ResetPassword = lazy(() => import("./pages/ResetPassword").then(module => ({ default: module.ResetPassword })));
const Suppliers = lazy(() => import("./pages/Suppliers").then(module => ({ default: module.Suppliers })));
const Users = lazy(() => import("./pages/Users").then(module => ({ default: module.Users })));
const Waste = lazy(() => import("./pages/Waste").then(module => ({ default: module.Waste })));

const isEmployeeNativeBuild = import.meta.env.VITE_APP_VARIANT === 'employee';
function NativeEntry() { return <Navigate to="/employee" replace />; }
function PublicTermsRedirect() { return <Navigate to="/terms" replace />; }
function PublicPrivacyRedirect() { return <Navigate to="/privacy" replace />; }
function LegacyAIOrdersRedirect() { return <Navigate to="/app/orders" replace />; }
function LegacyCogsRedirect() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  params.set('view', 'cogs');
  return <Navigate to={`/app/costs?${params.toString()}`} replace />;
}

export const router = createBrowserRouter([
  {
    path: "/",
    Component: isEmployeeNativeBuild ? NativeEntry : Landing,
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
    path: "/book-demo/thank-you",
    Component: BookDemoThankYou,
  },
  {
    path: "/product-tour",
    Component: ProductTourPage,
  },
  {
    path: "/capabilities",
    Component: CapabilitiesPage,
  },
  {
    path: "/pricing",
    Component: PricingPage,
  },
  {
    path: "/contact",
    Component: PublicContactPage,
  },
  {
    path: "/canadian-owned",
    Component: CanadianOwnedPage,
  },
  {
    path: "/best-restaurant-inventory-management-software-canada",
    Component: RestaurantInventoryBuyerGuide,
  },
  {
    path: "/restaurant-inventory-management-guide",
    Component: RestaurantInventoryManagementGuide,
  },
  {
    path: "/restaurant-food-cost-calculator",
    Component: RestaurantFoodCostCalculator,
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
    path: "/multi-location-restaurant-software",
    Component: MultiLocationSeo,
  },
  {
    path: "/restaurant-pos-integrations",
    Component: PosIntegrationsSeo,
  },
  {
    path: "/reset-password",
    Component: ResetPassword,
  },
  {
    path: "/mfa",
    Component: Mfa,
  },
  {
    path: "/employee",
    Component: AuthLayout,
    children: [{ Component: PrivateAppProviders, children: [{ index: true, Component: EmployeeApp }] }],
  },
  {
    path: "/app",
    Component: AuthLayout,
    ErrorBoundary: RouteError,
    children: [
      {
        Component: PrivateAppProviders,
        children: [{
          Component: Layout,
          children: [
            { index: true, Component: Dashboard },
          { path: "dashboard", Component: Dashboard },
          { path: "onboarding", Component: Onboarding },
          { path: "labor", Component: LaborScheduling },
          { path: "labor/employees/new", Component: LaborEmployeeForm },
          { path: "labor/employees/:employeeId", Component: LaborEmployeeForm },
          { path: "waste", Component: Waste },
          { path: "beverages", Component: BeverageCosting },
          { path: "inventory", Component: Inventory },
          { path: "inventory/counts/:countId", Component: InventoryCountEditor },
          { path: "inventory/:id", Component: InventoryDetail },
          { path: "recipes", Component: Recipes },
          { path: "forecasting", Component: Forecasting },
          { path: "orders", Component: Orders },
          { path: "invoices", Component: Invoices },
          { path: "ai-orders", Component: LegacyAIOrdersRedirect },
          { path: "costs", Component: CostBreakdown },
          { path: "usage-variance", Component: UsageVariance },
          { path: "cogs", Component: LegacyCogsRedirect },
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
          { path: "terms", Component: PublicTermsRedirect },
          { path: "privacy", Component: PublicPrivacyRedirect },
          ],
        }],
      },
    ],
  },
]);

if (typeof window !== "undefined") {
  let currentPath = window.location.pathname;
  router.subscribe(({ location }) => {
    if (location.pathname === currentPath) return;
    currentPath = location.pathname;
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: "auto" }));
  });
}
