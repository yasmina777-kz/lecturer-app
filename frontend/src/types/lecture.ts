// Эти типы — зеркало того, что возвращает backend (LecturesController.GetById
// и QuestionsController.Ask). Держим их в одном месте, чтобы компоненты
// везде получали типизированные данные, а не any.

export interface Slide {
  id: string;
  orderIndex: number;
  narrationText: string;
  contentJson: string; // JSON.parse при рендере, см. SlideViewer
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
