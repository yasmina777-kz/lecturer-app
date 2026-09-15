import { LecturePlayerPage } from "./pages/LecturePlayerPage";

// Для MVP — id лекции захардкожен. Когда появится библиотека лекций,
// здесь будет роутинг (например, react-router) с /lecture/:id
const DEMO_LECTURE_ID = "00000000-0000-0000-0000-000000000001";

export function App() {
  return <LecturePlayerPage lectureId={DEMO_LECTURE_ID} />;
}
