import React, { useState, useRef } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import Toast from 'react-native-toast-message';
import { getCurrentLocation, requestLocationPermission } from '@/services/crossLocation';
import axios from 'axios';

// 🔥 IMPORT DÉCOMMENTÉ : Indispensable pour l'auto-login
import { saveSession } from '@/services/authStorage';

const SignupPage = () => {
  const insets = useSafeAreaInsets();
  const navigation = useRouter();
  
  const [firstname, setFirstName] = useState('');
  const [lastname, setLastName] = useState('');
  const [userGender, setUserGender] = useState('');
  const [age, setAge] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [userType, setUserType] = useState('');
  
  const [city, setCity] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');

  const [goal, setGoal] = useState('lose_weight');
  const [fitnessLevel, setFitnessLevel] = useState('beginner');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [errorField, setErrorField] = useState('');
  const [loading, setLoading] = useState(false);

  const [citySearch, setCitySearch] = useState('');
  const [cityResults, setCityResults] = useState<any[]>([]);
  const [isSearchingCity, setIsSearchingCity] = useState(false);
  const [selectedCity, setSelectedCity] = useState<any>(null);

  const firstNameRef = useRef<TextInput>(null);
  const lastNameRef = useRef<TextInput>(null);
  const ageRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmPasswordRef = useRef<TextInput>(null);
  
  const API_URL = Constants.expoConfig?.extra?.API_URL ?? '';

  const searchCityApi = async (text: string) => {
    setCitySearch(text);
    setSelectedCity(null);

    if (text.length < 3) {
      setCityResults([]);
      return;
    }

    setIsSearchingCity(true);
    try {
      const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(text)}&count=5&language=fr&format=json`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.results) {
        setCityResults(data.results);
      } else {
        setCityResults([]);
      }
    } catch (error) {
      console.log("Erreur API Ville:", error);
    } finally {
      setIsSearchingCity(false);
    }
  };
  
  const handleSelectCity = (cityItem: any) => {
    setSelectedCity(cityItem);
    setCitySearch(cityItem.name); 
    setCity(cityItem.name);       
    setCityResults([]);
  };

  const validateForm = () => {
    setErrorField('');

    if (userType === 'coach' && !selectedCity) {
      Toast.show({ 
        type: 'error', 
        text1: 'City Required', 
        text2: 'Please select a valid city from the dropdown list.' 
      });
      return false;
    }
    
    if (!firstname || firstname.trim() === '') {
      setErrorField('firstname');
      firstNameRef.current?.focus();
      Toast.show({ type: 'error', text1: 'Erreur', text2: 'Please enter your first name' });
      return false;
    }

    if (!lastname || lastname.trim() === '') {
      setErrorField('lastname');
      lastNameRef.current?.focus();
      Toast.show({ type: 'error', text1: 'Erreur', text2: 'Please enter your last name' });
      return false;
    }

    const ageNumber = Number(age);
    if (isNaN(ageNumber) || ageNumber < 0 || ageNumber > 100 || age === '') {
      setErrorField('age');
      ageRef.current?.focus();
      Toast.show({ type: 'error', text1: 'Erreur', text2: 'Please enter a valid age' });
      return false;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      setErrorField('email');
      emailRef.current?.focus();
      Toast.show({ type: 'error', text1: 'Erreur', text2: 'Please enter a valid email address' });
      return false;
    }
    
    if (!password || password.length < 6) {
      setErrorField('password');
      passwordRef.current?.focus();
      Toast.show({ type: 'error', text1: 'Erreur', text2: 'Password must be at least 6 characters long' });
      return false;
    }

    if (password.length > 72) {
      setErrorField('password');
      passwordRef.current?.focus();
      Toast.show({ type: 'error', text1: 'Erreur', text2: 'Password cannot exceed 72 characters' });
      return false;
    }
    
    if (password !== confirmPassword) {
      setErrorField('confirmPassword');
      confirmPasswordRef.current?.focus();
      Toast.show({ type: 'error', text1: 'Erreur', text2: 'Passwords do not match' });
      return false;
    }
    
    if (!userType) {
      setErrorField('userType');
      Toast.show({ type: 'error', text1: 'Erreur', text2: 'Please select if you are a client or coach' });
      return false;
    }
    
    return true;
  };
  
  const handleRegister = async () => {
    if (!validateForm()) return;

    setLoading(true);
    let currentLat = null;
    let currentLon = null;

    try {
        const granted = await requestLocationPermission();
        if (granted) {
            const location = await getCurrentLocation();
            if (location) {
                currentLat = location.latitude;
                currentLon = location.longitude;
            }
        } else {
            console.log("Permission GPS refusée, utilisation des coordonnées de la ville choisie.");
            if (selectedCity) {
                currentLat = selectedCity.latitude;
                currentLon = selectedCity.longitude;
            }
        }
    } catch (error) {
        console.log("Erreur de localisation :", error);
        if (selectedCity) {
            currentLat = selectedCity.latitude;
            currentLon = selectedCity.longitude;
        }
    }

    try {
        // 🔥 1. On stocke la réponse de l'API dans 'response'
        const response = await axios.post(`${API_URL}/register`, {
            email: email,
            password: password,
            firstname: firstname,
            lastname: lastname,
            age: parseInt(age),
            gender: userGender,
            role: userType,
            city: city,
            latitude: currentLat,
            longitude: currentLon,
            weight: weight ? parseFloat(weight) : null,
            height: height ? parseFloat(height) : null,
            goal: goal,
            fitness_level: fitnessLevel
        });
        
        // 🔥 2. AUTO-LOGIN : ON SAUVEGARDE LE TOKEN ICI
        await saveSession(response.data.access_token, response.data.user);

        Toast.show({ type: 'success', text1: 'Account Created', text2: 'Your account has been created successfully!' });
        
        setTimeout(() => {
          let route = userType === 'coach' ? '/coachs/home' : '/clients/home';
          navigation.push(`${route}`);
        }, 1500);
        
    } catch (error: any) {
        console.error("Erreur d'inscription:", error);
        Toast.show({ type: 'error', text1: 'Registration Failed', text2: error.response?.data?.detail || 'An error occurred during registration. Please try again.' });
    } finally {
        setLoading(false);
    }
  };
  
  const testServerConnection = async () => {
    try {
      const response = await fetch(`${API_URL}/`);
      const data = await response.json();
      Toast.show({ type: 'info', text1: 'Server OK', text2: JSON.stringify(data) });
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Server Error', text2: err.message });
    }
  };
  
  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.back()}>
            <Ionicons name="arrow-back" size={28} color="#3498DB" />
          </TouchableOpacity>
          <Text style={styles.appName}>
            <Text style={styles.appNameBlue}>NUTRI</Text>
            <Text style={styles.appNameWhite}>TRAIN</Text>
          </Text>
          <TouchableOpacity style={styles.testButton} onPress={testServerConnection}>
            <Ionicons name="server-outline" size={24} color="#3498DB" />
          </TouchableOpacity>
        </View>
        
        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>Enter your details to get started</Text>
        
        <View style={styles.formContainer}>
          <Text style={styles.inputLabel}>Firstname</Text>
          <TextInput 
            ref={firstNameRef}
            style={[styles.input, errorField === 'firstname' && styles.inputError]} 
            placeholder="Enter your firstname" 
            placeholderTextColor="#8A8D91" 
            value={firstname} 
            onChangeText={(text) => { setFirstName(text); setErrorField(''); }} 
          />

          <Text style={styles.inputLabel}>Lastname</Text>
          <TextInput 
            ref={lastNameRef}
            style={[styles.input, errorField === 'lastname' && styles.inputError]} 
            placeholder="Enter your lastname" 
            placeholderTextColor="#8A8D91" 
            value={lastname} 
            onChangeText={(text) => { setLastName(text); setErrorField(''); }} 
          />

          <Text style={styles.inputLabel}>Gender</Text>
          <View style={styles.userGenderContainer}>
            <TouchableOpacity style={[styles.userGenderButton, userGender === 'male' && styles.selectedUserGender]} onPress={() => setUserGender('male')}>
                <Text style={[styles.userGenderText, userGender === 'male' && styles.selectedUserGenderText]}>Male</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.userGenderButton, userGender === 'female' && styles.selectedUserGender]} onPress={() => setUserGender('female')}>
                <Text style={[styles.userGenderText, userGender === 'female' && styles.selectedUserGenderText]}>Female</Text>
            </TouchableOpacity>
          </View> 

          <Text style={styles.inputLabel}>Age</Text>
          <TextInput 
            ref={ageRef}
            style={[styles.input, errorField === 'age' && styles.inputError]} 
            placeholder="Enter your age" 
            placeholderTextColor="#8A8D91" 
            keyboardType="numeric" 
            value={age} 
            onChangeText={(text) => { setAge(text); setErrorField(''); }} 
          />
          
          <Text style={styles.inputLabel}>Email</Text>
          <TextInput 
            ref={emailRef}
            style={[styles.input, errorField === 'email' && styles.inputError]} 
            placeholder="Enter your email" 
            placeholderTextColor="#8A8D91" 
            keyboardType="email-address" 
            autoCapitalize="none" 
            value={email} 
            onChangeText={(text) => { setEmail(text); setErrorField(''); }} 
          />
          
          <Text style={styles.inputLabel}>Password</Text>
          <View style={[styles.passwordContainer, errorField === 'password' && styles.inputError]}>
            <TextInput 
              ref={passwordRef}
              style={styles.passwordInput} 
              placeholder="Create a password" 
              placeholderTextColor="#8A8D91" 
              secureTextEntry={!showPassword} 
              value={password} 
              onChangeText={(text) => { setPassword(text); setErrorField(''); }} 
            />
            <TouchableOpacity style={styles.eyeIcon} onPress={() => setShowPassword(!showPassword)}>
              <Ionicons name={showPassword ? "eye-off" : "eye"} size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          
          <Text style={styles.inputLabel}>Confirm Password</Text>
          <View style={[styles.passwordContainer, errorField === 'confirmPassword' && styles.inputError]}>
            <TextInput 
              ref={confirmPasswordRef}
              style={styles.passwordInput} 
              placeholder="Confirm your password" 
              placeholderTextColor="#8A8D91" 
              secureTextEntry={!showConfirmPassword} 
              value={confirmPassword} 
              onChangeText={(text) => { setConfirmPassword(text); setErrorField(''); }} 
            />
            <TouchableOpacity style={styles.eyeIcon} onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
              <Ionicons name={showConfirmPassword ? "eye-off" : "eye"} size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          
          <Text style={styles.inputLabel}>I am a:</Text>
          <View style={[styles.userTypeContainer, errorField === 'userType' && { borderWidth: 1, borderColor: '#FF6B6B', borderRadius: 10 }]}>
            <TouchableOpacity style={[styles.userTypeButton, userType === 'client' && styles.selectedUserType]} onPress={() => { setUserType('client'); setErrorField(''); }}>
              <Text style={[styles.userTypeText, userType === 'client' && styles.selectedUserTypeText]}>Client</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.userTypeButton, userType === 'coach' && styles.selectedUserType]} onPress={() => { setUserType('coach'); setErrorField(''); }}>
              <Text style={[styles.userTypeText, userType === 'coach' && styles.selectedUserTypeText]}>Coach</Text>
            </TouchableOpacity>
          </View>

          {userType === 'coach' && (
            <View style={styles.dynamicSection}>
              <Text style={styles.inputLabel}>City</Text>
              <View style={{ zIndex: 10 }}>
                
                <TextInput 
                  style={[styles.input, { marginBottom: cityResults.length > 0 && !selectedCity ? 0 : 20 }]} 
                  placeholder="Where do you coach? (e.g. Marseille)" 
                  placeholderTextColor="#8A8D91" 
                  value={citySearch} 
                  onChangeText={searchCityApi} 
                />
                
                {isSearchingCity && (
                  <ActivityIndicator size="small" color="#3498DB" style={{ position: 'absolute', right: 15, top: 15 }} />
                )}

                {cityResults.length > 0 && (
                    <View style={styles.dropdownContainer}>
                        <ScrollView 
                            style={{ maxHeight: 200 }} 
                            nestedScrollEnabled={true} 
                            keyboardShouldPersistTaps="handled"
                        >
                            {cityResults.map((item, index) => (
                                <TouchableOpacity 
                                    key={index} 
                                    style={styles.dropdownItem}
                                    onPress={() => handleSelectCity(item)}
                                >
                                    <Text style={styles.dropdownItemText}>{item.name}</Text>
                                    <Text style={{ color: '#8A8D91', fontSize: 12, marginTop: 2 }}>
                                        {item.admin1 ? `${item.admin1}, ` : ''}{item.country}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                )}

              </View>
            </View>
          )}

          {userType === 'client' && (
            <View style={styles.dynamicSection}>
              <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                <View style={{flex: 0.48}}>
                  <Text style={styles.inputLabel}>Weight (kg)</Text>
                  <TextInput style={styles.input} placeholder="e.g. 70" placeholderTextColor="#8A8D91" keyboardType="numeric" value={weight} onChangeText={setWeight} />
                </View>
                <View style={{flex: 0.48}}>
                  <Text style={styles.inputLabel}>Height (cm)</Text>
                  <TextInput style={styles.input} placeholder="e.g. 175" placeholderTextColor="#8A8D91" keyboardType="numeric" value={height} onChangeText={setHeight} />
                </View>
              </View>

              <Text style={styles.inputLabel}>Main Goal</Text>
              <View style={styles.goalContainer}>
                {['lose_weight', 'maintain_weight', 'gain_muscle'].map((g) => (
                  <TouchableOpacity
                    key={g}
                    style={[styles.goalButton, goal === g && styles.selectedGoalButton]}
                    onPress={() => setGoal(g)}
                  >
                    <Text style={[styles.goalText, goal === g && styles.selectedGoalText]}>
                      {g === 'lose_weight' ? 'Weight Loss' : g === 'maintain_weight' ? 'Maintain' : 'Muscle Gain'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Fitness Level</Text>
              {[
                { value: 'beginner', label: 'Beginner', desc: 'New to training or less than 6 months of regular practice' },
                { value: 'intermediate', label: 'Intermediate', desc: '6 months to 2 years of consistent training' },
                { value: 'advanced', label: 'Advanced', desc: 'Over 2 years of serious, structured training' },
              ].map((lvl) => (
                <TouchableOpacity
                  key={lvl.value}
                  style={[styles.fitnessLevelOption, fitnessLevel === lvl.value && styles.fitnessLevelOptionSelected]}
                  onPress={() => setFitnessLevel(lvl.value)}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={[styles.fitnessRadio, fitnessLevel === lvl.value && styles.fitnessRadioSelected]} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.fitnessLevelLabel, fitnessLevel === lvl.value && styles.fitnessLevelLabelSelected]}>{lvl.label}</Text>
                      <Text style={styles.fitnessLevelDesc}>{lvl.desc}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

        </View>
        
        <TouchableOpacity style={[styles.signupButton, loading && styles.signupButtonDisabled]} onPress={handleRegister} disabled={loading}>
          {loading ? <ActivityIndicator color="white" /> : <Text style={styles.signupButtonText}>Sign Up</Text>}
        </TouchableOpacity>
        
        <View style={styles.loginContainer}>
          <Text style={styles.loginText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => navigation.push('/(tabs)/login')}>
            <Text style={styles.loginLink}>Log In</Text>
          </TouchableOpacity>
        </View>
        
        <Text style={styles.termsText}>
          By signing up, you agree to our Terms of Service and Privacy Policy
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  dropdownContainer: { 
    position: 'absolute', 
    top: 55, 
    left: 0, 
    right: 0, 
    backgroundColor: '#1E2C3D', 
    borderRadius: 10, 
    borderWidth: 1, 
    borderColor: '#3498DB', 
    zIndex: 1000,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  dropdownItem: { 
    padding: 12, 
    borderBottomWidth: 1, 
    borderBottomColor: '#2A4562' 
  },
  dropdownItemText: { 
    color: '#FFFFFF', 
    fontSize: 16,
    fontWeight: 'bold'
  },
  container: { flex: 1, backgroundColor: '#1A1F2B' },
  scrollContainer: { flexGrow: 1, padding: 20 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 30, justifyContent: 'space-between' },
  testButton: { padding: 5 },
  appName: { fontSize: 24, fontWeight: 'bold' },
  appNameBlue: { color: '#3498DB' },
  appNameWhite: { color: '#FFFFFF' },
  title: { fontSize: 30, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 10 },
  subtitle: { fontSize: 16, color: '#FFFFFF', marginBottom: 30 },
  formContainer: { marginBottom: 20, zIndex: 1 }, 
  inputLabel: { color: '#FFFFFF', fontSize: 16, marginBottom: 8 },
  input: { backgroundColor: '#2A4562', borderRadius: 10, paddingHorizontal: 15, paddingVertical: 12, color: '#FFFFFF', fontSize: 16, marginBottom: 20, borderWidth: 1, borderColor: 'transparent' },
  inputError: { borderColor: '#FF6B6B', borderWidth: 1 },
  passwordContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2A4562', borderRadius: 10, marginBottom: 20, borderWidth: 1, borderColor: 'transparent' },
  passwordInput: { flex: 1, paddingHorizontal: 15, paddingVertical: 12, color: '#FFFFFF', fontSize: 16 },
  eyeIcon: { paddingRight: 15 },
  userTypeContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  userTypeButton: { backgroundColor: '#2A4562', borderRadius: 10, paddingVertical: 12, width: '48%', alignItems: 'center' },
  selectedUserType: { backgroundColor: '#3498DB' },
  userTypeText: { color: '#FFFFFF', fontSize: 16 },
  selectedUserTypeText: { fontWeight: 'bold' },
  userGenderContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  userGenderButton: { backgroundColor: '#2A4562', borderRadius: 10, paddingVertical: 12, width: '48%', alignItems: 'center' },
  selectedUserGender: { backgroundColor: '#3498DB' },
  userGenderText: { color: '#FFFFFF', fontSize: 16 },
  selectedUserGenderText: { fontWeight: 'bold' },
  dynamicSection: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#2A4562', zIndex: 2 },
  goalContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  goalButton: { backgroundColor: '#2A4562', borderRadius: 10, paddingVertical: 12, flex: 1, marginHorizontal: 4, alignItems: 'center' },
  selectedGoalButton: { backgroundColor: '#3498DB' },
  goalText: { color: '#FFFFFF', fontSize: 11, textAlign: 'center' },
  selectedGoalText: { fontWeight: 'bold' },
  fitnessLevelOption: { backgroundColor: '#2A4562', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1.5, borderColor: 'transparent' },
  fitnessLevelOptionSelected: { borderColor: '#3498DB', backgroundColor: '#1E3A55' },
  fitnessRadio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#8A8D91' },
  fitnessRadioSelected: { borderColor: '#3498DB', backgroundColor: '#3498DB' },
  fitnessLevelLabel: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  fitnessLevelLabelSelected: { color: '#3498DB' },
  fitnessLevelDesc: { color: '#8A8D91', fontSize: 12, marginTop: 2 },
  signupButton: { backgroundColor: '#3498DB', borderRadius: 10, paddingVertical: 15, alignItems: 'center', marginBottom: 20, zIndex: 0 },
  signupButtonDisabled: { backgroundColor: '#2A4562', opacity: 0.7 },
  signupButtonText: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
  loginContainer: { flexDirection: 'row', justifyContent: 'center', marginBottom: 20 },
  loginText: { color: '#FFFFFF', fontSize: 16 },
  loginLink: { color: '#3498DB', fontSize: 16, fontWeight: 'bold' },
  termsText: { color: '#8A8D91', fontSize: 14, textAlign: 'center', marginBottom: 20 },
});

export default SignupPage;