import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import StapleLogo from '@/components/StapleLogo';
import { crossAlert } from '@/services/crossAlert';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';

import { saveSession } from '@/services/authStorage';

const LoginPage = () => {
  const insets = useSafeAreaInsets();
  const navigation = useRouter();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [userType, setUserType] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const API_URL = Constants.expoConfig?.extra?.API_URL ?? '';

  const handleLogin = async () => {
    // Valider inputs
    if (!email) {
      setError('Please enter your email');
      return;
    }
    if (!password) {
      setError('Please enter your password');
      return;
    }
    if (!userType) {
      setError('Please select if you are a client or coach');
      return;
    }

    setLoading(true);
    setError('');

    try {
      console.log(`Attempting to login with email: ${email}, userType: ${userType}`);
      
      const loginData = {
        email: email,
        password: password,
        userType: userType,
      };
      
      const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(loginData),
      });

      const data = await response.json();
      
      if (response.ok) {
        console.log('Authentication successful');
        if (data.requirePasswordChange) {
          navigation.push('/(tabs)/change-password');
        } else {
          const { access_token } = data;
          await saveSession(access_token);
          if (userType === "client") {
            navigation.push('/clients/home');
          } else {
            navigation.push('/coachs/home');
          }
        }
      } else {
        console.log('Authentication failed:', data.detail);
        setError(data.detail);
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Connection error. Please check your network and try again.');
      
      crossAlert(
        'Erreur lors de la connexion', 
        `Unable to connect to the server. Error: ${err.detail}`,
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardDismissMode="on-drag">
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.back()} style={{width: 38}}>
            <Ionicons name="arrow-back" size={28} color="#3498DB" />
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            <StapleLogo fontSize={28} />
            <Text style={{ color: '#888', fontSize: 9, letterSpacing: 2, marginTop: 4 }}>TRAIN SMART, LIVE STRONG</Text>
          </View>
          <View style={{width: 38}} />
        </View>
        
        <Text style={styles.title}>Log In</Text>
        <Text style={styles.subtitle}>Welcome back! Please enter your details</Text>
        
        {error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
        
        <View style={styles.formContainer}>
          <Text style={styles.inputLabel}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your email"
            placeholderTextColor="#8A8D91"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
          
          <Text style={styles.inputLabel}>Password</Text>
          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Enter your password"
              placeholderTextColor="#8A8D91"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity 
              style={styles.eyeIcon}
              onPress={() => setShowPassword(!showPassword)}
            >
              <Ionicons 
                name={showPassword ? "eye-off" : "eye"} 
                size={24} 
                color="#FFFFFF" 
              />
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity style={styles.forgotPasswordContainer}>
            <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
          </TouchableOpacity>

          <Text style={styles.inputLabel}>I am a:</Text>
          <View style={styles.userTypeContainer}>
              <TouchableOpacity 
              style={[
                  styles.userTypeButton, 
                  userType === 'client' && styles.selectedUserType
              ]}
              onPress={() => setUserType('client')}
              >
              <Text style={[
                  styles.userTypeText,
                  userType === 'client' && styles.selectedUserTypeText
              ]}>Client</Text>
              </TouchableOpacity>
            
              <TouchableOpacity 
              style={[
                  styles.userTypeButton, 
                  userType === 'coach' && styles.selectedUserType
              ]}
              onPress={() => setUserType('coach')}
              >
              <Text style={[
                  styles.userTypeText,
                  userType === 'coach' && styles.selectedUserTypeText
              ]}>Coach</Text>
              </TouchableOpacity>
          </View>
        </View>
        
        <TouchableOpacity 
          style={[styles.loginButton, loading && styles.loginButtonDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          <Text style={styles.loginButtonText}>{loading ? 'Logging in...' : 'Log In'}</Text>
        </TouchableOpacity>
        
        <View style={styles.signupContainer}>
          <Text style={styles.signupText}>Don't have an account? </Text>
          <TouchableOpacity onPress={() => navigation.push('/(tabs)/signup')}>
            <Text style={styles.signupLink}>Sign Up</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A1F2B',
  },
  scrollContainer: {
    flexGrow: 1,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 40,
    justifyContent: 'space-between',
  },
  testButton: {
    padding: 5,
  },
  appName: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  appNameBlue: {
    color: '#3498DB',
  },
  appNameWhite: {
    color: '#FFFFFF',
  },
  title: {
    fontSize: 30,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#FFFFFF',
    marginBottom: 40,
  },
  errorContainer: {
    backgroundColor: '#FF6B6B',
    padding: 10,
    borderRadius: 10,
    marginBottom: 20,
  },
  errorText: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontSize: 16,
  },
  formContainer: {
    marginBottom: 30,
  },
  inputLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#2A4562',
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 12,
    color: '#FFFFFF',
    fontSize: 16,
    marginBottom: 20,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A4562',
    borderRadius: 10,
    marginBottom: 10,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 15,
    paddingVertical: 12,
    color: '#FFFFFF',
    fontSize: 16,
  },
  eyeIcon: {
    paddingRight: 15,
  },
  forgotPasswordContainer: {
    alignSelf: 'flex-end',
    marginBottom: 30,
  },
  forgotPasswordText: {
    color: '#3498DB',
    fontSize: 14,
  },
  loginButton: {
    backgroundColor: '#3498DB',
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 20,
    // @ts-ignore
    cursor: 'pointer',
  },
  loginButtonDisabled: {
    backgroundColor: '#2A4562',
    opacity: 0.7,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  signupText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  signupLink: {
    color: '#3498DB',
    fontSize: 16,
    fontWeight: 'bold',
  },
  userTypeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  userTypeButton: {
    backgroundColor: '#2A4562',
    borderRadius: 10,
    paddingVertical: 12,
    width: '48%',
    alignItems: 'center',
  },
  selectedUserType: {
    backgroundColor: '#3498DB',
  },
  userTypeText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  selectedUserTypeText: {
    fontWeight: 'bold',
  },
});

export default LoginPage;