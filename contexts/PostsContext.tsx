import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type PostType = 'standard' | 'comparison';
export type MediaType = 'image' | 'video';

export interface PostMedia {
  id: string;
  uri: string;
  type: MediaType;
  votes?: number;
  duration?: number;
  thumbnail?: string;
}

export interface Comment {
  id: string;
  postId: string;
  userId: string;
  userName: string;
  userAvatar: string | null;
  content: string;
  isVoice: boolean;
  voiceDuration?: number;
  voiceTranscript?: string;
  createdAt: string;
  isAI: boolean;
}

export interface Post {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string | null;
  userSubscriptionTier: 'free' | 'basic' | 'premium' | 'vip';
  type: PostType;
  media: PostMedia[];
  images: PostMedia[];
  description: string;
  upvotes: number;
  downvotes: number;
  thanksCount: number;
  commentsCount: number;
  sharesCount: number;
  createdAt: string;
  isAIAdviceRequested: boolean;
  aiAdvice?: string;
  country?: string;
  isViralBadge?: boolean;
  shareUnlockTip?: string;
}

interface PostsContextType {
  posts: Post[];
  userPosts: Post[];
  isLoading: boolean;
  createPost: (post: Omit<Post, 'id' | 'createdAt' | 'upvotes' | 'downvotes' | 'thanksCount' | 'commentsCount' | 'sharesCount'>) => Promise<Post>;
  updatePost: (postId: string, updates: Partial<Post>) => Promise<void>;
  deletePost: (postId: string) => Promise<void>;
  votePost: (postId: string, voteType: 'up' | 'down') => Promise<void>;
  voteComparison: (postId: string, mediaId: string) => Promise<void>;
  thankPost: (postId: string) => Promise<void>;
  sharePost: (postId: string) => Promise<void>;
  getPostComments: (postId: string) => Comment[];
  addComment: (postId: string, comment: Omit<Comment, 'id' | 'createdAt'>) => Promise<void>;
  getPostById: (postId: string) => Post | undefined;
  refreshPosts: () => Promise<void>;
}

const PostsContext = createContext<PostsContextType | null>(null);

const POSTS_STORAGE_KEY = '@stylewise_posts';
const COMMENTS_STORAGE_KEY = '@stylewise_comments';

const SAMPLE_POSTS: Post[] = [
  {
    id: '1',
    userId: 'ai-stylist',
    userName: 'StyleWise AI',
    userAvatar: null,
    userSubscriptionTier: 'vip',
    type: 'standard',
    media: [{ id: '1-1', uri: 'https://images.unsplash.com/photo-1558171813-4c088753af8f?w=600', type: 'image' }],
    images: [{ id: '1-1', uri: 'https://images.unsplash.com/photo-1558171813-4c088753af8f?w=600', type: 'image' }],
    description: 'Style of the Day: Elegant minimalist look perfect for a business casual setting. Neutral tones paired with structured pieces create a sophisticated silhouette.',
    upvotes: 247,
    downvotes: 3,
    thanksCount: 89,
    commentsCount: 34,
    sharesCount: 156,
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    isAIAdviceRequested: false,
    isViralBadge: true,
  },
  {
    id: '2',
    userId: 'user-2',
    userName: 'Emma Style',
    userAvatar: null,
    userSubscriptionTier: 'premium',
    type: 'comparison',
    media: [
      { id: '2-1', uri: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600', type: 'image', votes: 156 },
      { id: '2-2', uri: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=600', type: 'image', votes: 89 },
    ],
    images: [
      { id: '2-1', uri: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600', type: 'image', votes: 156 },
      { id: '2-2', uri: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=600', type: 'image', votes: 89 },
    ],
    description: 'Help me choose! Date night outfit - which one says "romantic dinner" better?',
    upvotes: 312,
    downvotes: 5,
    thanksCount: 45,
    commentsCount: 67,
    sharesCount: 89,
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    isAIAdviceRequested: true,
    aiAdvice: 'Both options are lovely! The first outfit has a more classic romantic vibe with its flowing silhouette, while the second is modern and chic. For a romantic dinner, I\'d lean towards the first - the soft lines are very flattering.',
  },
  {
    id: '3',
    userId: 'user-3',
    userName: 'Alex Fashion',
    userAvatar: null,
    userSubscriptionTier: 'basic',
    type: 'standard',
    media: [{ id: '3-1', uri: 'https://images.unsplash.com/photo-1507680434567-5739c80be1ac?w=600', type: 'image' }],
    images: [{ id: '3-1', uri: 'https://images.unsplash.com/photo-1507680434567-5739c80be1ac?w=600', type: 'image' }],
    description: 'First day at new job outfit check! Going for professional but approachable. Thoughts?',
    upvotes: 89,
    downvotes: 2,
    thanksCount: 23,
    commentsCount: 45,
    sharesCount: 34,
    createdAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    isAIAdviceRequested: true,
    aiAdvice: 'Great choice for a first day! The neutral palette is perfect for making a professional impression. Consider adding a statement accessory to show personality while keeping it workplace-appropriate.',
    country: 'United States',
  },
  {
    id: '4',
    userId: 'user-4',
    userName: 'Jordan Chic',
    userAvatar: null,
    userSubscriptionTier: 'free',
    type: 'standard',
    media: [{ id: '4-1', uri: 'https://images.unsplash.com/photo-1552374196-1ab2a1c593e8?w=600', type: 'image' }],
    images: [{ id: '4-1', uri: 'https://images.unsplash.com/photo-1552374196-1ab2a1c593e8?w=600', type: 'image' }],
    description: 'Weekend brunch vibes! Casual but put-together. Rate my look?',
    upvotes: 156,
    downvotes: 8,
    thanksCount: 34,
    commentsCount: 28,
    sharesCount: 12,
    createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    isAIAdviceRequested: false,
    country: 'United Kingdom',
  },
  {
    id: '5',
    userId: 'user-5',
    userName: 'Sam Trendy',
    userAvatar: null,
    userSubscriptionTier: 'premium',
    type: 'comparison',
    media: [
      { id: '5-1', uri: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=600', type: 'image', votes: 234 },
      { id: '5-2', uri: 'https://images.unsplash.com/photo-1485230895905-ec40ba36b9bc?w=600', type: 'image', votes: 178 },
    ],
    images: [
      { id: '5-1', uri: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=600', type: 'image', votes: 234 },
      { id: '5-2', uri: 'https://images.unsplash.com/photo-1485230895905-ec40ba36b9bc?w=600', type: 'image', votes: 178 },
    ],
    description: 'Wedding guest outfit dilemma! Which one is more appropriate for a garden wedding?',
    upvotes: 445,
    downvotes: 12,
    thanksCount: 78,
    commentsCount: 92,
    sharesCount: 203,
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    isAIAdviceRequested: true,
    aiAdvice: 'For a garden wedding, Option A is the clear winner! The floral pattern and flowing fabric are perfect for the setting. Option B is stunning but might be better suited for an evening indoor event.',
    isViralBadge: true,
  },
];

const SAMPLE_COMMENTS: Comment[] = [
  {
    id: 'c1',
    postId: '2',
    userId: 'user-10',
    userName: 'StyleGuru',
    userAvatar: null,
    content: 'Definitely the first one! The color really complements your skin tone.',
    isVoice: false,
    createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    isAI: false,
  },
  {
    id: 'c2',
    postId: '2',
    userId: 'ai-stylist',
    userName: 'StyleWise AI',
    userAvatar: null,
    content: 'Based on the romantic dinner setting, the first outfit creates a softer, more approachable vibe. The draping is elegant and the silhouette is timeless.',
    isVoice: false,
    createdAt: new Date(Date.now() - 4.5 * 60 * 60 * 1000).toISOString(),
    isAI: true,
  },
  {
    id: 'c3',
    postId: '3',
    userId: 'user-11',
    userName: 'CareerStyle',
    userAvatar: null,
    content: 'Perfect balance of professional and personable! You\'ll make a great impression.',
    isVoice: false,
    createdAt: new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString(),
    isAI: false,
  },
];

export function PostsProvider({ children }: { children: ReactNode }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [postsData, commentsData] = await Promise.all([
        AsyncStorage.getItem(POSTS_STORAGE_KEY),
        AsyncStorage.getItem(COMMENTS_STORAGE_KEY),
      ]);

      if (postsData) {
        setPosts(JSON.parse(postsData));
      } else {
        setPosts(SAMPLE_POSTS);
        await AsyncStorage.setItem(POSTS_STORAGE_KEY, JSON.stringify(SAMPLE_POSTS));
      }

      if (commentsData) {
        setComments(JSON.parse(commentsData));
      } else {
        setComments(SAMPLE_COMMENTS);
        await AsyncStorage.setItem(COMMENTS_STORAGE_KEY, JSON.stringify(SAMPLE_COMMENTS));
      }
    } catch (error) {
      console.error('Failed to load posts:', error);
      setPosts(SAMPLE_POSTS);
      setComments(SAMPLE_COMMENTS);
    } finally {
      setIsLoading(false);
    }
  };

  const savePosts = async (newPosts: Post[]) => {
    try {
      await AsyncStorage.setItem(POSTS_STORAGE_KEY, JSON.stringify(newPosts));
      setPosts(newPosts);
    } catch (error) {
      console.error('Failed to save posts:', error);
    }
  };

  const saveComments = async (newComments: Comment[]) => {
    try {
      await AsyncStorage.setItem(COMMENTS_STORAGE_KEY, JSON.stringify(newComments));
      setComments(newComments);
    } catch (error) {
      console.error('Failed to save comments:', error);
    }
  };

  const createPost = async (postData: Omit<Post, 'id' | 'createdAt' | 'upvotes' | 'downvotes' | 'thanksCount' | 'commentsCount' | 'sharesCount'>): Promise<Post> => {
    const newPost: Post = {
      ...postData,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      upvotes: 0,
      downvotes: 0,
      thanksCount: 0,
      commentsCount: 0,
      sharesCount: 0,
    };

    const updatedPosts = [newPost, ...posts];
    await savePosts(updatedPosts);
    return newPost;
  };

  const updatePost = async (postId: string, updates: Partial<Post>) => {
    const updatedPosts = posts.map(post => {
      if (post.id === postId) {
        return { ...post, ...updates };
      }
      return post;
    });
    await savePosts(updatedPosts);
  };

  const deletePost = async (postId: string) => {
    const updatedPosts = posts.filter(p => p.id !== postId);
    await savePosts(updatedPosts);
    
    const updatedComments = comments.filter(c => c.postId !== postId);
    await saveComments(updatedComments);
  };

  const votePost = async (postId: string, voteType: 'up' | 'down') => {
    const updatedPosts = posts.map(post => {
      if (post.id === postId) {
        return {
          ...post,
          upvotes: voteType === 'up' ? post.upvotes + 1 : post.upvotes,
          downvotes: voteType === 'down' ? post.downvotes + 1 : post.downvotes,
        };
      }
      return post;
    });
    await savePosts(updatedPosts);
  };

  const voteComparison = async (postId: string, mediaId: string) => {
    const updatedPosts = posts.map(post => {
      if (post.id === postId && post.type === 'comparison') {
        return {
          ...post,
          media: post.media.map(m => ({
            ...m,
            votes: m.id === mediaId ? (m.votes || 0) + 1 : m.votes,
          })),
          images: post.images.map(img => ({
            ...img,
            votes: img.id === mediaId ? (img.votes || 0) + 1 : img.votes,
          })),
        };
      }
      return post;
    });
    await savePosts(updatedPosts);
  };

  const sharePost = async (postId: string) => {
    const updatedPosts = posts.map(post => {
      if (post.id === postId) {
        const newSharesCount = post.sharesCount + 1;
        return {
          ...post,
          sharesCount: newSharesCount,
          isViralBadge: newSharesCount >= 100,
        };
      }
      return post;
    });
    await savePosts(updatedPosts);
  };

  const getPostById = (postId: string): Post | undefined => {
    return posts.find(p => p.id === postId);
  };

  const thankPost = async (postId: string) => {
    const updatedPosts = posts.map(post => {
      if (post.id === postId) {
        return {
          ...post,
          thanksCount: post.thanksCount + 1,
        };
      }
      return post;
    });
    await savePosts(updatedPosts);
  };

  const getPostComments = (postId: string): Comment[] => {
    return comments.filter(c => c.postId === postId);
  };

  const addComment = async (postId: string, commentData: Omit<Comment, 'id' | 'createdAt'>) => {
    const newComment: Comment = {
      ...commentData,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
    };

    const updatedComments = [...comments, newComment];
    await saveComments(updatedComments);

    const updatedPosts = posts.map(post => {
      if (post.id === postId) {
        return { ...post, commentsCount: post.commentsCount + 1 };
      }
      return post;
    });
    await savePosts(updatedPosts);
  };

  const refreshPosts = async () => {
    setIsLoading(true);
    await loadData();
  };

  const userPosts = posts.filter(p => p.userId !== 'ai-stylist');

  return (
    <PostsContext.Provider
      value={{
        posts,
        userPosts,
        isLoading,
        createPost,
        updatePost,
        deletePost,
        votePost,
        voteComparison,
        thankPost,
        sharePost,
        getPostComments,
        addComment,
        getPostById,
        refreshPosts,
      }}
    >
      {children}
    </PostsContext.Provider>
  );
}

export function usePosts() {
  const context = useContext(PostsContext);
  if (!context) {
    throw new Error('usePosts must be used within a PostsProvider');
  }
  return context;
}
