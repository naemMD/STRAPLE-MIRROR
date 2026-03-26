import { Stack, router, useSegments } from "expo-router";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState, useEffect, useCallback } from "react";
import api from "../../services/api";

export default function ClientLayout() {
  const segments = useSegments();
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await api.get("/messages/unread-count");
      setUnreadCount(res.data.unread_count || 0);
    } catch {}
  }, []);

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 10000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);
  
  // 🔥 On récupère LE nom exact de la page actuelle (ex: "search-coach")
  const currentPage = segments[segments.length - 1];

  // Pages où le header NUTRITRAIN a juste une flèche retour
  const isSpecialPage = currentPage === "profile" || currentPage === "subscription";

  // 🔥 Pages 100% custom : On CACHE complètement le header NUTRITRAIN et le Footer
  const hideGlobalElements = 
    currentPage === "search-coach" || 
    currentPage === "map-search" || 
    currentPage === "coach-public-profile";

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={{ flex: 1, backgroundColor: "#0D1117" }}>

        {/* --- HEADER NUTRITRAIN (Caché sur la recherche et les profils) --- */}
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

            <Text style={styles.appName}>
              <Text style={styles.appNameBlue}>NUTRI</Text>
              <Text style={styles.appNameWhite}>TRAIN</Text>
            </Text>

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
              <Ionicons name="people" size={26} color={currentPage === "forum" ? "#3498DB" : "white"} />
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.push("/clients/settings")}>
              <Ionicons name="settings" size={26} color={currentPage === "settings" ? "#3498DB" : "white"} />
            </TouchableOpacity>
          </View>
        )}

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