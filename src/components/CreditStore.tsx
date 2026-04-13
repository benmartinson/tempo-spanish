import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useSelector, useDispatch } from "react-redux";
import { useAuth } from "@clerk/clerk-expo";
import Constants from "expo-constants";
import SlideModal from "./common/SlideModal";
import { RootState } from "../types";
import { useSupabaseWithClerk } from "../../utils/supabase";
import { addUserCredits } from "../requests";
import { setUserCredits } from "../store/actions/dataActions";

const isExpoGo = Constants.appOwnership === "expo";

const CREDIT_PACKS = [
  { id: "tempo_credits_500", credits: 500, price: "$2.99", hours: "~2 hours of speaking practice" },
  { id: "tempo_credits_1000", credits: 1000, price: "$4.99", hours: "~4 hours of speaking practice" },
  { id: "tempo_credits_5000", credits: 5000, price: "$14.99", hours: "~20 hours of speaking practice" },
  { id: "tempo_credits_10000", credits: 10000, price: "$19.99", hours: "~40 hours of speaking practice" },
];

const CREDIT_AMOUNTS: Record<string, number> = Object.fromEntries(
  CREDIT_PACKS.map((p) => [p.id, p.credits]),
);

interface IAPProduct {
  productId: string;
  localizedPrice: string;
}

interface CreditStoreProps {
  visible: boolean;
  onClose: () => void;
}

const CreditStore: React.FC<CreditStoreProps> = ({ visible, onClose }) => {
  const dispatch = useDispatch();
  const supabase = useSupabaseWithClerk();
  const { userId } = useAuth();
  const userCredits = useSelector((state: RootState) => state.userCredits);
  const [isLoading, setIsLoading] = useState(false);

  // IAP state (only used in real builds)
  const [iapProducts, setIapProducts] = useState<IAPProduct[]>([]);
  const [iapModule, setIapModule] = useState<any>(null);

  // Dynamically load expo-iap only in real builds when modal is visible
  useEffect(() => {
    if (isExpoGo || !visible) return;

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
        setIapProducts(items as unknown as IAPProduct[]);

        purchaseUpdateSub = IAP.purchaseUpdatedListener(
          async (purchase: any) => {
            try {
              const credits = CREDIT_AMOUNTS[purchase.productId] ?? 0;
              if (credits > 0) {
                const newCredits = await addUserCredits({
                  supabase,
                  userId,
                  amount: credits,
                });
                dispatch(setUserCredits(newCredits));
              }
              await IAP.finishTransaction({ purchase, isConsumable: true });
            } catch (err) {
              console.error("Error finishing transaction:", err);
            }
          },
        );

        purchaseErrorSub = IAP.purchaseErrorListener((error: any) => {
          if (error.code !== "E_USER_CANCELLED") {
            console.error("Purchase error:", error.message);
          }
        });
      } catch (err) {
        console.warn("IAP init error:", err);
      }
    };

    init();

    return () => {
      purchaseUpdateSub?.remove();
      purchaseErrorSub?.remove();
      import("expo-iap")
        .then((IAP) => IAP.endConnection())
        .catch(() => {});
    };
  }, [visible]);

  const handleDevPurchase = async (credits: number) => {
    setIsLoading(true);
    try {
      const newCredits = await addUserCredits({
        supabase,
        userId,
        amount: credits,
      });
      dispatch(setUserCredits(newCredits));
    } catch (err) {
      console.error("Dev purchase error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleIAPPurchase = async (productId: string) => {
    if (!iapModule) return;
    setIsLoading(true);
    try {
      await iapModule.requestPurchase({
        request: { sku: productId },
        type: "in-app",
      });
    } catch (err) {
      console.error("Purchase request error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const renderIAPProducts = () => {
    if (iapProducts.length === 0) {
      return (
        <Text style={styles.emptyText}>
          Loading credit packs...
        </Text>
      );
    }

    return iapProducts.map((product) => {
      const pack = CREDIT_PACKS.find((p) => p.id === product.productId);
      const credits = CREDIT_AMOUNTS[product.productId] ?? 0;
      return (
        <TouchableOpacity
          key={product.productId}
          style={styles.productRow}
          onPress={() => handleIAPPurchase(product.productId)}
          disabled={isLoading}
          activeOpacity={0.7}
        >
          <View style={styles.productInfo}>
            <Text style={styles.productCredits}>
              {credits.toLocaleString()} credits
            </Text>
            <Text style={styles.productHours}>{pack?.hours}</Text>
          </View>
          <Text style={styles.productPrice}>{product.localizedPrice}</Text>
        </TouchableOpacity>
      );
    });
  };

  const renderDevProducts = () => (
    <>
      {CREDIT_PACKS.map((pack) => (
        <TouchableOpacity
          key={pack.id}
          style={styles.productRow}
          onPress={() => handleDevPurchase(pack.credits)}
          disabled={isLoading}
          activeOpacity={0.7}
        >
          <View style={styles.productInfo}>
            <Text style={styles.productCredits}>
              {pack.credits.toLocaleString()} credits
            </Text>
            <Text style={styles.productHours}>{pack.hours}</Text>
          </View>
          <Text style={styles.productPrice}>{pack.price}</Text>
        </TouchableOpacity>
      ))}
    </>
  );

  return (
    <SlideModal visible={visible} onRequestClose={onClose} title="Buy Credits">
      <View style={styles.container}>
        <View style={styles.balanceCard}>
          <MaterialIcons name="token" size={32} color="#5a5680" />
          <Text style={styles.balanceLabel}>Current Balance</Text>
          <Text style={styles.balanceValue}>{userCredits} credits</Text>
        </View>

        <Text style={styles.sectionHeader}>Credit Packs</Text>

        {isExpoGo ? renderDevProducts() : renderIAPProducts()}

        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#4a69bd" />
            <Text style={styles.loadingText}>
              {isExpoGo ? "Adding credits..." : "Processing purchase..."}
            </Text>
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
});

export default CreditStore;
