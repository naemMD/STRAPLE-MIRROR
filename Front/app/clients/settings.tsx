import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Switch, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { clearSession } from '@/services/authStorage';

const SettingsPage = () => {
  const router = useRouter();

  const [notifications, setNotifications] = useState({
    meals: true,
    coach: true,
    forum: true,
  });
  const [darkTheme, setDarkTheme] = useState(true);
  const [healthSync, setHealthSync] = useState(false);

  const handleLogout = () => {
    Alert.alert("Log Out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Log Out", style: "destructive", onPress: async () => {
          await clearSession();
          router.replace('/(tabs)/login');
      }}
    ]);
  };

  const toggleNotif = (key: keyof typeof notifications) => {
    setNotifications(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const SettingRow = ({ icon, title, value, onPress, isLast = false, color = "white", type = "chevron" }: any) => (
    <View style={[styles.item, isLast && { borderBottomWidth: 0 }]}>
      <TouchableOpacity 
        style={styles.itemLeft} 
        onPress={onPress} 
        disabled={type !== "chevron" || !onPress}
      >
        <Ionicons name={icon} size={22} color={color} style={{ width: 30 }} />
        <Text style={[styles.itemTitle, { color: color }]}>{title}</Text>
      </TouchableOpacity>
      
      {type === "switch" ? (
        <Switch 
            value={value} 
            onValueChange={onPress} 
            trackColor={{ false: "#767577", true: "#3498DB" }} 
            thumbColor="white"
        />
      ) : (
        <TouchableOpacity onPress={onPress} style={{flexDirection: 'row', alignItems: 'center'}}>
            {value && <Text style={styles.itemValue}>{value}</Text>}
            <Ionicons name="chevron-forward" size={18} color="#555" />
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <Text style={styles.mainTitle}>Settings</Text>

        <Text style={styles.sectionLabel}>PERSONAL DETAILS</Text>
        <View style={styles.sectionCard}>
          <SettingRow icon="person-outline" title="Edit Profile Info" onPress={() => {}} />
          <SettingRow icon="medical-outline" title="Health Metrics (BMI, Body Fat)" onPress={() => {}} />
          <SettingRow icon="lock-closed-outline" title="Change Password" onPress={() => {}} isLast />
        </View>

        <Text style={styles.sectionLabel}>NOTIFICATIONS</Text>
        <View style={styles.sectionCard}>
          <SettingRow 
            icon="restaurant-outline" 
            title="Meal Reminders" 
            type="switch" 
            value={notifications.meals} 
            onPress={() => toggleNotif('meals')} 
          />
          <SettingRow 
            icon="chatbubble-outline" 
            title="Coach Messages" 
            type="switch" 
            value={notifications.coach} 
            onPress={() => toggleNotif('coach')} 
          />
          <SettingRow 
            icon="people-outline" 
            title="Forum Activity" 
            type="switch" 
            value={notifications.forum} 
            onPress={() => toggleNotif('forum')} 
            isLast 
          />
        </View>

        <Text style={styles.sectionLabel}>PREFERENCES</Text>
        <View style={styles.sectionCard}>
          <SettingRow 
            icon="moon-outline" 
            title="Dark Theme" 
            type="switch" 
            value={darkTheme} 
            onPress={() => setDarkTheme(!darkTheme)} 
          />
          <SettingRow 
            icon="sync-outline" 
            title="Sync with Apple Health" 
            type="switch" 
            value={healthSync} 
            onPress={() => setHealthSync(!healthSync)} 
          />
          <SettingRow icon="fitness-outline" title="Units" value="kg / kcal" isLast onPress={() => {}} />
        </View>

        <Text style={styles.sectionLabel}>HELP & LEGAL</Text>
        <View style={styles.sectionCard}>
          <SettingRow icon="help-circle-outline" title="Help Center" onPress={() => {}} />
          <SettingRow icon="document-text-outline" title="Privacy Policy" onPress={() => {}} isLast />
        </View>

        <Text style={styles.sectionLabel}>DANGER ZONE</Text>
        <View style={styles.sectionCard}>
          <SettingRow 
            icon="log-out-outline" 
            title="Log Out" 
            color="#e74c3c" 
            onPress={handleLogout} 
            isLast 
          />
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A1F2B',
  },
  scrollView: {
    paddingHorizontal: 16,
    marginTop: 15,
  },
  mainTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 25,
    marginTop: 10,
  },
  sectionLabel: {
    color: '#888',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 8,
    marginLeft: 5,
    letterSpacing: 1,
  },
  sectionCard: {
    backgroundColor: '#2A4562',
    borderRadius: 15,
    marginBottom: 25,
    overflow: 'hidden',
  },
  item: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    padding: 16, 
    borderBottomWidth: 1, 
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  itemTitle: {
    color: 'white',
    fontSize: 15,
    marginLeft: 10,
  },
  itemValue: {
    color: '#3498DB',
    fontSize: 14,
    fontWeight: '600',
    marginRight: 8,
  },
  version: {
    textAlign: 'center',
    color: '#555',
    fontSize: 11,
    marginTop: 10,
    marginBottom: 30,
  },
});

export default SettingsPage;