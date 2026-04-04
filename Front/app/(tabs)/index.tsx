import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import StapleLogo from '@/components/StapleLogo';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, Link } from 'expo-router'; // <-- Import de Link ajouté ici

import { getToken, getUserDetails } from '@/services/authStorage';

const Index = () => {
  const insets = useSafeAreaInsets();
  const navigation = useRouter();
  const [isWeb, setIsWeb] = useState(false);
  const [installDismissed, setInstallDismissed] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      // Only show on mobile-sized screens
      if (window.innerWidth < 1024) {
        setIsWeb(true);
      }
    }
  }, []);

  useEffect(() => {
    const checkLogin = async () => {
      const token = await getToken();
      const userDetails = await getUserDetails();

      if (token && userDetails && userDetails.role) {
        console.log('Token still valid, navigating to home');
        const route = userDetails.role === 'coach' ? '/coachs/home' : '/clients/home';
        navigation.push(route);
      }
    };

    checkLogin();
  }, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.logoContainer}>
        <StapleLogo fontSize={36} />
        <Text style={{ color: '#888', fontSize: 9, letterSpacing: 2, marginTop: 4 }}>TRAIN SMART, LIVE STRONG</Text>
      </View>

      <View style={styles.contentContainer}>
        <Text style={styles.welcomeText}>Welcome to your fitness journey</Text>
        <Text style={styles.descriptionText}>
          Track your nutrition, follow personalized training plans, and reach your fitness goals with STAPLE
        </Text>
      </View>

      {isWeb && !installDismissed && (
        <View style={styles.installCard}>
          <View style={styles.installHeader}>
            <Ionicons name="download-outline" size={22} color="#3498DB" />
            <Text style={styles.installTitle}>Install Staple App</Text>
            <TouchableOpacity onPress={() => setInstallDismissed(true)}>
              <Ionicons name="close" size={18} color="#8A8D91" />
            </TouchableOpacity>
          </View>
          <Text style={styles.installHint}> 
            To install this app on your phone, tap the Share button in your browser toolbar, then select "Add to Home Screen".
          </Text>
        </View>
      )}

      <View style={styles.buttonContainer}>
        {/* Remplacement par le composant Link d'Expo Router */}
        <Link href="/login" asChild>
          <TouchableOpacity
            style={styles.loginButton}
            activeOpacity={0.7}
          >
            <Text style={styles.loginButtonText}>Log In</Text>
          </TouchableOpacity>
        </Link>

        <Link href="/signup" asChild>
          <TouchableOpacity
            style={styles.signupButton}
            activeOpacity={0.7}
          >
            <Text style={styles.signupButtonText}>Sign Up</Text>
          </TouchableOpacity>
        </Link>
      </View>

      <Text style={styles.footerText}>Your personal fitness & nutrition app</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A1F2B',
    padding: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 60,
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  welcomeText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 20,
  },
  descriptionText: {
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 24,
  },
  installCard: {
    backgroundColor: '#2A4562',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(52, 152, 219, 0.25)',
  },
  installHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  installTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  installHint: {
    color: '#8A8D91',
    fontSize: 13,
    lineHeight: 20,
  },
  buttonContainer: {
    width: '100%',
    marginBottom: 40,
  },
  loginButton: {
    backgroundColor: '#3498DB',
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 15,
    // @ts-ignore — cursor is valid on web
    cursor: 'pointer',
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  signupButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
    // @ts-ignore
    cursor: 'pointer',
  },
  signupButtonText: {
    color: '#2A4562',
    fontSize: 18,
    fontWeight: 'bold',
  },
  footerText: {
    color: '#FFFFFF',
    fontSize: 14,
    textAlign: 'center',
  }
});

export default Index;