import { useCallback } from "react";
import { useNavigate } from "react-router-dom";

import { type CartItem, useCart } from "@/context/cart-context";

/**
 * Puts the item in the cart (at least `quantity` of it, without piling onto an
 * existing line) and goes straight to checkout.
 */
export function useBuyNow() {
  const { items, addItem, updateQuantity } = useCart();
  const navigate = useNavigate();

  return useCallback(
    (item: Omit<CartItem, "quantity">, quantity = 1) => {
      const existing = items.find((i) => i.handle === item.handle);
      if (!existing) addItem(item, quantity);
      else if (existing.quantity < quantity) updateQuantity(item.handle, quantity);
      navigate("/checkout");
    },
    [items, addItem, updateQuantity, navigate],
  );
}
