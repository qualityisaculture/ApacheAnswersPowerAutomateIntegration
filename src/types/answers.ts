export interface AnswerPost {
  id: string;
  title: string;
  content: string;
  operator: {
    id: string;
    username: string;
    display_name: string;
    avatar: string;
    rank: number;
    status: string;
  };
  created_at: string;
  updated_at: string;
  tags: string[];
  status: "normal" | "closed" | "deleted";
  view_count: number;
  vote_count: number;
  answer_count: number;
}

export interface AnswerUser {
  id: string;
  username: string;
  display_name: string;
  email: string;
  avatar: string;
  created_at: string;
  updated_at: string;
}

export interface AnswerApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

export interface AnswerPostListResponse {
  list: AnswerPost[];
  total: number;
  page: number;
  page_size: number;
}
