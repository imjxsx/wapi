export interface IReplyOptions {
  mentions?: string[];
}
export interface IReplyWithImageOptions extends IReplyOptions {
  caption?: string;
  mimetype?: string;
  viewOnce?: boolean;
}
export interface IReplyWithVideoOptions extends IReplyOptions {
  caption?: string;
  mimetype?: string;
  viewOnce?: boolean;
  gifPlayback?: boolean;
}
