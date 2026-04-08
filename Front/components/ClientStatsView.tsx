import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '@/services/api';
import SimpleLineChart from './charts/SimpleLineChart';
import GroupedBarChart from './charts/GroupedBarChart';
import DonutChart, { formatMuscleLabel } from './charts/DonutChart';
import HorizontalDistribution from './charts/HorizontalDistribution';

interface ClientStatsViewProps {
  clientId: number;
}

const PERIODS = [
  { label: '7d', value: 7 },
  { label: '30d', value: 30 },
  { label: '90d', value: 90 },
];

const MUSCLE_COLORS: Record<string, string> = {
  chest: '#e74c3c', back: '#3498DB', shoulders: '#f39c12', biceps: '#9b59b6',
  triceps: '#e67e22', quadriceps: '#2ecc71', hamstrings: '#1abc9c', calves: '#34495e',
  abs: '#e91e63', glutes: '#00bcd4', forearms: '#8bc34a', other: '#888',
};

const MEAL_TYPE_LABELS: Record<string, string> = {
  breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack', other: 'Other',
};

const MEAL_TYPE_COLORS: Record<string, string> = {
  breakfast: '#f39c12', lunch: '#2ecc71', dinner: '#3498DB', snack: '#9b59b6', other: '#888',
};

export default function ClientStatsView({ clientId }: ClientStatsViewProps) {
  const [period, setPeriod] = useState(30);
  const [statsTab, setStatsTab] = useState<'training' | 'meals'>('training');
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, [period, clientId]);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/coaches/client-stats/${clientId}?period=${period}`);
      setStats(res.data);
    } catch (err) {
      console.error('Error fetching client stats:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3498DB" />
      </View>
    );
  }

  if (!stats) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.emptyText}>No statistics available</Text>
      </View>
    );
  }

  const ws = stats.workout_stats;
  const ns = stats.nutrition_stats;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Period selector */}
      <View style={styles.periodRow}>
        {PERIODS.map(p => (
          <TouchableOpacity
            key={p.value}
            style={[styles.periodPill, period === p.value && styles.periodPillActive]}
            onPress={() => setPeriod(p.value)}
          >
            <Text style={[styles.periodText, period === p.value && styles.periodTextActive]}>{p.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Training / Meals toggle */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabBtn, statsTab === 'training' && styles.tabBtnActive]}
          onPress={() => setStatsTab('training')}
        >
          <Ionicons name="barbell-outline" size={16} color={statsTab === 'training' ? '#3498DB' : '#666'} />
          <Text style={[styles.tabText, statsTab === 'training' && styles.tabTextActive]}>Training</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, statsTab === 'meals' && styles.tabBtnActive]}
          onPress={() => setStatsTab('meals')}
        >
          <Ionicons name="restaurant-outline" size={16} color={statsTab === 'meals' ? '#3498DB' : '#666'} />
          <Text style={[styles.tabText, statsTab === 'meals' && styles.tabTextActive]}>Meals</Text>
        </TouchableOpacity>
      </View>

      {statsTab === 'training' ? renderTrainingTab(ws, period) : renderMealsTab(ns, stats.calorie_goal, period)}
    </ScrollView>
  );
}

// ─── TRAINING TAB ──────────────────────────────────────────
function renderTrainingTab(ws: any, period: number) {
  const weeklyAttendanceData = (ws.weekly || []).map((w: any) => ({
    label: w.week_start.slice(5),
    value1: w.total || 0,
    value2: w.completed || 0,
  }));

  const muscleSegments = Object.entries(ws.muscle_distribution || {})
    .sort((a, b) => (b[1] as number) - (a[1] as number))
    .map(([key, value]) => ({
      label: formatMuscleLabel(key),
      value: value as number,
      color: MUSCLE_COLORS[key.toLowerCase()] || '#888',
    }));

  const weeklyRatingData = (ws.weekly || [])
    .filter((w: any) => w.avg_rating > 0)
    .map((w: any) => ({ label: w.week_start.slice(5), value: w.avg_rating }));

  const difficultySegments = [
    { label: 'Too Easy', value: ws.difficulty_distribution?.too_easy || 0, color: '#2ecc71' },
    { label: 'Just Right', value: ws.difficulty_distribution?.just_right || 0, color: '#3498DB' },
    { label: 'Hard', value: ws.difficulty_distribution?.hard || 0, color: '#f39c12' },
    { label: 'Too Hard', value: ws.difficulty_distribution?.too_hard || 0, color: '#e74c3c' },
  ];

  const energySegments = [
    { label: 'Fresh', value: ws.energy_distribution?.fresh || 0, color: '#2ecc71' },
    { label: 'Normal', value: ws.energy_distribution?.normal || 0, color: '#3498DB' },
    { label: 'Tired', value: ws.energy_distribution?.tired || 0, color: '#f39c12' },
    { label: 'Exhausted', value: ws.energy_distribution?.exhausted || 0, color: '#e74c3c' },
  ];

  return (
    <>
      {/* KPI Cards */}
      <View style={styles.kpiRow}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiValue}>{ws.completed > 0 ? (ws.completed / (period / 7)).toFixed(1) : '-'}</Text>
          <Text style={styles.kpiLabel}>Sessions/wk</Text>
        </View>
        <View style={styles.kpiCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={styles.kpiValue}>{ws.avg_rating?.toFixed(1) || '-'}</Text>
            <Ionicons name="star" size={16} color="#f39c12" />
          </View>
          <Text style={styles.kpiLabel}>Avg Rating</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiValue}>{ws.completed}/{ws.total}</Text>
          <Text style={styles.kpiLabel}>Completed</Text>
        </View>
      </View>

      {/* Weekly Attendance */}
      {weeklyAttendanceData.length > 0 && (
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Weekly Attendance</Text>
          <GroupedBarChart data={weeklyAttendanceData} color1="#3498DB" color2="#2ecc71" label1="Planned" label2="Done" />
        </View>
      )}

      {/* Muscles Worked */}
      {muscleSegments.length > 0 && (
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Muscles Worked</Text>
          <DonutChart segments={muscleSegments} />
        </View>
      )}

      {/* Avg Rating by Week */}
      {weeklyRatingData.length > 0 && (
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Average Rating Over Time</Text>
          <SimpleLineChart data={weeklyRatingData} color="#f39c12" suffix="" />
        </View>
      )}

      {/* Difficulty Distribution */}
      {difficultySegments.some(s => s.value > 0) && (
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Perceived Difficulty</Text>
          <HorizontalDistribution segments={difficultySegments} />
        </View>
      )}

      {/* Energy Distribution */}
      {energySegments.some(s => s.value > 0) && (
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Energy Level</Text>
          <HorizontalDistribution segments={energySegments} />
        </View>
      )}
    </>
  );
}

// ─── MEALS TAB ─────────────────────────────────────────────
function renderMealsTab(ns: any, calorieGoal: number, period: number) {
  const dailyCaloriesData = (ns.daily || []).map((d: any) => ({
    label: d.date.slice(5),
    value: d.calories || 0,
  }));
  const caloriesChartData = dailyCaloriesData.length > 30
    ? dailyCaloriesData.filter((_: any, i: number) => i % Math.ceil(dailyCaloriesData.length / 30) === 0)
    : dailyCaloriesData;

  const dailyProteinData = (ns.daily || []).map((d: any) => ({
    label: d.date.slice(5),
    value: d.proteins || 0,
  }));
  const proteinChartData = dailyProteinData.length > 30
    ? dailyProteinData.filter((_: any, i: number) => i % Math.ceil(dailyProteinData.length / 30) === 0)
    : dailyProteinData;

  const mealTypeSegments = Object.entries(ns.meal_type_distribution || {})
    .sort((a, b) => (b[1] as number) - (a[1] as number))
    .map(([key, value]) => ({
      label: MEAL_TYPE_LABELS[key.toLowerCase()] || key.charAt(0).toUpperCase() + key.slice(1),
      value: value as number,
      color: MEAL_TYPE_COLORS[key.toLowerCase()] || '#888',
    }));

  // Macro calorie split (4cal/g protein & carbs, 9cal/g fat)
  const protCal = (ns.avg_proteins || 0) * 4;
  const carbCal = (ns.avg_carbs || 0) * 4;
  const fatCal = (ns.avg_fats || 0) * 9;
  const macroCalSegments = (protCal + carbCal + fatCal) > 0 ? [
    { label: 'Protein', value: Math.round(protCal), color: '#e74c3c' },
    { label: 'Carbs', value: Math.round(carbCal), color: '#f39c12' },
    { label: 'Fats', value: Math.round(fatCal), color: '#2ecc71' },
  ] : [];

  return (
    <>
      {/* KPI Cards */}
      <View style={styles.kpiRow}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiValue}>{ns.avg_daily_calories?.toFixed(0) || '-'}</Text>
          <Text style={styles.kpiLabel}>Avg Cal/day</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiValue}>{ns.avg_proteins?.toFixed(0) || '-'}g</Text>
          <Text style={styles.kpiLabel}>Avg Protein</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiValue}>{ns.days_logged || 0}/{period}</Text>
          <Text style={styles.kpiLabel}>Days Logged</Text>
        </View>
      </View>

      {/* Average Daily Macros */}
      {(ns.avg_proteins > 0 || ns.avg_carbs > 0 || ns.avg_fats > 0) && (
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Average Daily Macros</Text>
          <View style={styles.macroRow}>
            <View style={styles.macroItem}>
              <View style={[styles.macroBar, { backgroundColor: '#e74c3c', height: Math.min(80, Math.max(20, (ns.avg_proteins / Math.max(ns.avg_proteins, ns.avg_carbs, ns.avg_fats, 1)) * 80)) }]} />
              <Text style={styles.macroValue}>{ns.avg_proteins?.toFixed(0)}g</Text>
              <Text style={styles.macroLabel}>Protein</Text>
            </View>
            <View style={styles.macroItem}>
              <View style={[styles.macroBar, { backgroundColor: '#f39c12', height: Math.min(80, Math.max(20, (ns.avg_carbs / Math.max(ns.avg_proteins, ns.avg_carbs, ns.avg_fats, 1)) * 80)) }]} />
              <Text style={styles.macroValue}>{ns.avg_carbs?.toFixed(0)}g</Text>
              <Text style={styles.macroLabel}>Carbs</Text>
            </View>
            <View style={styles.macroItem}>
              <View style={[styles.macroBar, { backgroundColor: '#2ecc71', height: Math.min(80, Math.max(20, (ns.avg_fats / Math.max(ns.avg_proteins, ns.avg_carbs, ns.avg_fats, 1)) * 80)) }]} />
              <Text style={styles.macroValue}>{ns.avg_fats?.toFixed(0)}g</Text>
              <Text style={styles.macroLabel}>Fats</Text>
            </View>
          </View>
        </View>
      )}

      {/* Calorie Split by Macro (donut) */}
      {macroCalSegments.length > 0 && (
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Calorie Split</Text>
          <DonutChart segments={macroCalSegments} />
        </View>
      )}

      {/* Daily Calories */}
      {caloriesChartData.length > 0 && (
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Daily Calories</Text>
          <SimpleLineChart data={caloriesChartData} color="#3498DB" goalValue={calorieGoal} goalColor="#e74c3c" goalLabel="Goal" />
        </View>
      )}

      {/* Daily Protein */}
      {proteinChartData.length > 0 && (
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Daily Protein (g)</Text>
          <SimpleLineChart data={proteinChartData} color="#e74c3c" suffix="g" />
        </View>
      )}

      {/* Meal Type Distribution */}
      {mealTypeSegments.length > 0 && (
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Meal Types</Text>
          <DonutChart segments={mealTypeSegments} />
        </View>
      )}

      {ns.days_logged === 0 && (
        <View style={{ alignItems: 'center', paddingVertical: 40 }}>
          <Ionicons name="restaurant-outline" size={40} color="#444" />
          <Text style={{ color: '#666', marginTop: 12, fontSize: 14 }}>No meals logged for this period</Text>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
  emptyText: { color: '#666', fontSize: 15 },

  periodRow: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginVertical: 16 },
  periodPill: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20, backgroundColor: '#232D3F' },
  periodPillActive: { backgroundColor: 'rgba(52, 152, 219, 0.2)', borderWidth: 1, borderColor: '#3498DB' },
  periodText: { color: '#888', fontSize: 14, fontWeight: '600' },
  periodTextActive: { color: '#3498DB' },

  tabRow: { flexDirection: 'row', backgroundColor: '#232D3F', borderRadius: 12, padding: 4, marginBottom: 16 },
  tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10 },
  tabBtnActive: { backgroundColor: 'rgba(52, 152, 219, 0.15)' },
  tabText: { color: '#666', fontSize: 14, fontWeight: '600' },
  tabTextActive: { color: '#3498DB' },

  kpiRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  kpiCard: { flex: 1, backgroundColor: '#232D3F', borderRadius: 14, padding: 16, alignItems: 'center' },
  kpiValue: { color: 'white', fontSize: 24, fontWeight: 'bold' },
  kpiLabel: { color: '#888', fontSize: 11, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 },

  chartCard: { backgroundColor: '#232D3F', borderRadius: 14, padding: 16, marginBottom: 14 },
  chartTitle: { color: 'white', fontSize: 15, fontWeight: 'bold', marginBottom: 14 },

  macroRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', paddingVertical: 10 },
  macroItem: { alignItems: 'center', gap: 6 },
  macroBar: { width: 40, borderRadius: 6 },
  macroValue: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  macroLabel: { color: '#888', fontSize: 11 },
});
