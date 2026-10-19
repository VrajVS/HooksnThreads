import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { GradientButton } from "@/components/gradient-button";
import { ApiError, api } from "@/lib/api";
import type { CartLine } from "@/pages/checkout";

declare global {
  interface Window {
    Razorpay: any;
  }
}

interface RazorpayCheckoutProps {
  items: CartLine[];
  addressId: number;
  notes: string | null;
  total: number;
  onOrderPlaced: (orderId: number) => void;
  email?: string;
  phone?: string;
}

export function RazorpayCheckout({ items, addressId, notes, total, email, phone, onOrderPlaced }: RazorpayCheckoutProps) {
  const [loading, setLoading] = useState(false);

  const handlePayment = async () => {
    setLoading(true);
    try {
      // Create Razorpay order
      const razorpayOrder = await api.post<{ razorpay_order_id: string; amount: number; key_id: string }>(
        "/orders/razorpay-order",
        {
          address_id: addressId,
          notes: notes,
          items: items,
        }
      );

      // Load Razorpay script
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => {
        const options = {
          key: razorpayOrder.key_id,
          amount: razorpayOrder.amount,
          currency: "INR",
          order_id: razorpayOrder.razorpay_order_id,
          handler: async (response: {
            razorpay_order_id: string;
            razorpay_payment_id: string;
            razorpay_signature: string;
          }) => {
            try {
              // Verify payment and create order
              const result = await api.post<{ id: number }>(
                "/orders/verify-payment",
                {
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                  address_id: addressId,
                  notes: notes,
                  items: items,
                }
              );
              toast.success("Payment successful! Your order has been placed.");
              onOrderPlaced(result.id);
            } catch (err) {
              toast.error(err instanceof ApiError ? err.message : "Payment verification failed");
              setLoading(false);
            }
          },
          prefill: {
            email: email || "",
            contact: phone || "",
          },
          theme: {
            color: "#hsl(151 87% 14%)",
          },
        };

        const rzp = new window.Razorpay(options);
        rzp.open();
        setLoading(false);
      };
      document.body.appendChild(script);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to initiate payment");
      setLoading(false);
    }
  };

  return (
    <GradientButton onClick={handlePayment} disabled={loading} className="w-full h-11 text-base">
      {loading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Processing...
        </>
      ) : (
        `Pay ₹${total} with Razorpay`
      )}
    </GradientButton>
  );
}
