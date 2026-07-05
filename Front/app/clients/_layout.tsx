import { Stack, router, useSegments } from "expo-router";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import StapleLogo from "@/components/StapleLogo";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState, useEffect, useCallback } from "react";
import api from "../../services/api";
import { getToken } from "../../services/authStorage";
import FeedbackModal from "@/components/FeedbackModal";
import { useFeedbackPrompt } from "@/hooks/useFeedbackPrompt";

export default function ClientLayout() {
  const segments = useSegments();
  const [unreadCount, setUnreadCount] = useState(0);
  const [authChecked, setAuthChecked] = useState(false);
  const feedback = useFeedbackPrompt();

  useEffect(() => {
    const checkAuth = async () => {
      const token = await getToken();
      if (!token) {
        router.replace("/(tabs)/login");
        return;
      }
      setAuthChecked(true);
    };
    checkAuth();
  }, []);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await api.get("/messages/unread-count");
      setUnreadCount(res.data.unread_count || 0);
    } catch {}
  }, []);

  useEffect(() => {
    if (!authChecked) return;
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 10000);
    return () => clearInterval(interval);
  }, [authChecked, fetchUnreadCount]);

  if (!authChecked) {
    return (
      <View style={{ flex: 1, backgroundColor: "#0D1117", justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#3498DB" />
      </View>
    );
  }
  
  // 🔥 On récupère LE nom exact de la page actuelle (ex: "search-coach")
  const currentPage = segments[segments.length - 1];

  // Pages où le header STAPLE a juste une flèche retour
  const isSpecialPage = currentPage === "profile" || currentPage === "subscription";

  // 🔥 Pages 100% custom : On CACHE complètement le header STAPLE et le Footer
  const hideGlobalElements = 
    currentPage === "search-coach" || 
    currentPage === "map-search" || 
    currentPage === "coach-public-profile";

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={{ flex: 1, backgroundColor: "#0D1117" }}>

        {/* --- HEADER STAPLE (Caché sur la recherche et les profils) --- */}
        {!hideGlobalElements && (
          <View style={styles.header}>
            
            {isSpecialPage ? (
              <TouchableOpacity onPress={() => router.back()}>
                <Ionicons name="arrow-back" size={28} color="white" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={() => router.push("/clients/profile")}>
                <View style={styles.profilePlaceholder}>
                  <Ionicons name="person" size={20} color="white" />
                </View>
              </TouchableOpacity>
            )}

            <View style={{ alignItems: 'center' }}>
              <StapleLogo fontSize={22} />
              <Text style={{ color: '#888', fontSize: 7, letterSpacing: 1, marginTop: 2 }}>TRAIN SMART, LIVE STRONG</Text>
            </View>

            {isSpecialPage ? (
              <View style={{ width: 30 }} />
            ) : (
              <TouchableOpacity 
                style={styles.starButton}
                onPress={() => router.push("/clients/subscription")}
              >
                <Ionicons name="star" size={28} color="#EAEA45" />
              </TouchableOpacity>
            )}

          </View>
        )}

        {/* --- LE CONTENU DE LA PAGE --- */}
        <View style={{ flex: 1 }}>
          <Stack screenOptions={{ headerShown: false }} />
        </View>

        {/* --- LE FOOTER (Caché aussi pour un effet plein écran) --- */}
        {!hideGlobalElements && (
          <View style={styles.footer}>
            <TouchableOpacity onPress={() => router.push("/clients/home")}>
              <Ionicons name="home" size={26} color={currentPage === "home" ? "#3498DB" : "white"} />
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.push("/clients/trainings")}>
              <Ionicons name="barbell" size={26} color={currentPage === "trainings" ? "#3498DB" : "white"} />
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.push("/clients/coach")} style={{ position: "relative" }}>
              <Ionicons name="chatbubbles" size={26} color={currentPage === "coach" ? "#3498DB" : "white"} />
              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadCount > 99 ? "99+" : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.push("/clients/forum")}>
              <Ionicons name="newspaper" size={26} color={currentPage === "forum" ? "#3498DB" : "white"} />
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.push("/clients/settings")}>
              <Ionicons name="settings" size={26} color={currentPage === "settings" ? "#3498DB" : "white"} />
            </TouchableOpacity>
          </View>
        )}

        {/* In-app satisfaction survey (auto-opens after a few usage days) */}
        <FeedbackModal
          visible={feedback.visible}
          onSubmitted={feedback.markDone}
          onSnooze={feedback.snooze}
        />

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#161B22" },
  header: {
    height: 70,
    paddingHorizontal: 20,
    backgroundColor: "#161B22",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  profilePlaceholder: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#2A4562",
    justifyContent: 'center',
    alignItems: 'center'
  },
  appName: { fontSize: 22, fontWeight: "bold" },
  appNameBlue: { color: "#3498DB" },
  appNameWhite: { color: "#FFFFFF" },
  starButton: { padding: 5 },
  badge: {
    position: "absolute",
    top: -6,
    right: -10,
    backgroundColor: "#E74C3C",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  badgeText: {
    color: "white",
    fontSize: 11,
    fontWeight: "bold",
  },
  footer: {
    height: 70,
    backgroundColor: "#161B22",
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#222",
  },
});