export interface Slide {
  id: string;
  orderIndex: number;
  narrationText: string;
  contentJson: string; 
}

export interface Lecture {
  id: string;
  title: string;
  slides: Slide[];
}

export interface AskQuestionResponse {
  answerText: string;
  answerAudioUrl: string;
}
