import type { ReactNode } from "react";
import { Route, Switch } from "wouter";
import { Layout } from "./components/Layout";
import { CartProvider } from "./context/CartContext";
import { AuthProvider } from "./context/AuthContext";
import { CatalogProvider } from "./context/CatalogContext";
import { AdminGuard } from "./components/AdminGuard";
import { AdminLayout } from "./components/AdminLayout";
import { CartPage } from "./pages/CartPage";
import { ProductPage } from "./pages/ProductPage";
import { ShopPage } from "./pages/ShopPage";
import { SuccessPage } from "./pages/SuccessPage";
import { GalleryPage } from "./pages/GalleryPage";
import { AboutPage } from "./pages/AboutPage";
import { ComingSoonPage } from "./pages/ComingSoonPage";
import { ECOMMERCE_ENABLED } from "./config/features";
import { LoginPage } from "./pages/admin/LoginPage";
import { ForgotPasswordPage } from "./pages/admin/ForgotPasswordPage";
import { ResetPasswordPage } from "./pages/admin/ResetPasswordPage";
import { DashboardPage } from "./pages/admin/DashboardPage";
import { PaintingsPage } from "./pages/admin/PaintingsPage";
import { PaintingFormPage } from "./pages/admin/PaintingFormPage";
import { OrdersPage } from "./pages/admin/OrdersPage";
import { OrderDetailPage } from "./pages/admin/OrderDetailPage";
import { ScrollRestoration } from "./components/ScrollRestoration";
import "./App.css";

function ProtectedAdminPage({ page }: { page: ReactNode }) {
  return (
    <AdminGuard>
      <AdminLayout>{page}</AdminLayout>
    </AdminGuard>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <CatalogProvider>
        <CartProvider>
          <ScrollRestoration />
          <Switch>
            <Route path="/admin/login" component={LoginPage} />
            <Route
              path="/admin/forgot-password"
              component={ForgotPasswordPage}
            />
            <Route path="/admin/reset-password" component={ResetPasswordPage} />
            <Route path="/admin/paintings/new">
              <ProtectedAdminPage page={<PaintingFormPage />} />
            </Route>
            <Route path="/admin/paintings/:id/edit">
              <ProtectedAdminPage page={<PaintingFormPage />} />
            </Route>
            <Route path="/admin/paintings">
              <ProtectedAdminPage page={<PaintingsPage />} />
            </Route>
            <Route path="/admin/orders/:id">
              <ProtectedAdminPage page={<OrderDetailPage />} />
            </Route>
            <Route path="/admin/orders">
              <ProtectedAdminPage page={<OrdersPage />} />
            </Route>
            <Route path="/admin">
              <ProtectedAdminPage page={<DashboardPage />} />
            </Route>
            <Route>
              {() => (
                <Layout>
                  <Switch>
                    <Route path="/" component={ShopPage} />
                    <Route path="/about" component={AboutPage} />
                    <Route path="/available">
                      <GalleryPage category="available" />
                    </Route>
                    <Route path="/sold">
                      <GalleryPage category="sold" />
                    </Route>
                    <Route path="/projects">
                      <GalleryPage category="project" />
                    </Route>
                    <Route path="/work/:slug" component={ProductPage} />
                    <Route
                      path="/cart"
                      component={ECOMMERCE_ENABLED ? CartPage : ComingSoonPage}
                    />
                    <Route
                      path="/checkout"
                      component={ECOMMERCE_ENABLED ? CartPage : ComingSoonPage}
                    />
                    <Route
                      path="/success"
                      component={
                        ECOMMERCE_ENABLED ? SuccessPage : ComingSoonPage
                      }
                    />
                    <Route component={ShopPage} />
                  </Switch>
                </Layout>
              )}
            </Route>
          </Switch>
        </CartProvider>
      </CatalogProvider>
    </AuthProvider>
  );
}
