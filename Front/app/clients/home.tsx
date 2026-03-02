import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { 
  StyleSheet, Text, View, TouchableOpacity, TouchableWithoutFeedback, 
  ScrollView, Image, TextInput, Modal, Keyboard, 
  ActivityIndicator, StatusBar, Alert, Platform, Dimensions, KeyboardAvoidingView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import axios from 'axios';
import Constants from 'expo-constants';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useFocusEffect, useRouter } from 'expo-router';

import { getUserDetails, getToken } from '@/services/authStorage';
import MealCard from '@/components/MealCard';

const { width, height } = Dimensions.get('window');

const FoodImage = ({ uri, style, iconSize = 24 }: any) => {
  const hasValidImage = uri && uri !== '' && uri !== 'null';
  if (hasValidImage) {
    return <Image source={{ uri: uri }} style={style} />;
  } else {
    return (
      <View style={[style, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#2C3E50' }]}>
        <Ionicons name="fast-food-outline" size={iconSize} color="#888" />
      </View>
    );
  }
};

const HomeScreen = () => {
  const router = useRouter(); 
  const API_URL = Constants.expoConfig?.extra?.API_URL ?? '';

  // --- STATE DASHBOARD ---
  const [user, setUser] = useState<any>(null);
  const [dashboardStats, setDashboardStats] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [myMeals, setMyMeals] = useState<any[]>([]);

  // --- STATE MODIF OBJECTIF ---
  const [isGoalModalVisible, setIsGoalModalVisible] = useState(false);
  const [newGoal, setNewGoal] = useState('');
  const [updatingGoal, setUpdatingGoal] = useState(false);

  // --- STATE CREATION REPAS ---
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [mealName, setMealName] = useState('');
  const [date, setDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  
  const [search, setSearch] = useState('');
  const [searchWeight, setSearchWeight] = useState(''); 
  const [results, setResults] = useState<any[]>([]);
  const [selectedFoods, setSelectedFoods] = useState<any[]>([]);
  const [editingId, setEditingId] = useState(null);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [savingMeal, setSavingMeal] = useState(false);

  // --- STATE CAMERA ---
  const [permission, requestPermission] = useCameraPermissions();
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [scanned, setScanned] = useState(false);
  const isProcessingScan = useRef(false);

  // --- STATE VIEW / DETAIL ---
  const [isViewModalVisible, setIsViewModalVisible] = useState(false);
  const [mealToView, setMealToView] = useState<any>(null);
  const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);
  const [selectedFood, setSelectedFood] = useState<any>(null);
  const [nutriments, setNutriments] = useState<any>(null);
  const [grammage, setGrammage] = useState('');

  // --- STATE INVITATIONS ---
  const [invitations, setInvitations] = useState([]);

  // --- 1. INITIALISATION ---
  useFocusEffect(
    useCallback(() => {
        loadData();
    }, [])
  );

  const fetchInvitations = async () => {
    try {
        const token = await getToken();
        if (!token) return;
        const response = await axios.get(`${API_URL}/clients/me/invitations`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        setInvitations(response.data.invitations || []);
    } catch (error) {
        console.log("Error fetching invitations:", error);
    }
  };

  useEffect(() => {
      fetchInvitations();
  }, []);

  const loadData = async () => {
    setLoadingStats(true);
    const session = await getUserDetails();
    if (session) {
      setUser(session);
      await Promise.all([
          fetchMeals(session.id),
          fetchDashboardStats(session.id)
      ]);
    }
    setLoadingStats(false);
  };

  const fetchDashboardStats = async (userId: number) => {
    try {
        const token = await getToken();
        const res = await axios.get(`${API_URL}/users/me/dashboard-stats`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        setDashboardStats(res.data);
    } catch (error) {
        console.log("Error stats:", error);
    }
  };

  const fetchMeals = async (userId: number) => {
    try {
      const response = await axios.get(`${API_URL}/users/get_daily_meals/${userId}`);
      const sorted = response.data.meals.sort((a: any, b: any) => 
        new Date(a.hourtime).getTime() - new Date(b.hourtime).getTime()
      );
      setMyMeals(sorted);
    } catch (error) {
      console.log("Error meals:", error);
    }
  };

  // --- 2. ACTIONS DASHBOARD ---
  const handleToggleEat = async (mealId: number) => {
      try {
          const token = await getToken();
          setMyMeals(prev => prev.map(m => m.id === mealId ? {...m, is_consumed: !m.is_consumed} : m));
          await axios.patch(`${API_URL}/meals/${mealId}/toggle-consume`, {}, {
              headers: { Authorization: `Bearer ${token}` }
          });
          if (user) fetchDashboardStats(user.id);
      } catch (error) {
          Alert.alert("Error", "Connection issue");
      }
  };

  const handleUpdateGoal = async () => {
    const goalValue = parseFloat(newGoal);
    if (isNaN(goalValue) || goalValue <= 0) return;
    setUpdatingGoal(true);
    try {
        const token = await getToken();
        await axios.patch(`${API_URL}/users/me/goals`, { daily_caloric_needs: goalValue }, { headers: { Authorization: `Bearer ${token}` } });
        setIsGoalModalVisible(false);
        if (user) fetchDashboardStats(user.id);
    } catch (error) {
        Alert.alert("Error", "Could not update goal");
    } finally {
        setUpdatingGoal(false);
    }
  };

  // --- 3. ACTIONS CREATION REPAS & LOGIQUE DYNAMIQUE ---
  const totalMealMacros = useMemo(() => {
    return selectedFoods.reduce((acc, item) => {
      const weight = parseFloat(item.weight) || 0;
      const ratio = weight / 100;

      const getBaseMacro = (key: string, fallbackKey?: string) => {
          if (item.baseMacros && item.baseMacros[key] !== undefined) return parseFloat(item.baseMacros[key]);
          const currentMacroVal = parseFloat(item.macros?.[key] || (fallbackKey ? item.macros?.[fallbackKey] : 0) || 0);
          const currentWeightRatio = (parseFloat(item.weight) || 100) / 100;
          return currentWeightRatio > 0 ? currentMacroVal / currentWeightRatio : 0;
      };

      return {
        calories: acc.calories + (getBaseMacro('energy') * ratio),
        proteins: acc.proteins + (getBaseMacro('proteins') * ratio),
        carbs: acc.carbs + (getBaseMacro('carbohydrates') * ratio),
        fats: acc.lipids + (getBaseMacro('lipids') * ratio),
        sugars: acc.sugars + (getBaseMacro('sugars') * ratio),
        saturated_fats: acc.saturated_fats + (getBaseMacro('saturated_fats') * ratio),
        fibers: acc.fibers + (getBaseMacro('fibers') * ratio),
        salt: acc.salt + (getBaseMacro('salt') * ratio),
      };
    }, { calories: 0, proteins: 0, carbs: 0, fats: 0, sugars: 0, saturated_fats: 0, fibers: 0, salt: 0 });
  }, [selectedFoods]);

  const updateFoodWeight = (index: number, newWeightStr: string) => {
      const updatedFoods = [...selectedFoods];
      updatedFoods[index] = { ...updatedFoods[index], weight: newWeightStr };
      setSelectedFoods(updatedFoods);
  };

  const searchFood = async () => {
    if (!searchWeight || isNaN(parseFloat(searchWeight)) || parseFloat(searchWeight) <= 0) {
      Alert.alert("Weight Missing", "Please enter a weight (grams) BEFORE searching.");
      return; 
    }
    if (!search.trim()) return;

    setLoadingSearch(true);
    try {
      const response = await axios.get(`${API_URL}/getAlimentFromApi/${search}`);
      setResults(response.data.map((food: any) => ({
          name: food.name,
          image: food.image,
          code: food.code || food.id || food.barcode || null
      })));
    } catch (error) {
      setResults([]);
    }
    setLoadingSearch(false);
  };

  const handleSelectFood = async (item: any) => {
    if (!searchWeight) {
        Alert.alert("Error", "Weight is missing.");
        return;
    }

    setLoadingSearch(true);
    try {
      const response = await axios.get(`${API_URL}/getAlimentNutriment/${item.code}/${searchWeight}`);
      const foodDetails = response.data;
      const weightNum = parseFloat(searchWeight);
      const ratio = weightNum / 100;

      const baseMacros = {
          energy: parseFloat(foodDetails.energy) / ratio || 0,
          proteins: parseFloat(foodDetails.proteins) / ratio || 0,
          carbohydrates: parseFloat(foodDetails.carbohydrates) / ratio || 0,
          sugars: parseFloat(foodDetails.sugars) / ratio || 0,
          lipids: parseFloat(foodDetails.lipids) / ratio || 0,
          saturated_fats: parseFloat(foodDetails.saturated_fats) / ratio || 0,
          fibers: parseFloat(foodDetails.fiber) / ratio || 0,
          salt: parseFloat(foodDetails.salt) / ratio || 0,
      };

      const newItem = {
        id: Date.now() + Math.random(),
        name: item.name, 
        image: item.image, 
        weight: searchWeight,
        code: item.code,
        baseMacros: baseMacros,
        macros: {
          energy: foodDetails.energy, proteins: foodDetails.proteins, carbohydrates: foodDetails.carbohydrates, 
          sugars: foodDetails.sugars, lipids: foodDetails.lipids, saturated_fats: foodDetails.saturated_fats,
          fibers: foodDetails.fiber, salt: foodDetails.salt,
        }
      };

      setSelectedFoods(prev => [...prev, newItem]);
      setResults([]); setSearch(''); setSearchWeight('');

    } catch (error) {
      Alert.alert("Error", "Could not fetch food details.");
    }
    setLoadingSearch(false);
  };

  const removeSelectedFood = (indexToRemove: number) => {
      setSelectedFoods(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleCreateMeal = async () => {
    if (!mealName.trim() || selectedFoods.length === 0) {
      Alert.alert("Missing Info", "Please add a name and at least one food.");
      return;
    }
    setSavingMeal(true);

    const finalAliments = selectedFoods.map(item => {
        const weightNum = parseFloat(item.weight) || 0;
        const ratio = weightNum / 100;
        
        const calcMacro = (key: string, fallbackKey?: string) => {
             let base = item.baseMacros?.[key];
             if (base === undefined) {
                 const originalWeightRatio = (parseFloat(item.weight) || 100) / 100;
                 base = (parseFloat(item.macros?.[key] || item.macros?.[fallbackKey] || 0) / originalWeightRatio) || 0;
             }
             return (base * ratio).toFixed(1);
        };

        return {
            ...item,
            weight: weightNum,
            macros: {
                energy: calcMacro('energy'),
                proteins: calcMacro('proteins'),
                carbohydrates: calcMacro('carbohydrates'),
                sugars: calcMacro('sugars'),
                lipids: calcMacro('lipids'),
                saturated_fats: calcMacro('saturated_fats'),
                fibers: calcMacro('fibers', 'fiber'),
                salt: calcMacro('salt')
            }
        };
    });

    const mealData = {
      name: mealName,
      hourtime: getLocalISOString(date),
      total_calories: totalMealMacros.calories,
      total_proteins: totalMealMacros.proteins,
      total_carbohydrates: totalMealMacros.carbs,
      total_sugars: totalMealMacros.sugars,
      total_lipids: totalMealMacros.fats,
      total_saturated_fats: totalMealMacros.saturated_fats,
      total_fiber: totalMealMacros.fibers,
      total_salt: totalMealMacros.salt,
      aliments: finalAliments,
      is_consumed: editingId ? undefined : false
    };

    try {
      if (editingId) {
        await axios.put(`${API_URL}/updateMeal/${editingId}`, mealData);
      } else {
        await axios.post(`${API_URL}/addMeal/${user?.id}`, mealData);
      }
      await loadData();
      handleCloseModal();
    } catch (error) {
      console.log("Error saving meal:", error);
      Alert.alert("Error", "Could not save meal.");
    } finally {
        setSavingMeal(false);
    }
  };

  const handleEdit = (meal: any) => {
    resetForm();
    setMealName(meal.name);
    setDate(new Date(meal.hourtime)); 
    
    let foods = typeof meal.aliments === 'string' ? JSON.parse(meal.aliments) : meal.aliments;
    foods = foods.map((f: any) => ({
        ...f,
        id: f.id || Date.now() + Math.random(),
        weight: String(f.weight || 100), 
    }));

    setSelectedFoods(foods);
    setEditingId(meal.id);
    setIsModalVisible(true);
  };

  const handleView = (meal: any) => {
    const foods = typeof meal.aliments === 'string' ? JSON.parse(meal.aliments) : meal.aliments;
    setMealToView({ ...meal, aliments: foods });
    setIsViewModalVisible(true);
  };

  const handleDeleteMeal = async () => {
    if (!editingId) return;
    Alert.alert("Delete Meal", "Are you sure?", [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: async () => {
            try {
                await axios.delete(`${API_URL}/deleteMeal/${editingId}`);
                await loadData();
                handleCloseModal();
            } catch (error) {
                console.log("Error delete:", error);
            }
        }}
    ]);
  };

  // --- LOGIQUE CAMERA ---
  const openCameraModal = async () => {
    if (!permission?.granted) {
      const { granted } = await requestPermission();
      if (!granted) {
        Alert.alert("Permission required", "Camera access is needed.");
        return;
      }
    }
    
    isProcessingScan.current = false;
    setScanned(false);
    
    setIsModalVisible(false);
    setTimeout(() => {
        setIsCameraOpen(true);
    }, 300);
  };

  const handleBarCodeScanned = async ({ type, data }: { type: string; data: string }) => {
      if (scanned || isProcessingScan.current) return;
      isProcessingScan.current = true;
      setScanned(true);

      try {
          const response = await axios.get(`${API_URL}/scan/${data}/json`);
          const foodData = { 
              name: response.data.name || 'Scanned Food', 
              code: data, 
              image: response.data.image 
          };
          
          setNutriments(response.data);
          setSelectedFood(foodData);
          setGrammage('');

          setIsCameraOpen(false);
          setTimeout(() => {
              setIsDetailModalVisible(true);
          }, 300);

      } catch (error) {
          Alert.alert("Not Found", "Product not found. Try manual search.");
          setIsCameraOpen(false);
          setTimeout(() => setIsModalVisible(true), 300);
      } finally {
          isProcessingScan.current = false;
      }
  };
  
  const validateGrammageScan = () => {
    if (!nutriments) return;
    const g = parseFloat(grammage);
    if (isNaN(g) || g <= 0) {
        Alert.alert("Invalid Weight");
        return;
    }
    const ratio = g / 100;

    const baseMacros = {
        energy: parseFloat(nutriments.energy) || 0,
        proteins: parseFloat(nutriments.proteins) || 0,
        carbohydrates: parseFloat(nutriments.carbohydrates) || 0,
        sugars: parseFloat(nutriments.sugars) || 0,
        lipids: parseFloat(nutriments.lipids) || 0,
        saturated_fats: parseFloat(nutriments.saturated_fats) || 0,
        fibers: parseFloat(nutriments.fibers) || 0,
        salt: parseFloat(nutriments.salt) || 0,
    };

    const newItem = { 
        id: Date.now() + Math.random(),
        ...selectedFood, 
        weight: String(g), 
        baseMacros: baseMacros,
        macros: {
            energy: (nutriments.energy * ratio).toFixed(1),
            proteins: (nutriments.proteins * ratio).toFixed(1),
            carbohydrates: (nutriments.carbohydrates * ratio).toFixed(1),
            sugars: (nutriments.sugars * ratio).toFixed(1),
            lipids: (nutriments.lipids * ratio).toFixed(1),
            saturated_fats: (nutriments.saturated_fats * ratio).toFixed(1),
            fibers: (nutriments.fibers * ratio).toFixed(1),
            salt: (nutriments.salt * ratio).toFixed(1)
        }
    };
    setSelectedFoods(prev => [...prev, newItem]);
    setIsDetailModalVisible(false);
    setTimeout(() => setIsModalVisible(true), 300);
  };

  const resetForm = () => {
    setMealName(''); setSearch(''); setSearchWeight(''); setSelectedFoods([]); setResults([]);
    setDate(new Date()); setShowPicker(false); setLoadingSearch(false); setEditingId(null); setSavingMeal(false);
  };
  const handleCloseModal = () => { resetForm(); setIsModalVisible(false); };
  const getLocalISOString = (date: Date) => {
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().slice(0, -1);
  };
  const formatTime = (date: Date) => date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

  const ProgressBar = ({ label, current, total, color }: any) => {
    const target = total || (label === 'Proteins' ? 150 : label === 'Carbs' ? 250 : 70);
    const percentage = target > 0 ? Math.min(1, current / target) : 0;
    return (
      <View style={styles.macroItem}>
        <Text style={styles.macroValue}>{Math.round(current)}g</Text>
        <Text style={styles.macroLabel}>{label}</Text>
        <Text style={{color:'#666', fontSize:9}}> / {Math.round(target)}g</Text>
        <View style={{height: 4, backgroundColor: '#1A1F2B', marginTop: 5, borderRadius: 2, width: '100%'}}>
            <View style={{width: `${percentage*100}%`, backgroundColor: color, height: '100%', borderRadius: 2}} />
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* DASHBOARD */}
      {loadingStats || !dashboardStats ? (
          <ActivityIndicator color="#3498DB" style={{margin: 20}} />
      ) : (
          <View style={styles.statsContainer}>
            <View style={styles.calorieGoalContainer}>
                <View>
                    <Text style={styles.calorieGoalText}>
                        <Text style={{fontSize: 24, fontWeight: 'bold'}}>{Math.round(dashboardStats.calories_consumed)}</Text>
                        <Text style={{color: '#aaa'}}> / {Math.round(dashboardStats.daily_caloric_goal)} kcal</Text>
                    </Text>
                    <Text style={styles.caloriesRemaining}>{Math.round(dashboardStats.calories_remaining)} Remaining</Text>
                </View>
                <TouchableOpacity onPress={() => { setNewGoal(dashboardStats.daily_caloric_goal.toString()); setIsGoalModalVisible(true); }} style={{padding: 5}}>
                    <Ionicons name="pencil-outline" size={20} color="#3498DB" />
                </TouchableOpacity>
            </View>

            <View style={styles.progressContainer}>
                <View style={[styles.progressBarFill, { width: `${dashboardStats.progress_percentage * 100}%`, backgroundColor: dashboardStats.progress_percentage >= 1 ? '#e74c3c' : '#3498DB' }]} />
            </View>

            <View style={styles.macrosContainer}>
                <ProgressBar label="Proteins" current={dashboardStats.proteins_consumed} total={dashboardStats.goal_proteins} color="#9b59b6" />
                <ProgressBar label="Carbs" current={dashboardStats.carbs_consumed} total={dashboardStats.goal_carbs} color="#f1c40f" />
                <ProgressBar label="Fats" current={dashboardStats.fats_consumed} total={dashboardStats.goal_fats} color="#e67e22" />
            </View>
          </View>
      )}

      {invitations.length > 0 && (
        <View style={styles.invitationContainer}>
          <Text style={styles.invitationTitle}>New Coaching Requests ({invitations.length})</Text>
          <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 10, paddingRight: 20 }}
          >
            {invitations.map((inv: any) => (
              <TouchableOpacity 
                key={inv.id} 
                style={styles.invitationCardHorizontal}
                onPress={() => router.push({
                  pathname: "/clients/coach-public-profile",
                  params: { coachId: inv.coach_id, invitationId: inv.id }
                })}
              >
                <View style={styles.miniAvatar}>
                  <Text style={styles.miniAvatarText}>{inv.coach_firstname ? inv.coach_firstname[0] : '?'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.invitationText} numberOfLines={1}>
                    <Text style={{ fontWeight: 'bold' }}>{inv.coach_firstname} {inv.coach_lastname}</Text>
                  </Text>
                  <Text style={styles.coachCityText}>
                      <Ionicons name="location" size={12} color="#8A8D91" /> {inv.coach_city || 'Remote'}
                  </Text>
                  <Text style={styles.viewProfileLink}>Tap to view profile & accept</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#3498DB" />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 10}}>
          <Text style={styles.catalogueTitle}>Today's Meals</Text>
      </View>

      <ScrollView style={styles.mealsContainer} showsVerticalScrollIndicator={false}>
        {myMeals.length === 0 && <Text style={{color: 'gray', textAlign: 'center', marginTop: 20}}>No meals added yet.</Text>}
        {myMeals.map((meal, index) => (
            <MealCard key={index} meal={meal} onToggleEat={handleToggleEat} onView={handleView} onEdit={handleEdit}/>
        ))}
        <View style={{ height: 80 }} />
      </ScrollView>

      <TouchableOpacity style={styles.addButton} onPress={() => { resetForm(); setIsModalVisible(true); }}>
        <Ionicons name="add" size={30} color="#fff" />
      </TouchableOpacity>

      <Modal visible={isModalVisible} animationType="slide" transparent onRequestClose={handleCloseModal}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={Keyboard.dismiss}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ width: '100%', alignItems:'center' }}>
            <TouchableWithoutFeedback>
            <View style={styles.mealModalContent}>
                <Text style={styles.modalTitle}>{editingId ? "Edit Meal" : "Create Meal"}</Text>
                
                <View style={{flexDirection: 'row', gap: 10, marginBottom: 15}}>
                    <View style={{flex: 1}}>
                         <Text style={styles.inputLabelModal}>Time</Text>
                         <TouchableOpacity onPress={() => setShowPicker(!showPicker)} style={styles.timeButtonNew}>
                             <Text style={styles.timeTextNew}>{formatTime(date)}</Text>
                             <Ionicons name="time-outline" size={18} color="#2ecc71" />
                         </TouchableOpacity>
                    </View>
                    <View style={{flex: 2}}>
                        <Text style={styles.inputLabelModal}>Meal Name</Text>
                        <TextInput style={styles.inputModal} placeholder="e.g. Lunch" placeholderTextColor="#888" value={mealName} onChangeText={setMealName} />
                    </View>
                </View>
                 {showPicker && <DateTimePicker value={date} mode="time" display="spinner" onChange={(e,d) => {setShowPicker(Platform.OS==='ios'); if(d) setDate(d);}} themeVariant="dark" />}


                <Text style={styles.inputLabelModal}>Add Food (Enter Weight first!)</Text>
                <View style={styles.searchRowNew}>
                    <TextInput 
                        style={[styles.inputModal, {width: 80, textAlign:'center', marginBottom: 0}]} 
                        placeholder="g" 
                        keyboardType="numeric"  
                        value={searchWeight} 
                        onChangeText={setSearchWeight} 
                        placeholderTextColor="#888"
                    />
                    <TextInput 
                        style={[styles.inputModal, {flex: 1, marginLeft: 10, marginBottom: 0}]} 
                        placeholder="Search food..." 
                        placeholderTextColor="#888" 
                        value={search} 
                        onChangeText={setSearch} 
                        onSubmitEditing={searchFood}
                    />
                    <TouchableOpacity style={styles.searchBtnNew} onPress={searchFood}>
                        {loadingSearch ? <ActivityIndicator size="small" color="white"/> : <Ionicons name="search" size={20} color="white" />}
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.scanBtnNew} onPress={openCameraModal}>
                        <Ionicons name="barcode-outline" size={20} color="white" />
                    </TouchableOpacity>
                </View>
                
                {results.length > 0 && (
                    <View style={styles.resultsBoxNew}>
                        <ScrollView nestedScrollEnabled keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled">
                            {results.map((item, i) => (
                                <TouchableOpacity key={i} style={styles.resultItemNew} onPress={() => handleSelectFood(item)}>
                                    <FoodImage uri={item.image} style={styles.resultImageNew} iconSize={18}/>
                                    <Text style={styles.resultTextNew} numberOfLines={1}>{item.name}</Text>
                                    <Ionicons name="add-circle" size={24} color="#2ecc71" />
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                )}

                <View style={styles.fixedListContainerNew}>
                    <Text style={[styles.inputLabelModal, {marginBottom: 5}]}>Selected Items ({selectedFoods.length})</Text>
                    {selectedFoods.length === 0 ? (
                        <View style={styles.emptyListPlaceholderNew}>
                            <Text style={{color:'#666'}}>No food selected.</Text>
                            <Text style={{color:'#444', fontSize:10}}>Add food via search or scan</Text>
                        </View>
                    ) : (
                        <ScrollView nestedScrollEnabled style={{width: '100%'}} keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled">
                            {selectedFoods.map((item, index) => {
                                 const weightNum = parseFloat(item.weight) || 0;
                                 const ratio = weightNum / 100;
                                 let baseEnergy = item.baseMacros?.energy;
                                 if (baseEnergy === undefined) {
                                     const originalWeightRatio = (parseFloat(item.weight) || 100) / 100;
                                     baseEnergy = (parseFloat(item.macros?.energy || 0) / originalWeightRatio) || 0;
                                 }
                                 const dynamicKcal = Math.round(baseEnergy * ratio);

                                return (
                                <View key={item.id || index} style={styles.selectedFoodRowNew}>
                                    <FoodImage uri={item.image} style={styles.selectedFoodImageNew} iconSize={18} />
                                    <View style={styles.selectedFoodInfoNew}>
                                        <Text style={styles.selectedFoodNameNew} numberOfLines={1}>{item.name}</Text>
                                        <View style={{flexDirection: 'row', alignItems: 'center', marginTop: 4}}>
                                            <TextInput 
                                                style={styles.amountInputNew} 
                                                keyboardType="numeric" 
                                                value={String(item.weight)} 
                                                onChangeText={(val) => updateFoodWeight(index, val)} 
                                            />
                                            <Text style={{color: '#aaa', fontSize: 12, marginLeft: 5}}>
                                                g • <Text style={{color:'#2ecc71', fontWeight:'bold'}}>{dynamicKcal}</Text> kcal
                                            </Text>
                                        </View>
                                    </View>
                                    <TouchableOpacity onPress={() => removeSelectedFood(index)} style={{padding:8}}>
                                        <Ionicons name="trash-outline" size={22} color="#e74c3c" />
                                    </TouchableOpacity>
                                </View>
                            )})}
                        </ScrollView>
                    )}
                </View>

                <View style={styles.summaryBoxNew}>
                    <Text style={styles.summaryTitleNew}>Total: {totalMealMacros.calories.toFixed(0)} kcal</Text>
                    <Text style={styles.summaryTextNew}>P: {totalMealMacros.proteins.toFixed(1)}g | C: {totalMealMacros.carbs.toFixed(1)}g | F: {totalMealMacros.fats.toFixed(1)}g</Text>
                </View>

                <View style={[styles.modalActionsNew, { gap: 10 }]}>
                    {editingId && (
                        <TouchableOpacity style={[styles.modalButtonNew, {backgroundColor:'#c0392b', flex: 0.25}]} onPress={handleDeleteMeal} disabled={savingMeal}>
                            <Ionicons name="trash-outline" size={20} color="white" />
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity style={[styles.modalButtonNew, styles.cancelButtonNew, { flex: 1 }]} onPress={handleCloseModal}>
                        <Text style={styles.buttonTextNew}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.modalButtonNew, styles.saveButtonNew, { flex: 1 }]} onPress={handleCreateMeal} disabled={savingMeal}>
                        {savingMeal ? <ActivityIndicator color="white" size="small" /> : <Text style={styles.buttonTextNew}>{editingId ? "Update" : "Save"}</Text>}
                    </TouchableOpacity>
                </View>
            </View>
            </TouchableWithoutFeedback>
            </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>

      <Modal visible={isCameraOpen} animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'black' }}>
            <CameraView 
                style={StyleSheet.absoluteFillObject} 
                facing="back" 
                onBarcodeScanned={scanned ? undefined : handleBarCodeScanned} 
            />
            <View style={styles.overlay}>
                <View style={styles.layerTop} />
                <View style={styles.layerCenter}>
                    <View style={styles.layerLeft} />
                    <View style={styles.focused}>
                        <View style={[styles.corner, {top:0, left:0, borderTopWidth:3, borderLeftWidth:3}]} />
                        <View style={[styles.corner, {top:0, right:0, borderTopWidth:3, borderRightWidth:3}]} />
                        <View style={[styles.corner, {bottom:0, left:0, borderBottomWidth:3, borderLeftWidth:3}]} />
                        <View style={[styles.corner, {bottom:0, right:0, borderBottomWidth:3, borderRightWidth:3}]} />
                    </View>
                    <View style={styles.layerRight} />
                </View>
                <View style={styles.layerBottom} />
            </View>
            <View style={{position:'absolute', top: 60, width:'100%', alignItems:'center'}}>
                <Text style={{color:'white', fontSize: 18, fontWeight:'bold', textShadowColor:'black', textShadowRadius:5}}>
                    Scan Barcode
                </Text>
            </View>
            <TouchableOpacity 
                style={styles.closeCameraButton} 
                onPress={() => { setIsCameraOpen(false); setIsModalVisible(true); }}
            >
                <Ionicons name="close" size={32} color="black" />
            </TouchableOpacity>
        </View>
      </Modal>

      <Modal visible={isDetailModalVisible} animationType="slide" transparent>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={Keyboard.dismiss}>
            <View style={[styles.mealModalContent, {height: 'auto'}]}>
                {selectedFood && (
                    <>
                        <Text style={styles.modalTitle}>{selectedFood.name}</Text>
                        <FoodImage uri={selectedFood.image} style={{width: 100, height: 100, borderRadius: 10, alignSelf:'center', marginBottom:15}} />
                        
                        <Text style={[styles.inputLabelModal, {textAlign:'center'}]}>Enter Weight (g)</Text>
                        <TextInput 
                            style={[styles.inputModal, {marginBottom: 20, textAlign:'center', fontSize: 20, fontWeight:'bold'}]} 
                            keyboardType="numeric" 
                            value={grammage} 
                            onChangeText={setGrammage} 
                            placeholder="e.g. 100" 
                            placeholderTextColor="#555"
                            autoFocus
                        />
                        
                        <View style={styles.modalActionsNew}>
                            <TouchableOpacity onPress={() => { setIsDetailModalVisible(false); setIsModalVisible(true); }} style={[styles.modalButtonNew, styles.cancelButtonNew]}>
                                <Text style={styles.buttonTextNew}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={validateGrammageScan} style={[styles.modalButtonNew, styles.saveButtonNew]}>
                                <Text style={styles.buttonTextNew}>Add to Meal</Text>
                            </TouchableOpacity>
                        </View>
                    </>
                )}
            </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={isViewModalVisible} animationType="fade" transparent onRequestClose={() => setIsViewModalVisible(false)}>
        <View style={styles.modalBackground}>
            <View style={styles.modalContainer}>
                {mealToView && (
                    <>
                        <Text style={styles.modalTitle}>{mealToView.name}</Text>
                        <ScrollView style={{maxHeight: 300}}>
                            {mealToView.aliments.map((f: any, i: number) => (
                                <View key={i} style={styles.resultItem}>
                                    <FoodImage uri={f.image} style={styles.resultImage} iconSize={20} />
                                    <View style={{flex:1}}>
                                        <Text style={styles.resultText}>{f.name}</Text>
                                        <Text style={{color:'#aaa', fontSize:12}}>Weight: {f.weight}g</Text>
                                    </View>
                                    <View style={{alignItems:'flex-end'}}>
                                        <Text style={{color:'#3498DB', fontWeight:'bold'}}>{Math.round(f.macros?.energy)}</Text>
                                        <Text style={{color:'#3498DB', fontSize:10}}>kcal</Text>
                                    </View>
                                </View>
                            ))}
                        </ScrollView>
                        <TouchableOpacity style={styles.closeButton} onPress={() => setIsViewModalVisible(false)}>
                            <Text style={{color:'white'}}>Close</Text>
                        </TouchableOpacity>
                    </>
                )}
            </View>
        </View>
       </Modal>

       <Modal visible={isGoalModalVisible} animationType="fade" transparent>
        <TouchableOpacity style={styles.modalBackground} activeOpacity={1} onPress={() => setIsGoalModalVisible(false)}>
            <View style={[styles.modalContainer, {width: '80%'}]}>
                <Text style={styles.modalTitle}>Daily Goal</Text>
                <TextInput style={styles.textInput} keyboardType="numeric" value={newGoal} onChangeText={setNewGoal} placeholder="e.g. 2500" placeholderTextColor="#777" autoFocus/>
                <View style={{flexDirection:'row', justifyContent:'flex-end', marginTop: 20}}>
                    <TouchableOpacity onPress={handleUpdateGoal} style={styles.modalAddButton} disabled={updatingGoal}>
                        {updatingGoal ? <ActivityIndicator size="small" color="white"/> : <Text style={{color:'white'}}>Save</Text>}
                    </TouchableOpacity>
                </View>
            </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1A1F2B', paddingHorizontal: 16 },
  statsContainer: { backgroundColor: '#232D3F', borderRadius: 16, padding: 15, marginBottom: 15, marginTop: 15 }, // 🔥 Added marginTop: 15
  calorieGoalContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  calorieGoalText: { color: 'white' },
  caloriesRemaining: { color: '#bbb', fontSize: 12, marginTop: 4 },
  progressContainer: { height: 10, backgroundColor: '#1A1F2B', borderRadius: 5, marginTop: 15, overflow: 'hidden' },
  progressBarFill: { height: '100%' },
  macrosContainer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 15 },
  macroItem: { width: '30%', backgroundColor: '#2A4562', padding: 8, borderRadius: 8, alignItems: 'center' },
  macroValue: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  macroLabel: { color: '#ccc', fontSize: 10 },
  catalogueTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
  mealsContainer: { flex: 1 },
  invitationContainer: { marginVertical: 10 },
  invitationTitle: { color: '#8A8D91', fontSize: 12, fontWeight: 'bold', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 },
  invitationCardHorizontal: { backgroundColor: '#232D3F', borderRadius: 16, padding: 15, borderLeftWidth: 4, borderLeftColor: '#f1c40f', flexDirection: 'row', alignItems: 'center', width: 280, marginRight: 15, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84 },
  miniAvatar: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: '#3498DB', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  miniAvatarText: { color: 'white', fontWeight: 'bold', fontSize: 18 },
  invitationText: { color: 'white', fontSize: 14 },
  coachCityText: { color: '#8A8D91', fontSize: 12, marginTop: 2 },
  viewProfileLink: { color: '#f1c40f', fontSize: 12, marginTop: 4, fontWeight: 'bold' },
  addButton: { position: 'absolute', bottom: 20, right: 20, backgroundColor: '#3498DB', width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', elevation: 5 },
  modalBackground: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center" },
  modalContainer: { width: "90%", backgroundColor: "#2A4562", borderRadius: 15, padding: 20, maxHeight: '90%' }, 
  textInput: { backgroundColor: '#1A1F2B', color: 'white', padding: 12, borderRadius: 8 },
  closeButton: { backgroundColor: '#e74c3c', padding: 12, borderRadius: 10, alignItems: 'center', marginTop: 10, width:'100%' },
  createButton: { backgroundColor: '#3498DB', padding: 15, borderRadius: 10, alignItems: 'center', width:'100%' },
  modalAddButton: { backgroundColor: '#2ecc71', padding: 12, borderRadius: 8, alignItems: 'center', minWidth: 80 },
  resultItem: { flexDirection: 'row', alignItems: 'center', padding: 10, borderBottomWidth:1, borderBottomColor:'#333' },
  resultImage: { width: 40, height: 40, borderRadius: 20, marginRight: 10 },
  resultText: { color: 'white', fontWeight: 'bold', flex: 1 },
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  layerTop: { flex: 1, width: '100%', backgroundColor: 'rgba(0, 0, 0, 0.6)' },
  layerCenter: { flexDirection: 'row', height: 250 },
  layerLeft: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.6)' },
  focused: { width: 250, height: 250, borderWidth: 1, borderColor: '#3498DB', backgroundColor: 'transparent' },
  layerRight: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.6)' },
  layerBottom: { flex: 1, width: '100%', backgroundColor: 'rgba(0, 0, 0, 0.6)' },
  corner: { position: 'absolute', width: 20, height: 20, borderColor: 'white' },
  closeCameraButton: { position: 'absolute', bottom: 50, alignSelf:'center', backgroundColor:'white', width:60, height:60, borderRadius:30, justifyContent:'center', alignItems:'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 20 },
  mealModalContent: { backgroundColor: '#1A1F2B', borderRadius: 15, padding: 20, borderWidth: 1, borderColor: '#2ecc71', maxHeight: '90%', width: '100%' },
  modalTitle: { color: 'white', fontSize: 18, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
  inputLabelModal: { color: '#aaa', marginBottom: 8, fontSize: 13, fontWeight: 'bold' },
  inputModal: { backgroundColor: '#2A4562', color: 'white', padding: 12, borderRadius: 8, fontSize: 16, marginBottom: 10 },
  timeButtonNew: { backgroundColor: '#2A4562', padding: 12, borderRadius: 8, marginBottom: 10, flexDirection:'row', justifyContent:'space-between', alignItems:'center' },
  timeTextNew: { color: 'white', fontWeight: 'bold' },
  searchRowNew: { flexDirection: 'row', gap: 10, marginBottom: 15 },
  searchBtnNew: { backgroundColor: '#3498DB', padding: 12, borderRadius: 8, justifyContent: 'center', width: 44, alignItems:'center' },
  scanBtnNew: { backgroundColor: '#9b59b6', padding: 12, borderRadius: 8, justifyContent: 'center', width: 44, alignItems:'center' },
  resultsBoxNew: { backgroundColor: '#1E2C3D', borderRadius: 8, padding: 5, maxHeight: 150, marginBottom: 10 },
  resultItemNew: { flexDirection: 'row', alignItems: 'center', padding: 10, borderBottomWidth: 1, borderBottomColor: '#333' },
  resultImageNew: { width: 30, height: 30, borderRadius: 15, marginRight: 10 },
  resultTextNew: { color: 'white', fontWeight: 'bold', flex: 1 },
  fixedListContainerNew: { height: 180, marginBottom: 10, flexShrink: 1 },
  modalActionsNew: { flexDirection: 'row', marginTop: 15, width:'100%', paddingBottom: 5 },
  emptyListPlaceholderNew: { flex: 1, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#444', borderStyle: 'dashed', borderRadius: 8, backgroundColor: '#253545' },
  selectedFoodRowNew: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1F2937', padding: 10, borderRadius: 8, marginBottom: 8, borderLeftWidth: 3, borderLeftColor: '#2ecc71' },
  selectedFoodImageNew: { width: 35, height: 35, borderRadius: 8, marginRight: 10 },
  selectedFoodInfoNew: { flex: 1 },
  selectedFoodNameNew: { color: 'white', fontWeight: 'bold', fontSize: 14 },
  amountInputNew: { backgroundColor: '#1A1F2B', color: 'white', width: 50, textAlign: 'center', borderRadius: 4, padding: 4, fontSize: 12 },
  summaryBoxNew: { marginTop: 10, padding: 15, backgroundColor: '#232D3F', borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: '#2ecc71' },
  summaryTitleNew: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  summaryTextNew: { color: '#aaa', fontSize: 12, marginTop: 4 },
  modalButtonNew: { flex: 0.48, padding: 15, borderRadius: 8, alignItems: 'center', justifyContent:'center' },
  cancelButtonNew: { backgroundColor: '#e74c3c' },
  saveButtonNew: { backgroundColor: '#2ecc71' },
  buttonTextNew: { color: 'white', fontWeight: 'bold' },
});

export default HomeScreen;