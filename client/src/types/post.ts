// 게시물 관련 타입 정의

export type PostType = 'notice' | 'material' | 'published_submission'

export interface PostAuthor {
  id: number
  name: string
}

export interface Post {
  id: number
  title: string
  type: PostType
  author: PostAuthor
  created_at: string
  comment_count: number
  like_count: number
  liked_by_me: boolean
}

export interface PostDetail extends Post {
  content: string
  class_id: number
  files: PostFile[]
}

export interface PostFile {
  id: number
  filename: string
  size: number
}

export interface Comment {
  id: number
  body: string
  author: PostAuthor
  created_at: string
}

export interface PostListResponse {
  posts: Post[]
  pagination: {
    page: number
    limit: number
    total: number
    total_pages: number
  }
}

export interface PostDetailResponse {
  post: PostDetail
}

export interface CommentListResponse {
  comments: Comment[]
}

export interface CommentCreateResponse {
  comment: Comment
}

export interface LikeResponse {
  liked: boolean
  like_count: number
}
