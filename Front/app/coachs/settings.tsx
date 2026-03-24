import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Switch } from 'react-native';
import { crossAlert } from '@/services/crossAlert';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { clearSession } from '@/services/authStorage';

const SettingsScreen = () => {
  const router = useRouter();
  const [notifications, setNotifications] = useState(true);
  const [biometric, setBiometric] = useState(false);

  const handleLogout = () => {
    crossAlert("Log Out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Log Out", style: "destructive", onPress: async () => {
          await clearSession();
          router.replace('/(tabs)/login');
      }}
    ]);
  };

  const SettingItem = ({ icon, title, value, onPress, isLast = false, color = "white" }: any) => (
    <TouchableOpacity 
        style={[styles.item, isLast && { borderBottomWidth: 0 }]} 
        onPress={onPress}
        disabled={!onPress}
    >
      <View style={styles.itemLeft}>
        <Ionicons name={icon} size={22} color={color} style={{ width: 30 }} />
        <Text style={[styles.itemTitle, { color: color }]}>{title}</Text>
      </View>
      {value !== undefined ? (
        <Text style={styles.itemValue}>{value}</Text>
      ) : (
        onPress && <Ionicons name="chevron-forward" size={20} color="#555" />
      )}
    </TouchableOpacity>
  );

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false} keyboardDismissMode="on-drag">
      <Text style={styles.mainTitle}>App Settings</Text>

      <Text style={styles.sectionLabel}>ACCOUNT & SECURITY</Text>
      <View style={styles.sectionCard}>
        <SettingItem icon="person-outline" title="Personal Information" onPress={() => {}} />
        <SettingItem icon="lock-closed-outline" title="Change Password" onPress={() => {}} />
        <View style={styles.item}>
            <View style={styles.itemLeft}>
                <Ionicons name="finger-print-outline" size={22} color="white" style={{ width: 30 }} />
                <Text style={styles.itemTitle}>Face ID / Biometrics</Text>
            </View>
            <Switch value={biometric} onValueChange={setBiometric} trackColor={{ false: "#767577", true: "#3498DB" }} />
        </View>
        <SettingItem icon="mail-outline" title="Notification Email" value="Active" isLast />
      </View>

      <Text style={styles.sectionLabel}>COACHING PREFERENCES</Text>
      <View style={styles.sectionCard}>
        <View style={styles.item}>
            <View style={styles.itemLeft}>
                <Ionicons name="notifications-outline" size={22} color="white" style={{ width: 30 }} />
                <Text style={styles.itemTitle}>Client Activity Alerts</Text>
            </View>
            <Switch value={notifications} onValueChange={setNotifications} trackColor={{ false: "#767577", true: "#3498DB" }} />
        </View>
        <SettingItem icon="globe-outline" title="App Language" value="English" onPress={() => {}} />
        <SettingItem icon="fitness-outline" title="Measurement Units" value="kg / cm" isLast onPress={() => {}} />
      </View>

      <Text style={styles.sectionLabel}>SUPPORT</Text>
      <View style={styles.sectionCard}>
        <SettingItem icon="help-circle-outline" title="Help Center" onPress={() => {}} />
        <SettingItem icon="document-text-outline" title="Terms of Service" onPress={() => {}} isLast />
      </View>

      <Text style={styles.sectionLabel}>DANGER ZONE</Text>
      <View style={styles.sectionCard}>
        <SettingItem 
            icon="log-out-outline" 
            title="Sign Out" 
            color="#e74c3c" 
            onPress={handleLogout} 
            isLast 
        />
      </View>

      <View style={{ height: 100 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1A1F2B', padding: 16 },
  mainTitle: { fontSize: 24, fontWeight: 'bold', color: 'white', marginBottom: 25, marginTop: 10 },
  sectionLabel: { color: '#888', fontSize: 12, fontWeight: 'bold', marginBottom: 8, marginLeft: 5, letterSpacing: 1 },
  sectionCard: { backgroundColor: '#2A4562', borderRadius: 15, marginBottom: 25, overflow: 'hidden' },
  item: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    padding: 16, 
    borderBottomWidth: 1, 
    borderBottomColor: 'rgba(255,255,255,0.05)' 
  },
  itemLeft: { flexDirection: 'row', alignItems: 'center' },
  itemTitle: { color: 'white', fontSize: 15, marginLeft: 10 },
  itemValue: { color: '#3498DB', fontSize: 14, fontWeight: '600' },
  version: { textAlign: 'center', color: '#555', fontSize: 11, marginTop: 10 }
});

export default SettingsScreen;