import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useSelector, useDispatch } from "react-redux";
import SlideModal from "./common/SlideModal";
import { RootState } from "../types";
import { setUserCredits } from "../store/actions/dataActions";
import { backendFetch } from "../helpers/backendFetch";

const CREDIT_PACKS = [
  {
    id: "tempo_credits_1000",
    credits: 1000,
    price: "$2.99",
    hours: "~4 hours of speaking practice",
    name: "1,000 Tempo Credits",
    description:
      "About 4 hours of speaking practice for shadowing, transcription, and feedback.",
  },
  {
    id: "tempo_credits_5000",
    credits: 5000,
    price: "$6.99",
    hours: "~20 hours of speaking practice",
    name: "5,000 Tempo Credits",
    description:
      "About 20 hours of speaking practice for steady language training.",
  },
  {
    id: "tempo_credits_10000",
    credits: 10000,
    price: "$9.99",
    hours: "~40 hours of speaking practice",
    name: "10,000 Tempo Credits",
    description:
      "About 40 hours of speaking practice for extended language training.",
  },
];

const CREDIT_AMOUNTS: Record<string, number> = Object.fromEntries(
  CREDIT_PACKS.map((p) => [p.id, p.credits]),
);

interface IAPProduct {
  id: string;
  displayPrice: string;
}

interface CreditStoreProps {
  visible: boolean;
  onClose: () => void;
  checkoutSuccessCredits?: number | null;
}

const CreditStore: React.FC<CreditStoreProps> = ({
  visible,
  onClose,
  checkoutSuccessCredits,
}) => {
  const dispatch = useDispatch();
  const userCredits = useSelector((state: RootState) => state.userCredits);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!errorMessage) return;
    const timer = setTimeout(() => setErrorMessage(null), 5000);
    return () => clearTimeout(timer);
  }, [errorMessage]);

  // IAP state (only used in real builds)
  const [iapProducts, setIapProducts] = useState<IAPProduct[]>([]);
  const [iapModule, setIapModule] = useState<any>(null);
  const isWeb = Platform.OS === "web";

  // Dynamically load expo-iap only in real builds when modal is visible
  useEffect(() => {
    if (!visible || isWeb) return;

    let purchaseUpdateSub: { remove: () => void } | undefined;
    let purchaseErrorSub: { remove: () => void } | undefined;

    const init = async () => {
      try {
        const IAP = await import("expo-iap");
        setIapModule(IAP);

        await IAP.initConnection();
        const items = await IAP.fetchProducts({
          skus: Object.keys(CREDIT_AMOUNTS),
        });
        console.log("IAP fetched products:", JSON.stringify(items, null, 2));
        setIapProducts(items as unknown as IAPProduct[]);

        const safeFinish = async (purchase: any) => {
          try {
            await IAP.finishTransaction({ purchase, isConsumable: true });
          } catch (err) {
            // "Transaction not found" means Apple already finished it — benign.
            console.log("finishTransaction skipped:", err);
          }
        };

        purchaseUpdateSub = IAP.purchaseUpdatedListener(
          async (purchase: any) => {
            try {
              const response = await backendFetch("/api/verify-purchase", {
                method: "POST",
                body: JSON.stringify({
                  purchase_token: purchase.purchaseToken ?? "",
                  product_id: purchase.productId,
                }),
              });
              if (response.ok) {
                const data = await response.json();
                dispatch(setUserCredits(data.credits));
                await safeFinish(purchase);
              } else if (response.status === 409) {
                // Already processed previously (replay protection). Finish
                // the transaction so Apple stops redelivering it.
                await safeFinish(purchase);
              } else {
                console.error(
                  `verify-purchase failed: ${response.status} ${await response.text()}`,
                );
                setErrorMessage("Something went wrong");
              }
            } catch (err) {
              console.error("Error verifying purchase:", err);
              setErrorMessage("Something went wrong");
            }
          },
        );

        purchaseErrorSub = IAP.purchaseErrorListener((error: any) => {
          if (
            error.code === "user-cancelled" ||
            error.message === "Transaction not found"
          ) {
            return;
          }
          console.error("Purchase error:", error.message);
          setErrorMessage("Something went wrong");
        });
      } catch (err) {
        console.warn("IAP init error:", err);
      }
    };

    init();

    return () => {
      purchaseUpdateSub?.remove();
      purchaseErrorSub?.remove();
      import("expo-iap").then((IAP) => IAP.endConnection()).catch(() => {});
    };
  }, [visible, isWeb]);

  const handleIAPPurchase = async (productId: string) => {
    setErrorMessage(null);
    if (!iapModule) {
      setErrorMessage("Something went wrong");
      return;
    }
    setIsLoading(true);
    try {
      await iapModule.requestPurchase({
        request: {
          ios: { sku: productId },
          android: { skus: [productId] },
        },
        type: "in-app",
      });
    } catch (err) {
      console.error("Purchase request error:", err);
      setErrorMessage("Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  const getCheckoutReturnUrl = (
    status: "success" | "cancel",
    productId: string,
  ) => {
    if (typeof window === "undefined") return "";
    const url = new URL(window.location.href);
    url.searchParams.set("stripe_checkout", status);
    url.searchParams.set("stripe_product_id", productId);
    if (status === "success") {
      url.searchParams.set("stripe_session_id", "{CHECKOUT_SESSION_ID}");
    } else {
      url.searchParams.delete("stripe_session_id");
    }
    return url.toString();
  };

  const handleStripePurchase = async (productId: string) => {
    setErrorMessage(null);
    setIsLoading(true);
    try {
      const response = await backendFetch("/api/create-checkout-session", {
        method: "POST",
        body: JSON.stringify({
          product_id: productId,
          success_url: getCheckoutReturnUrl("success", productId),
          cancel_url: getCheckoutReturnUrl("cancel", productId),
        }),
      });

      if (!response.ok) {
        throw new Error(`${response.status} ${await response.text()}`);
      }

      const data = await response.json();
      if (!data.url) throw new Error("Checkout URL missing");
      window.location.assign(data.url);
    } catch (err) {
      console.error("Stripe checkout error:", err);
      setErrorMessage("Could not start checkout");
      setIsLoading(false);
    }
  };

  const renderProducts = () => {
    return CREDIT_PACKS.map((pack) => {
      const product = iapProducts.find((p) => p.id === pack.id);
      return (
        <TouchableOpacity
          key={pack.id}
          style={styles.productRow}
          onPress={() =>
            isWeb ? handleStripePurchase(pack.id) : handleIAPPurchase(pack.id)
          }
          disabled={isLoading}
          activeOpacity={0.7}
        >
          <View style={styles.productInfo}>
            <Text style={styles.productCredits}>
              {pack.credits.toLocaleString()} credits
            </Text>
            <Text style={styles.productHours}>{pack.hours}</Text>
          </View>
          <Text style={styles.productPrice}>
            {isWeb ? pack.price : (product?.displayPrice ?? pack.price)}
          </Text>
        </TouchableOpacity>
      );
    });
  };

  return (
    <SlideModal
      noBorderRadius={true}
      visible={visible}
      onRequestClose={onClose}
      title="Buy Credits"
    >
      <View style={styles.container}>
        <View style={styles.balanceCard}>
          <MaterialIcons name="token" size={32} color="#5a5680" />
          <Text style={styles.balanceLabel}>Current Balance</Text>
          <Text style={styles.balanceValue}>{userCredits} credits</Text>
          {checkoutSuccessCredits != null && (
            <View style={styles.successBanner}>
              <MaterialIcons name="check-circle" size={18} color="#217a4b" />
              <Text style={styles.successText}>
                You successfully purchased{" "}
                {checkoutSuccessCredits.toLocaleString()} credits
              </Text>
            </View>
          )}
        </View>

        <Text style={styles.sectionHeader}>Credit Packs</Text>

        {errorMessage && (
          <View style={styles.errorBanner}>
            <MaterialIcons name="error-outline" size={18} color="#c0392b" />
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        )}

        {renderProducts()}

        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#4a69bd" />
            <Text style={styles.loadingText}>Processing purchase...</Text>
          </View>
        )}

        <Text style={styles.infoText}>
          1 credit is used per recording submission. Credits never expire.
        </Text>
      </View>
    </SlideModal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f7",
    padding: 16,
  },
  balanceCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 24,
    alignItems: "center",
    gap: 8,
    marginBottom: 24,
  },
  balanceLabel: {
    fontSize: 14,
    color: "#8e8e93",
    fontWeight: "500",
  },
  balanceValue: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1a1a2e",
  },
  successBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#eaf6ef",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 4,
  },
  successText: {
    fontSize: 14,
    color: "#217a4b",
    fontWeight: "600",
    textAlign: "center",
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: "600",
    color: "#8e8e93",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  emptyText: {
    fontSize: 15,
    color: "#8e8e93",
    textAlign: "center",
    padding: 20,
  },
  productRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  productInfo: {
    gap: 4,
  },
  productCredits: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1a1a2e",
  },
  productHours: {
    fontSize: 13,
    color: "#8e8e93",
    fontWeight: "400",
  },
  productPrice: {
    fontSize: 14,
    color: "#8e8e93",
    fontWeight: "500",
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
  },
  loadingText: {
    fontSize: 14,
    color: "#666",
  },
  infoText: {
    fontSize: 13,
    color: "#8e8e93",
    textAlign: "center",
    marginTop: 20,
    lineHeight: 18,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fdecea",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: "#c0392b",
    fontWeight: "500",
  },
});

export default CreditStore;
