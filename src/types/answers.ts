export interface AnswerPost {
  accepted_answer_id: string;
  answer_count: number;
  collection_count: number;
  created_at: number;
  description: string;
  follow_count: number;
  id: string;
  last_answer_id: string;
  operated_at: number;
  operation_type: string;
  operator: {
    avatar: string;
    display_name: string;
    id: string;
    rank: number;
    status: string;
    username: string;
  };
  pin: number;
  show: number;
  status: number;
  tags: Array<{
    display_name: string;
    main_tag_slug_name: string;
    recommend: boolean;
    reserved: boolean;
    slug_name: string;
  }>;
  title: string;
  unique_view_count: number;
  url_title: string;
  view_count: number;
  vote_count: number;
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
