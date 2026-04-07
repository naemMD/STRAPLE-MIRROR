import React from 'react';
import { Modal, View, Text, TouchableOpacity, FlatList, Image, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface FoodItem {
  name: string;
  image?: string;
  code: string;
}

interface FoodResultsPickerProps {
  visible: boolean;
  results: FoodItem[];
  onSelect: (item: FoodItem) => void;
  onClose: () => void;
  accentColor?: string;
}

function FoodImage({ uri, style }: { uri?: string; style: any }) {
  if (uri) {
    return <Image source={{ uri }} style={style} />;
  }
  return (
    <View style={[style, { backgroundColor: '#2A4562', justifyContent: 'center', alignItems: 'center' }]}>
      <Ionicons name="fast-food-outline" size={20} color="#8A8D91" />
    </View>
  );
}

export default function FoodResultsPicker({ visible, results, onSelect, onClose, accentColor = '#2ecc71' }: FoodResultsPickerProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.container} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Text style={styles.title}>{results.length} result{results.length > 1 ? 's' : ''} found</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color="#fff" />
            </TouchableOpacity>
          </View>

          <FlatList
            data={results}
            keyExtractor={(_, i) => String(i)}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.item}
                activeOpacity={0.6}
                onPress={() => onSelect(item)}
              >
                <FoodImage uri={item.image} style={styles.image} />
                <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
                <View style={[styles.addBadge, { backgroundColor: accentColor + '22' }]}>
                  <Ionicons name="add" size={20} color={accentColor} />
                </View>
              </TouchableOpacity>
            )}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: '#1A1F2B',
    borderRadius: 16,
    maxHeight: '75%',
    borderWidth: 1,
    borderColor: '#2A4562',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#2A4562',
  },
  title: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  listContent: {
    paddingVertical: 6,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  image: {
    width: 44,
    height: 44,
    borderRadius: 10,
    marginRight: 14,
  },
  itemName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
    lineHeight: 20,
  },
  addBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  separator: {
    height: 1,
    backgroundColor: '#232D3F',
    marginHorizontal: 16,
  },
});
