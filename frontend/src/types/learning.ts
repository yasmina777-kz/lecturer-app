export interface GroupSummary {
  id: string;
  name: string;
  canManage: boolean;
  memberCount: number;
  assignmentCount: number;
}
export interface Assignment {
  lectureId: string;
  title: string;
  subject: string;
  assignedAt: string;
  dueAt: string | null;
  completedCount: number | null;
  testedCount: number | null;
  averageScore: number | null;
  myCompleted: boolean;
  myScore: number | null;
}
export interface GroupDetail {
  id: string;
  name: string;
  canManage: boolean;
  joinCode: string | null;
  memberCount: number;
  assignments: Assignment[];
  members:
    | {
        id: string;
        fullName: string;
        completed: number;
        tested: number;
        averageScore: number | null;
      }[]
    | null;
}
export interface KnowledgeTopic {
  id: string;
  title: string;
  subject: string;
  started: boolean;
  completed: boolean;
  score: number | null;
}
export interface KnowledgeData {
  topics: KnowledgeTopic[];
  subjects: {
    subject: string;
    total: number;
    tested: number;
    average: number | null;
  }[];
  history: {
    id: string;
    lectureId: string;
    title: string;
    score: number;
    createdAt: string;
  }[];
}
