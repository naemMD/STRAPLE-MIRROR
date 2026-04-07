import { Stack, router, usePathname } from "expo-router";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import StapleLogo from "@/components/StapleLogo";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState, useEffect, useCallback } from "react";
import api from "../../services/api";
import { getToken } from "../../services/authStorage";

export default function CoachLayout() {
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);
  const [authChecked, setAuthChecked] = useState(false);

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

  const isSpecialPage =
    pathname === "/coachs/profile" ||
    pathname === "/coachs/subscription" ||
    pathname === "/coachs/client-details";

  const hideGlobalHeader = pathname === "/coachs/client-details";

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={{ flex: 1, backgroundColor: "#0D1117" }}>

        {!hideGlobalHeader && (
          <View style={styles.header}>
            
            {isSpecialPage ? (
              <TouchableOpacity onPress={() => router.back()}>
                <Ionicons name="arrow-back" size={28} color="white" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={() => router.push("/coachs/profile")}>
                <View style={styles.profilePlaceholder}>
                  <Ionicons name="person" size={20} color="white" />
                </View>
              </TouchableOpacity>
            )}

            {/* TITLE */}
            <View style={{ alignItems: 'center' }}>
              <StapleLogo fontSize={22} />
              <Text style={{ color: '#888', fontSize: 7, letterSpacing: 1, marginTop: 2 }}>TRAIN SMART, LIVE STRONG</Text>
            </View>

            {/* RIGHT SIDE: Subscription Star */}
            {isSpecialPage ? (
              <View style={{ width: 30 }} /> 
            ) : (
              <TouchableOpacity 
                style={styles.starButton}
                onPress={() => router.push("/coachs/subscription")}
              >
                <Ionicons name="star" size={28} color="#EAEA45" />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* PAGE CONTENT */}
        <View style={{ flex: 1 }}>
          {/* On garde un seul Stack ici pour afficher les pages */}
          <Stack screenOptions={{ headerShown: false }} />
        </View>

        {/* FOOTER */}
        {!isSpecialPage && (
          <View style={styles.footer}>
            <TouchableOpacity onPress={() => router.push("/coachs/home")}>
              <Ionicons name="home" size={26} color={pathname === "/coachs/home" ? "#3498DB" : "white"} />
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.push("/coachs/client-list")}>
              <Ionicons name="people" size={26} color={pathname === "/coachs/client-list" ? "#3498DB" : "white"} />
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.push("/coachs/message-list")} style={{ position: "relative" }}>
              <Ionicons name="chatbubbles" size={26} color={pathname === "/coachs/message-list" ? "#3498DB" : "white"} />
              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadCount > 99 ? "99+" : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.push("/coachs/forum")}>
              <Ionicons name="newspaper" size={26} color={pathname === "/coachs/forum" ? "#3498DB" : "white"} />
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.push("/coachs/settings")}>
              <Ionicons name="settings" size={26} color={pathname === "/coachs/settings" ? "#3498DB" : "white"} />
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
  appName: { fontSize: 22, fontWeight: "bold" },
  appNameBlue: { color: "#3498DB" },
  appNameWhite: { color: "#FFFFFF" },
  profilePlaceholder: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#2A4562",
    justifyContent: 'center',
    alignItems: 'center'
  },
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
    height: 75,
    backgroundColor: "#161B22",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#222",
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
});