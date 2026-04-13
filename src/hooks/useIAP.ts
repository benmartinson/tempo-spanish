import { useEffect, useState, useCallback } from "react";
import { Platform } from "react-native";
import Constants from "expo-constants";

const PRODUCT_IDS = [
  "tempo_credits_50",
  "tempo_credits_200",
  "tempo_credits_500",
];

const CREDIT_AMOUNTS: Record<string, number> = {
  tempo_credits_50: 50,
  tempo_credits_200: 200,
  tempo_credits_500: 500,
};

interface Product {
  productId: string;
  localizedPrice: string;
  title: string;
  description: string;
}

interface UseIAPResult {
  products: Product[];
  isLoading: boolean;
  purchase: (productId: string) => Promise<void>;
  getCreditAmount: (productId: string) => number;
  isAvailable: boolean;
}

// Check if we're in Expo Go (no native modules available)
const isExpoGo = Constants.appOwnership === "expo";

export const useIAP = (
  onPurchaseComplete?: (productId: string, credits: number) => void,
): UseIAPResult => {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "ios" || isExpoGo) return;

    let purchaseUpdateSubscription: { remove: () => void } | undefined;
    let purchaseErrorSubscription: { remove: () => void } | undefined;

    const init = async () => {
      try {
        // Dynamic import to avoid loading native modules in Expo Go
        const IAP = await import("react-native-iap");

        await IAP.initConnection();
        setIsAvailable(true);

        const items = await IAP.getProducts({ skus: PRODUCT_IDS });
        setProducts(items as unknown as Product[]);

        purchaseUpdateSubscription = IAP.purchaseUpdatedListener(
          async (purchase: any) => {
            try {
              const productId = purchase.productId;
              const credits = CREDIT_AMOUNTS[productId] ?? 0;

              if (credits > 0) {
                onPurchaseComplete?.(productId, credits);
              }

              await IAP.finishTransaction({ purchase });
            } catch (err) {
              console.error("Error finishing transaction:", err);
            }
          },
        );

        purchaseErrorSubscription = IAP.purchaseErrorListener((error: any) => {
          if (error.code !== "E_USER_CANCELLED") {
            console.error("Purchase error:", error.message);
          }
        });
      } catch (err) {
        console.warn("IAP init error (expected in Expo Go):", err);
      }
    };

    init();

    return () => {
      purchaseUpdateSubscription?.remove();
      purchaseErrorSubscription?.remove();
      import("react-native-iap")
        .then((IAP) => IAP.endConnection())
        .catch(() => {});
    };
  }, []);

  const purchase = useCallback(async (productId: string) => {
    if (isExpoGo) return;
    setIsLoading(true);
    try {
      const IAP = await import("react-native-iap");
      await IAP.requestPurchase({ sku: productId });
    } catch (err) {
      console.error("Purchase request error:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getCreditAmount = useCallback((productId: string) => {
    return CREDIT_AMOUNTS[productId] ?? 0;
  }, []);

  return { products, isLoading, purchase, getCreditAmount, isAvailable };
};
