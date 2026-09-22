import { useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";

import { Home } from "@/pages/home";
import { ProductPage } from "@/pages/product";
import { ProductsPage } from "@/pages/products";
import { CategoryPage } from "@/pages/category";
import { ComparePage } from "@/pages/compare";
import { CompareBar } from "@/components/compare-bar";
import { CartPage } from "@/pages/cart";
import { CheckoutPage } from "@/pages/checkout";
import { WishlistPage } from "@/pages/wishlist";
import { SearchPage } from "@/pages/search";
import { ContactPage } from "@/pages/contact";
import { LoginPage } from "@/pages/login";
import { SignupPage } from "@/pages/signup";
import { NotFoundPage } from "@/pages/not-found";
import { PrivacyPolicyPage } from "@/pages/legal/privacy-policy";
import { TermsOfServicePage } from "@/pages/legal/terms-of-service";
import { RefundPolicyPage } from "@/pages/legal/refund-policy";
import { ShippingPolicyPage } from "@/pages/legal/shipping-policy";
import { AdminLoginPage } from "@/pages/admin/login";
import { AdminProductsPage } from "@/pages/admin/products";
import { AdminProductFormPage } from "@/pages/admin/product-form";
import { AdminCategoriesPage } from "@/pages/admin/categories";
import { AdminCategoryFormPage } from "@/pages/admin/category-form";
import { AdminUsersPage } from "@/pages/admin/users";
import { AdminUserFormPage } from "@/pages/admin/user-form";
import { AdminRolesPage } from "@/pages/admin/roles";
import { AdminRoleFormPage } from "@/pages/admin/role-form";

function ScrollManager() {
  const location = useLocation();

  useEffect(() => {
    if (location.hash) {
      const el = document.getElementById(location.hash.slice(1));
      if (el) {
        el.scrollIntoView({ behavior: "smooth" });
        return;
      }
    }
    window.scrollTo(0, 0);
  }, [location.pathname, location.hash]);

  return null;
}

function App() {
  return (
    <>
      <ScrollManager />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/product/:handle" element={<ProductPage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/compare" element={<ComparePage />} />
        <Route path="/category/:slug" element={<CategoryPage />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/wishlist" element={<WishlistPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
        <Route path="/terms-of-service" element={<TermsOfServicePage />} />
        <Route path="/refund-policy" element={<RefundPolicyPage />} />
        <Route path="/shipping-policy" element={<ShippingPolicyPage />} />

        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/admin" element={<AdminProductsPage />} />
        <Route path="/admin/products" element={<AdminProductsPage />} />
        <Route path="/admin/products/new" element={<AdminProductFormPage />} />
        <Route path="/admin/products/:handle/edit" element={<AdminProductFormPage />} />
        <Route path="/admin/categories" element={<AdminCategoriesPage />} />
        <Route path="/admin/categories/new" element={<AdminCategoryFormPage />} />
        <Route path="/admin/categories/:slug/edit" element={<AdminCategoryFormPage />} />
        <Route path="/admin/users" element={<AdminUsersPage />} />
        <Route path="/admin/users/new" element={<AdminUserFormPage />} />
        <Route path="/admin/users/:id/edit" element={<AdminUserFormPage />} />
        <Route path="/admin/roles" element={<AdminRolesPage />} />
        <Route path="/admin/roles/new" element={<AdminRoleFormPage />} />
        <Route path="/admin/roles/:id/edit" element={<AdminRoleFormPage />} />

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      <CompareBar />
    </>
  );
}

export default App;
