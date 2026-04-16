export type DashboardStat = {
  title: string;
  value: string;
  subtitle: string;
};

export type DashboardData = {
  hero: {
    greeting_name: string;
    subtitle: string;
    health_score: number;
    health_delta: string;
  };
  stats: DashboardStat[];
  activity: {
    labels: string[];
    values: number[];
  };
  next_dose: Array<{
    name: string;
    detail: string;
    status: string;
    tone: 'warn' | 'ok';
  }>;
  hydration: {
    current_l: number;
    goal_l: number;
    progress: number;
  };
  notifications: string[];
};

export type DiseaseAnalysis = {
  condition: string;
  reason: string;
  matched_symptoms: string[];
  possible_causes: string[];
  confidence: number;
  detected_disease?: string;
  precautions?: string[];
};

export type DrugRecommendation = {
  drug_id: number;
  name: string;
  description: string;
  category: string;
  confidence: number;
  interaction_risk: string;
  rating: number;
  dosage: string;
  duration?: string;
  side_effects: string;
  reason: string;
};

export type PreviousDrug = {
  name: string;
  times_recommended: number;
  avg_confidence: number;
  last_recommended_at: string;
};

export type DietPlan = {
  goal: string;
  calories_remaining: number;
  carbs: string;
  protein: string;
  fat: string;
  meals: Array<{
    meal: string;
    time: string;
    name: string;
    calories: number;
    tags: string[];
  }>;
  foods_to_avoid: string[];
  superfoods: string[];
  based_on_symptoms: string[];
};

export type RecommendationResponse = {
  requires_followup?: boolean;
  requires_parameters?: boolean;
  parameters?: string[];
  question?: string;
  symptoms: string[];
  disease_analysis: DiseaseAnalysis;
  drug_recommendations: DrugRecommendation[];
  natural_alternative?: {
    name: string;
    category: string;
    description: string;
  };
  previous_drug_records: PreviousDrug[];
  diet_plan: DietPlan;
  common_searches?: string[];
  disclaimer: string;
};

export type SettingsState = {
  dark_mode: boolean;
  medication_reminders: boolean;
  diet_alerts: boolean;
  weekly_reports: boolean;
};

export type Appointment = {
  id: number;
  title: string;
  provider: string;
  appointment_time: string;
  mode: string;
  status: string;
  notes: string;
};
