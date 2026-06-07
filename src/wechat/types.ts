export interface TokenResponse {
  access_token: string
  expires_in: number
  errcode?: number
  errmsg?: string
}

export interface MediaUploadResponse {
  media_id: string
  type: string
  created_at: number
  errcode?: number
  errmsg?: string
}

export interface ArticleItem {
  title: string
  author?: string
  digest?: string
  content: string
  content_source_url?: string
  thumb_media_id: string
  show_cover_pic?: boolean
}

export interface MaterialListResponse {
  total_count: number
  item_count: number
  item: Array<{
    media_id: string
    name?: string
    update_time: number
    content?: { news_item: ArticleItem[] }
  }>
  errcode?: number
  errmsg?: string
}

export interface PermanentImageUploadResponse {
  media_id: string
  url: string
  errcode?: number
  errmsg?: string
}

export interface DraftAddResponse {
  media_id: string
  errcode?: number
  errmsg?: string
}

export interface DraftListResponse {
  total_count: number
  item: Array<{
    media_id: string
    content: { news_item: ArticleItem[] }
    update_time: number
  }>
  errcode?: number
  errmsg?: string
}

export interface PublishSubmitResponse {
  publish_id: string
  article_id: string
  errcode?: number
  errmsg?: string
}

export interface PublishStatus {
  publish_id: string
  article_id: string
  publish_status: 'publishing' | 'success' | 'failed'
  fail_idx?: number
  errcode?: number
  errmsg?: string
}

export interface PublishListResponse {
  total_count: number
  item: Array<{
    article_id: string
    title: string
    publish_time: number
  }>
  errcode?: number
  errmsg?: string
}

export interface WechatApiError {
  errcode: number
  errmsg: string
}
