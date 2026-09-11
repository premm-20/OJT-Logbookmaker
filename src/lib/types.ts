// ============================================================
// Database Types
// ============================================================

export interface Profile {
  id: string;
  learner_name: string;
  registration_number: string;
  program_name: string;
  semester: string;
  location: string;
  industry_partner_name: string;
  ojt_start_date: string;
  ojt_end_date: string;
  department: string;
  designation: string;
  supervisor_name: string;
  phone_number?: string;
  email_id?: string;
  created_at: string;
  updated_at: string;
}

export interface DailyEntry {
  id: string;
  user_id: string;
  date: string;
  start_time: string;
  end_time: string;
  department: string;
  designation: string;
  original_text: string;
  my_space: string;
  tasks_carried_out: string;
  key_learning_observations: string;
  tools_technology_used: string;
  special_achievements: string;
  created_at: string;
  updated_at: string;
}

export interface SupervisorFeedback {
  id: string;
  user_id: string;
  from_date: string;
  to_date: string;
  student_name: string;
  punctuality: RatingValue;
  professional_appearance: RatingValue;
  ability_to_communicate: RatingValue;
  interest_shown_for_learning: RatingValue;
  productivity_at_work: RatingValue;
  error_free_work: RatingValue;
  working_as_team: RatingValue;
  initiative_and_commitment: RatingValue;
  flexibility_and_adaptability: RatingValue;
  adherence_to_safety_ethics: RatingValue;
  total_score: number | null;
  remarks: string;
  supervisor_name: string;
  designation: string;
  signature_date: string;
  created_at: string;
}

export type RatingValue = 'good' | 'acceptable' | 'needs_improvement' | '';

// ============================================================
// AI Extraction Types
// ============================================================

export interface ExtractedLogbook {
  mySpace: string[];
  tasksCarriedOutToday: string[];
  keyLearningObservations: string[];
  toolsTechnologyUsed: string[];
  specialAchievements: string[];
}

export interface ExtractedDayEntry {
  dayNumber: number;
  date?: string;
  startTime?: string;
  endTime?: string;
  department?: string;
  designation?: string;
  originalText?: string;
  mySpace: string[];
  tasksCarriedOutToday: string[];
  keyLearningObservations: string[];
  toolsTechnologyUsed: string[];
  specialAchievements: string[];
}

export interface ExtractionResponse {
  success: boolean;
  isMultiDay?: boolean;
  days?: ExtractedDayEntry[];
  data: ExtractedLogbook | null;
  detectedDayNumber?: number | null;
  validationWarnings: string[];
  error?: string;
}

// ============================================================
// Form Types
// ============================================================

export interface DailyEntryFormData {
  day_number?: number;
  date: string;
  start_time: string;
  end_time: string;
  department: string;
  designation: string;
  original_text: string;
  my_space: string;
  tasks_carried_out: string;
  key_learning_observations: string;
  tools_technology_used: string;
  special_achievements: string;
}

export interface ProfileFormData {
  learner_name: string;
  registration_number: string;
  program_name: string;
  semester: string;
  location: string;
  industry_partner_name: string;
  ojt_start_date: string;
  ojt_end_date: string;
  department: string;
  designation: string;
  supervisor_name: string;
  phone_number?: string;
  email_id?: string;
}

// ============================================================
// Supervisor Feedback Rating Criteria
// ============================================================

export const RATING_CRITERIA = [
  { key: 'punctuality', label: 'Punctuality' },
  { key: 'professional_appearance', label: 'Professional Appearance' },
  { key: 'ability_to_communicate', label: 'Ability to Communicate' },
  { key: 'interest_shown_for_learning', label: 'Interest Shown for Learning' },
  { key: 'productivity_at_work', label: 'Productivity at Work' },
  { key: 'error_free_work', label: 'Error Free Work' },
  { key: 'working_as_team', label: 'Working as part of a Team' },
  { key: 'initiative_and_commitment', label: 'Initiative and Commitment' },
  { key: 'flexibility_and_adaptability', label: 'Flexibility and Adaptability' },
  { key: 'adherence_to_safety_ethics', label: 'Adherence to Safety and Ethics' },
] as const;

export const RATING_OPTIONS: { value: RatingValue; label: string }[] = [
  { value: 'good', label: 'Good' },
  { value: 'acceptable', label: 'Acceptable' },
  { value: 'needs_improvement', label: 'Needs Improvement' },
];
