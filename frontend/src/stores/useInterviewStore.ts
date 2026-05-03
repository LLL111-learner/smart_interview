import { create } from 'zustand';

export interface Message {
  id: string;
  role: 'interviewer' | 'candidate';
  content: string;
  timestamp: string;
  isLoading?: boolean;
}

export type InterviewStage =
  | 'opening'
  | 'self_intro'
  | 'technical'
  | 'project'
  | 'scenario'
  | 'qa'
  | 'closing';

interface InterviewState {
  sessionId: string | null;
  messages: Message[];
  currentStage: InterviewStage;
  isRecording: boolean;
  isLoading: boolean;
  questionCount: number;
  acceptedAnswerCount: number;
  lastAnswerAccepted: boolean | null;
  lastAnswerFeedback: string | null;
  setSessionId: (id: string) => void;
  addMessage: (msg: Message) => void;
  updateLastMessage: (content: string) => void;
  setStage: (stage: InterviewStage) => void;
  setRecording: (recording: boolean) => void;
  setLoading: (loading: boolean) => void;
  incrementQuestion: () => void;
  markAnswerEvaluation: (accepted: boolean, feedback?: string | null) => void;
  seedAcceptedAnswerCount: (count: number) => void;
  reset: () => void;
}

const initialState = {
  sessionId: null,
  messages: [],
  currentStage: 'opening' as InterviewStage,
  isRecording: false,
  isLoading: false,
  questionCount: 0,
  acceptedAnswerCount: 0,
  lastAnswerAccepted: null as boolean | null,
  lastAnswerFeedback: null as string | null,
};

const useInterviewStore = create<InterviewState>((set) => ({
  ...initialState,

  setSessionId: (id) => set({ sessionId: id }),

  addMessage: (msg) =>
    set((state) => {
      if (state.messages.some((item) => item.id === msg.id)) {
        return state;
      }
      return { messages: [...state.messages, msg] };
    }),

  updateLastMessage: (content) =>
    set((state) => {
      const messages = [...state.messages];
      if (messages.length > 0) {
        messages[messages.length - 1] = {
          ...messages[messages.length - 1],
          content,
          isLoading: false,
        };
      }
      return { messages };
    }),

  setStage: (stage) => set({ currentStage: stage }),
  setRecording: (recording) => set({ isRecording: recording }),
  setLoading: (loading) => set({ isLoading: loading }),
  incrementQuestion: () => set((state) => ({ questionCount: state.questionCount + 1 })),

  markAnswerEvaluation: (accepted, feedback) =>
    set((state) => ({
      acceptedAnswerCount: accepted ? state.acceptedAnswerCount + 1 : state.acceptedAnswerCount,
      lastAnswerAccepted: accepted,
      lastAnswerFeedback: feedback ?? null,
    })),

  seedAcceptedAnswerCount: (count) =>
    set({
      acceptedAnswerCount: count,
      lastAnswerAccepted: null,
      lastAnswerFeedback: null,
    }),

  reset: () => set(initialState),
}));

export default useInterviewStore;
