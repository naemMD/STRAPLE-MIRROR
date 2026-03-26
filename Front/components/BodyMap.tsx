import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import Svg, { Path, Circle, Ellipse, G } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SVG_WIDTH = Math.min(SCREEN_WIDTH - 60, 300);
const SVG_HEIGHT = SVG_WIDTH * 1.9;

// ─── Zone definitions ───────────────────────────────────────────────
// Each zone has an SVG path (relative to a 200×380 viewBox) and a label.

interface ZoneDef {
  id: string;
  label: string;
  side: 'front' | 'back' | 'both';
  // SVG shape data — we use ellipses/rects described as {cx,cy,rx,ry}
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

const ZONES: ZoneDef[] = [
  // ── Head / Neck ──
  { id: 'neck', label: 'Neck', side: 'both', cx: 100, cy: 58, rx: 12, ry: 8 },

  // ── Shoulders ──
  { id: 'left_shoulder', label: 'Left Shoulder', side: 'front', cx: 62, cy: 82, rx: 16, ry: 12 },
  { id: 'right_shoulder', label: 'Right Shoulder', side: 'front', cx: 138, cy: 82, rx: 16, ry: 12 },

  // ── Trapezius (back view — between neck and shoulders) ──
  { id: 'left_trapezius', label: 'Left Trapezius', side: 'back', cx: 76, cy: 74, rx: 18, ry: 14 },
  { id: 'right_trapezius', label: 'Right Trapezius', side: 'back', cx: 124, cy: 74, rx: 18, ry: 14 },

  // ── Chest ──
  { id: 'chest', label: 'Chest', side: 'front', cx: 100, cy: 105, rx: 28, ry: 18 },

  // ── Upper arms (biceps front, triceps back) ──
  { id: 'left_bicep', label: 'Left Bicep', side: 'front', cx: 46, cy: 115, rx: 10, ry: 22 },
  { id: 'right_bicep', label: 'Right Bicep', side: 'front', cx: 154, cy: 115, rx: 10, ry: 22 },
  { id: 'left_tricep', label: 'Left Tricep', side: 'back', cx: 46, cy: 115, rx: 10, ry: 22 },
  { id: 'right_tricep', label: 'Right Tricep', side: 'back', cx: 154, cy: 115, rx: 10, ry: 22 },

  // ── Abs / Upper back ──
  { id: 'abs', label: 'Abs', side: 'front', cx: 100, cy: 145, rx: 24, ry: 22 },
  { id: 'upper_back', label: 'Upper Back', side: 'back', cx: 100, cy: 105, rx: 28, ry: 18 },
  { id: 'lower_back', label: 'Lower Back', side: 'back', cx: 100, cy: 145, rx: 24, ry: 18 },

  // ── Forearms ──
  { id: 'left_forearm', label: 'Left Forearm', side: 'front', cx: 38, cy: 155, rx: 8, ry: 20 },
  { id: 'right_forearm', label: 'Right Forearm', side: 'front', cx: 162, cy: 155, rx: 8, ry: 20 },

  // ── Elbows ──
  { id: 'left_elbow', label: 'Left Elbow', side: 'both', cx: 42, cy: 138, rx: 8, ry: 8 },
  { id: 'right_elbow', label: 'Right Elbow', side: 'both', cx: 158, cy: 138, rx: 8, ry: 8 },

  // ── Wrists ──
  { id: 'left_wrist', label: 'Left Wrist', side: 'both', cx: 34, cy: 178, rx: 7, ry: 6 },
  { id: 'right_wrist', label: 'Right Wrist', side: 'both', cx: 166, cy: 178, rx: 7, ry: 6 },

  // ── Hips ──
  { id: 'left_hip', label: 'Left Hip', side: 'front', cx: 78, cy: 185, rx: 16, ry: 12 },
  { id: 'right_hip', label: 'Right Hip', side: 'front', cx: 122, cy: 185, rx: 16, ry: 12 },

  // ── Thighs ──
  { id: 'left_thigh', label: 'Left Thigh', side: 'both', cx: 80, cy: 225, rx: 16, ry: 28 },
  { id: 'right_thigh', label: 'Right Thigh', side: 'both', cx: 120, cy: 225, rx: 16, ry: 28 },

  // ── Knees ──
  { id: 'left_knee', label: 'Left Knee', side: 'both', cx: 80, cy: 264, rx: 12, ry: 10 },
  { id: 'right_knee', label: 'Right Knee', side: 'both', cx: 120, cy: 264, rx: 12, ry: 10 },

  // ── Calves ──
  { id: 'left_calf', label: 'Left Calf', side: 'both', cx: 80, cy: 300, rx: 11, ry: 24 },
  { id: 'right_calf', label: 'Right Calf', side: 'both', cx: 120, cy: 300, rx: 11, ry: 24 },

  // ── Ankles ──
  { id: 'left_ankle', label: 'Left Ankle', side: 'both', cx: 80, cy: 332, rx: 9, ry: 7 },
  { id: 'right_ankle', label: 'Right Ankle', side: 'both', cx: 120, cy: 332, rx: 9, ry: 7 },

  // ── Feet ──
  { id: 'left_foot', label: 'Left Foot', side: 'both', cx: 78, cy: 350, rx: 12, ry: 10 },
  { id: 'right_foot', label: 'Right Foot', side: 'both', cx: 122, cy: 350, rx: 12, ry: 10 },
];

// ─── Body silhouette SVG path (200×380 viewBox) ────────────────────

const BODY_FRONT_PATH = `
  M 100 12
  C 88 12, 80 22, 80 34
  C 80 46, 88 54, 100 54
  C 112 54, 120 46, 120 34
  C 120 22, 112 12, 100 12
  Z
  M 92 56 L 88 62 L 58 78
  C 48 82, 40 90, 36 100
  L 28 155 L 24 178 L 30 190 L 40 180
  L 44 155 L 50 130
  L 62 96 L 72 170
  L 68 195 L 72 250 L 72 268
  L 68 300 L 66 335 L 64 348
  C 62 358, 66 365, 78 365
  L 90 362 L 90 348 L 86 330
  L 88 300 L 88 268
  L 92 240 L 100 200
  L 108 240 L 112 268
  L 112 300 L 114 330 L 110 348
  L 110 362 L 122 365
  C 134 365, 138 358, 136 348
  L 134 335 L 132 300 L 128 268
  L 128 250 L 132 195 L 128 170
  L 138 130 L 150 96
  L 156 155 L 160 180 L 170 190
  L 176 178 L 172 155
  L 164 100
  C 160 90, 152 82, 142 78
  L 112 62 L 108 56
  Z
`;

const BODY_BACK_PATH = BODY_FRONT_PATH; // Same silhouette mirrored is identical (symmetric)

// ─── Component ──────────────────────────────────────────────────────

interface BodyMapProps {
  selectedZones: string[];
  onZoneSelect: (zoneId: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  accentColor?: string;
}

export default function BodyMap({
  selectedZones,
  onZoneSelect,
  onConfirm,
  onCancel,
  accentColor = '#3498DB',
}: BodyMapProps) {
  const [view, setView] = useState<'front' | 'back'>('front');

  const visibleZones = ZONES.filter(
    (z) => z.side === view || z.side === 'both'
  );

  const selectedLabels = ZONES
    .filter((z) => selectedZones.includes(z.id))
    .map((z) => z.label);

  return (
    <View style={styles.container}>
      {/* Title */}
      <Text style={styles.title}>Where does it hurt?</Text>
      <Text style={styles.subtitle}>Tap on the affected area(s)</Text>

      {/* View toggle */}
      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.toggleButton, view === 'front' && { backgroundColor: accentColor }]}
          onPress={() => setView('front')}
        >
          <Text style={[styles.toggleText, view === 'front' && styles.toggleTextActive]}>Front</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleButton, view === 'back' && { backgroundColor: accentColor }]}
          onPress={() => setView('back')}
        >
          <Text style={[styles.toggleText, view === 'back' && styles.toggleTextActive]}>Back</Text>
        </TouchableOpacity>
      </View>

      {/* Body SVG */}
      <ScrollView
        contentContainerStyle={styles.svgContainer}
        showsVerticalScrollIndicator={false}
      >
        <Svg
          width={SVG_WIDTH}
          height={SVG_HEIGHT}
          viewBox="0 0 200 380"
        >
          {/* Silhouette */}
          <Path
            d={view === 'front' ? BODY_FRONT_PATH : BODY_BACK_PATH}
            fill="#2A4562"
            stroke="#3E5F80"
            strokeWidth={1.2}
          />

          {/* Touchable zones */}
          {visibleZones.map((zone) => {
            const isSelected = selectedZones.includes(zone.id);
            return (
              <G key={zone.id}>
                <Ellipse
                  cx={zone.cx}
                  cy={zone.cy}
                  rx={zone.rx}
                  ry={zone.ry}
                  fill={isSelected ? 'rgba(231, 76, 60, 0.55)' : 'rgba(52, 152, 219, 0.15)'}
                  stroke={isSelected ? '#E74C3C' : 'rgba(52, 152, 219, 0.35)'}
                  strokeWidth={isSelected ? 2 : 1}
                  onPress={() => onZoneSelect(zone.id)}
                />
              </G>
            );
          })}
        </Svg>
      </ScrollView>

      {/* Selected zones summary */}
      {selectedLabels.length > 0 && (
        <View style={styles.selectionSummary}>
          <Ionicons name="bandage-outline" size={14} color="#E74C3C" />
          <Text style={styles.selectionText}>{selectedLabels.join(', ')}</Text>
        </View>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.confirmButton, { backgroundColor: accentColor }, selectedZones.length === 0 && { opacity: 0.4 }]}
          onPress={onConfirm}
          disabled={selectedZones.length === 0}
        >
          <Ionicons name="checkmark" size={18} color="#fff" />
          <Text style={styles.confirmButtonText}>Confirm</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    color: '#8A8D91',
    fontSize: 13,
    marginBottom: 16,
  },
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: '#1A1F2B',
    borderRadius: 12,
    padding: 3,
    marginBottom: 16,
  },
  toggleButton: {
    paddingVertical: 8,
    paddingHorizontal: 28,
    borderRadius: 10,
  },
  toggleText: {
    color: '#8A8D91',
    fontSize: 14,
    fontWeight: '600',
  },
  toggleTextActive: {
    color: '#fff',
  },
  svgContainer: {
    alignItems: 'center',
    paddingBottom: 10,
  },
  selectionSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(231, 76, 60, 0.1)',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
    gap: 8,
    marginTop: 8,
    marginBottom: 8,
    alignSelf: 'stretch',
  },
  selectionText: {
    color: '#E74C3C',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
    marginBottom: 16,
    alignSelf: 'stretch',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#2A4562',
  },
  cancelButtonText: {
    color: '#8A8D91',
    fontSize: 15,
    fontWeight: 'bold',
  },
  confirmButton: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
});
