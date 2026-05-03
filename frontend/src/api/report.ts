import client from './client';

export interface DimensionScore {
  dimension: string;
  score: number;
  weight: number;
  comment: string;
}

export interface QuestionReview {
  question: string;
  answer_summary: string;
  score: number;
  comment: string;
  suggestions: string;
}

export interface LearningResource {
  title: string;
  type: string;
  description: string;
  url: string;
}

export interface TrainingDay {
  day: number;
  title: string;
  tasks: string[];
}

export interface ExpressionSummary {
  speech_rate: number;
  pause_ratio: number;
  fluency_score: number;
  confidence: number;
  sample_count: number;
}

export interface InterviewReport {
  session_id: number;
  position_type: string;
  total_score: number;
  level: string;
  dimensions: DimensionScore[];
  question_reviews: QuestionReview[];
  strengths: string[];
  weaknesses: string[];
  overall_comment: string;
  suggestions: string[];
  resources: LearningResource[];
  training_plan: TrainingDay[];
  expression_summary?: ExpressionSummary | null;
}

export interface GrowthOverview {
  total_interviews: number;
  avg_score: number;
  highest_score: number;
  streak_days: number;
}

export interface TrendItem {
  date: string;
  score: number;
  position_type: string;
}

export function getReport(sessionId: number): Promise<InterviewReport> {
  return client.get(`/interviews/${sessionId}/report`);
}

export function getGrowthOverview(): Promise<GrowthOverview> {
  return client.get('/growth/overview');
}

export function getGrowthTrend(): Promise<TrendItem[]> {
  return client.get('/growth/trend');
}

export function getRecommendations(): Promise<any> {
  return client.get('/growth/recommendations');
}
