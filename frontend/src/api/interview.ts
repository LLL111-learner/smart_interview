import client from './client';

export interface CreateInterviewData {
  position_type: string;
  difficulty: string;
  interview_type: string;
}

export interface ChatMessage {
  id: number;
  session_id: number;
  role: 'interviewer' | 'candidate';
  content: string;
  audio_url?: string;
  audio_format?: string;
  transcript_source?: string;
  expression_metrics?: {
    speech_rate?: number;
    pause_ratio?: number;
    fluency_score?: number;
    confidence?: number;
    details?: Record<string, unknown>;
  } | null;
  stage: string;
  created_at: string;
}

export interface InterviewSession {
  id: number;
  user_id?: number | null;
  is_trial?: boolean;
  trial_token?: string | null;
  position_type: string;
  difficulty: string;
  interview_type: string;
  status: string;
  current_stage: string;
  total_score?: number;
  started_at: string;
  ended_at?: string;
  messages?: ChatMessage[];
}

export interface SendMessageResponse {
  id: number;
  session_id: number;
  role: string;
  content: string;
  audio_url?: string;
  audio_format?: string;
  transcript_source?: string;
  expression_metrics?: ChatMessage['expression_metrics'];
  stage: string;
  created_at: string;
  accepted?: boolean;
  feedback?: string | null;
}

export interface StreamMessageEvent {
  type: 'delta' | 'done' | 'error';
  data: Record<string, unknown>;
}

export function createInterview(data: CreateInterviewData): Promise<InterviewSession> {
  clearTrialSession();
  return client.post('/interviews', data);
}

export async function createTrialInterview(data: CreateInterviewData): Promise<InterviewSession> {
  const session: InterviewSession = await client.post('/interviews/trial', data);
  if (session.trial_token) {
    localStorage.setItem('trial_token', session.trial_token);
  }
  return session;
}

export function sendMessage(
  sessionId: number,
  content: string,
  audioFile?: Blob,
): Promise<SendMessageResponse> {
  if (audioFile) {
    const formData = new FormData();
    formData.append('content', content);
    formData.append('audio', audioFile, 'recording.wav');
    return client.post(`/interviews/${sessionId}/message`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  }
  return client.post(`/interviews/${sessionId}/message`, { content });
}

export async function sendMessageStream(
  sessionId: number,
  content: string,
  onEvent: (event: StreamMessageEvent) => void,
  audioFile?: Blob,
): Promise<void> {
  const headers: Record<string, string> = {};
  const token = localStorage.getItem('token');
  const trialToken = localStorage.getItem('trial_token');
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (trialToken) {
    headers['X-Trial-Token'] = trialToken;
  }

  let body: BodyInit;
  if (audioFile) {
    const formData = new FormData();
    formData.append('content', content);
    formData.append('audio', audioFile, 'recording.wav');
    body = formData;
  } else {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify({ content });
  }

  const response = await fetch(`/api/v1/interviews/${sessionId}/message/stream`, {
    method: 'POST',
    headers,
    body,
  });
  if (!response.ok || !response.body) {
    const detail = await response.text();
    throw new Error(detail || 'Stream request failed');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const emit = (rawEvent: string) => {
    const eventMatch = rawEvent.match(/event:\s*(.+)/);
    const dataMatch = rawEvent.match(/data:\s*([\s\S]+)/);
    if (!eventMatch || !dataMatch) return;
    try {
      onEvent({
        type: eventMatch[1].trim() as StreamMessageEvent['type'],
        data: JSON.parse(dataMatch[1].trim()),
      });
    } catch {
      // ignore malformed chunks
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split('\n\n');
    buffer = chunks.pop() || '';
    chunks.forEach(emit);
  }
  if (buffer.trim()) {
    emit(buffer);
  }
}

export function endInterview(sessionId: number): Promise<InterviewSession> {
  return client.post(`/interviews/${sessionId}/end`);
}

export function getInterviewList(): Promise<InterviewSession[]> {
  return client.get('/interviews');
}

export function getInterviewDetail(sessionId: number): Promise<InterviewSession> {
  return client.get(`/interviews/${sessionId}`);
}

export function clearTrialSession() {
  localStorage.removeItem('trial_token');
}
