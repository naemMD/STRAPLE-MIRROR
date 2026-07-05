import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '@/services/api';

interface FeedbackModalProps {
  visible: boolean;
  /** Called after the feedback has been successfully submitted. */
  onSubmitted: () => void;
  /** Called when the user taps "Later" (snooze — ask again in a few days). */
  onSnooze: () => void;
}

// Must stay in sync with FEEDBACK_MOST_USED_OPTIONS in Back/app/schemas.py
const MOST_USED_OPTIONS: { key: string; label: string }[] = [
  { key: 'trainings', label: 'Trainings' },
  { key: 'nutrition', label: 'Nutrition' },
  { key: 'coach_chat', label: 'Coach chat' },
  { key: 'community', label: 'Community' },
  { key: 'ai_coach', label: 'AI coach' },
  { key: 'other', label: 'Other' },
];

const FeedbackModal: React.FC<FeedbackModalProps> = ({ visible, onSubmitted, onSnooze }) => {
  const [rating, setRating] = useState(0);
  const [isIntuitive, setIsIntuitive] = useState<boolean | null>(null);
  const [isUseful, setIsUseful] = useState<boolean | null>(null);
  const [mostUsed, setMostUsed] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = rating > 0 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.post('/feedback', {
        rating,
        is_intuitive: isIntuitive,
        is_useful: isUseful,
        most_used: mostUsed,
        comment: comment.trim() || null,
      });
      onSubmitted();
    } catch {
      setError('Could not send your feedback. Please try again.');
      setSubmitting(false);
    }
  };

  const YesNo = ({
    value,
    onChange,
  }: {
    value: boolean | null;
    onChange: (v: boolean) => void;
  }) => (
    <View style={styles.yesNoRow}>
      <TouchableOpacity
        style={[styles.yesNoButton, value === true && styles.yesNoButtonActive]}
        onPress={() => onChange(true)}
      >
        <Text style={[styles.yesNoText, value === true && styles.yesNoTextActive]}>Yes</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.yesNoButton, value === false && styles.yesNoButtonActive]}
        onPress={() => onChange(false)}
      >
        <Text style={[styles.yesNoText, value === false && styles.yesNoTextActive]}>No</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Your feedback</Text>
            <TouchableOpacity
              onPress={onSnooze}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={26} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Scrollable content */}
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator
          >
            <Text style={styles.intro}>
              You&apos;ve been using Staple for a few days now — we&apos;d love to hear what
              you think. It takes less than a minute.
            </Text>

            {/* Star rating */}
            <Text style={styles.question}>How would you rate the app?</Text>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => setRating(star)}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Ionicons
                    name={star <= rating ? 'star' : 'star-outline'}
                    size={36}
                    color={star <= rating ? '#EAEA45' : '#555'}
                    style={styles.star}
                  />
                </TouchableOpacity>
              ))}
            </View>

            {/* Intuitive */}
            <Text style={styles.question}>Is the app intuitive for you?</Text>
            <YesNo value={isIntuitive} onChange={setIsIntuitive} />

            {/* Useful */}
            <Text style={styles.question}>Is the app useful to you?</Text>
            <YesNo value={isUseful} onChange={setIsUseful} />

            {/* Most used */}
            <Text style={styles.question}>What do you use the most?</Text>
            <View style={styles.chipsWrap}>
              {MOST_USED_OPTIONS.map((opt) => {
                const active = mostUsed === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setMostUsed(active ? null : opt.key)}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Free text */}
            <Text style={styles.question}>Anything else you&apos;d like to tell us?</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Your feedback (optional)"
              placeholderTextColor="#7A7D82"
              value={comment}
              onChangeText={setComment}
              multiline
              maxLength={1000}
            />

            {error && <Text style={styles.errorText}>{error}</Text>}
          </ScrollView>

          {/* Footer buttons */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.laterButton} onPress={onSnooze} disabled={submitting}>
              <Text style={styles.laterButtonText}>Later</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={!canSubmit}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text
                  style={[styles.submitButtonText, !canSubmit && styles.submitButtonTextDisabled]}
                >
                  Send
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#1A1F2B',
    borderRadius: 20,
    width: '100%',
    maxHeight: '90%',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#2A4562',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2A4562',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  scrollView: {
    flexGrow: 0,
    flexShrink: 1,
  },
  scrollContent: {
    padding: 20,
  },
  intro: {
    color: '#CCCCCC',
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 20,
  },
  question: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    marginTop: 18,
    marginBottom: 10,
  },
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  star: {
    marginHorizontal: 4,
  },
  yesNoRow: {
    flexDirection: 'row',
    gap: 12,
  },
  yesNoButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A4562',
    backgroundColor: 'transparent',
  },
  yesNoButtonActive: {
    backgroundColor: '#3498DB',
    borderColor: '#3498DB',
  },
  yesNoText: {
    color: '#CCCCCC',
    fontSize: 15,
  },
  yesNoTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2A4562',
    backgroundColor: 'transparent',
  },
  chipActive: {
    backgroundColor: '#3498DB',
    borderColor: '#3498DB',
  },
  chipText: {
    color: '#CCCCCC',
    fontSize: 14,
  },
  chipTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#2A4562',
    borderRadius: 10,
    padding: 12,
    color: '#FFFFFF',
    fontSize: 14,
    minHeight: 90,
    textAlignVertical: 'top',
    backgroundColor: '#0D1117',
  },
  errorText: {
    color: '#E74C3C',
    fontSize: 13,
    marginTop: 14,
  },
  footer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#2A4562',
  },
  laterButton: {
    flex: 1,
    backgroundColor: 'transparent',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#555',
  },
  laterButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  submitButton: {
    flex: 1,
    backgroundColor: '#3498DB',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#2A4562',
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  submitButtonTextDisabled: {
    color: '#8A8D91',
  },
});

export default FeedbackModal;
