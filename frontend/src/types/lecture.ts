import type { Language, AvatarId, VoiceGender } from "./auth";
export interface Slide {
  id: string;
  orderIndex: number;
  narrationText: string;
  contentJson: string;
}
export interface Progress {
  slideIndex: number;
  furthestSlide: number;
  completed: boolean;
  notes: string;
  quizScore: number | null;
  answersJson: string;
  taskAnswersJson: string;
}
export interface LectureCard {
  language: Language;
  avatarId: AvatarId;
  voiceGender: VoiceGender;
  avatarStyle: string;
  id: string;
  title: string;
  description: string;
  subject: string;
  level: string;
  isDemo: boolean;
  isPublished: boolean;
  createdAt: string;
  ownerId: string | null;
  slideCount: number;
  duration: number;
  targetMinutes: number;
  progress: Progress | null;
}
export interface Lecture extends Omit<LectureCard, "slideCount" | "duration"> {
  estimatedMinutes: number;
  introduction: string;
  summary: string;
  exercisesJson: string;
  sourceName: string;
  slides: Slide[];
  questions: { id: string; questionText: string; answerText: string }[];
}
export interface AskQuestionResponse {
  questionText: string;
  answerText: string;
}
export interface Exercises {
  quiz: {
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
  }[];
  tasks: { question: string; answer: string }[];
}
export interface Capabilities {
  aiConfigured: boolean;
  speech: string;
  uploadFormats: string[];
}
