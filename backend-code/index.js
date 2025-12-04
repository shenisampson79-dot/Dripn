const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'stylewise-secret-key-change-in-production';

// Initialize database tables
async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        display_name VARCHAR(100),
        avatar_url TEXT,
        bio TEXT,
        subscription_tier VARCHAR(20) DEFAULT 'free',
        ai_requests_used INTEGER DEFAULT 0,
        uploads_used INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS posts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(20) DEFAULT 'standard',
        caption TEXT,
        tags TEXT[],
        images TEXT[],
        video_url TEXT,
        likes INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS comments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        text TEXT NOT NULL,
        is_voice BOOLEAN DEFAULT FALSE,
        voice_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS likes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(post_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS ai_advice (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
        advice TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Database tables initialized');
  } catch (error) {
    console.error('Database initialization error:', error.message);
  }
}

// Auth middleware
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// ============ AUTH ROUTES ============

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, displayName } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (email, password_hash, display_name) VALUES ($1, $2, $3) RETURNING id, email, display_name, subscription_tier',
      [email, passwordHash, displayName || email.split('@')[0]]
    );

    const user = result.rows[0];
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        subscriptionTier: user.subscription_tier
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        avatarUrl: user.avatar_url,
        bio: user.bio,
        subscriptionTier: user.subscription_tier
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user
app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, display_name, avatar_url, bio, subscription_tier, ai_requests_used, uploads_used FROM users WHERE id = $1',
      [req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    res.json({
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      avatarUrl: user.avatar_url,
      bio: user.bio,
      subscriptionTier: user.subscription_tier,
      aiRequestsUsed: user.ai_requests_used,
      uploadsUsed: user.uploads_used
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// Update profile
app.put('/api/auth/profile', authMiddleware, async (req, res) => {
  try {
    const { displayName, bio, avatarUrl } = req.body;

    const result = await pool.query(
      'UPDATE users SET display_name = COALESCE($1, display_name), bio = COALESCE($2, bio), avatar_url = COALESCE($3, avatar_url) WHERE id = $4 RETURNING id, email, display_name, avatar_url, bio, subscription_tier',
      [displayName, bio, avatarUrl, req.userId]
    );

    const user = result.rows[0];
    res.json({
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      avatarUrl: user.avatar_url,
      bio: user.bio,
      subscriptionTier: user.subscription_tier
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// ============ POSTS ROUTES ============

// Get all posts
app.get('/api/posts', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*, u.display_name as author_name, u.avatar_url as author_avatar,
             (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) as comment_count
      FROM posts p
      JOIN users u ON p.user_id = u.id
      ORDER BY p.created_at DESC
      LIMIT 50
    `);

    const posts = result.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      type: row.type,
      caption: row.caption,
      tags: row.tags || [],
      images: row.images || [],
      videoUrl: row.video_url,
      likes: row.likes,
      commentCount: parseInt(row.comment_count),
      author: {
        displayName: row.author_name,
        avatarUrl: row.author_avatar
      },
      createdAt: row.created_at
    }));

    res.json(posts);
  } catch (error) {
    console.error('Get posts error:', error);
    res.status(500).json({ error: 'Failed to get posts' });
  }
});

// Create post
app.post('/api/posts', authMiddleware, async (req, res) => {
  try {
    const { type, caption, tags, images, videoUrl } = req.body;

    const result = await pool.query(
      'INSERT INTO posts (user_id, type, caption, tags, images, video_url) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [req.userId, type || 'standard', caption, tags || [], images || [], videoUrl]
    );

    // Increment uploads used
    await pool.query('UPDATE users SET uploads_used = uploads_used + 1 WHERE id = $1', [req.userId]);

    const post = result.rows[0];
    res.json({
      id: post.id,
      userId: post.user_id,
      type: post.type,
      caption: post.caption,
      tags: post.tags,
      images: post.images,
      videoUrl: post.video_url,
      likes: post.likes,
      createdAt: post.created_at
    });
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ error: 'Failed to create post' });
  }
});

// Get single post
app.get('/api/posts/:id', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*, u.display_name as author_name, u.avatar_url as author_avatar
      FROM posts p
      JOIN users u ON p.user_id = u.id
      WHERE p.id = $1
    `, [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const row = result.rows[0];

    // Get comments
    const commentsResult = await pool.query(`
      SELECT c.*, u.display_name as author_name, u.avatar_url as author_avatar
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.post_id = $1
      ORDER BY c.created_at DESC
    `, [req.params.id]);

    const comments = commentsResult.rows.map(c => ({
      id: c.id,
      text: c.text,
      isVoice: c.is_voice,
      voiceUrl: c.voice_url,
      author: {
        displayName: c.author_name,
        avatarUrl: c.author_avatar
      },
      createdAt: c.created_at
    }));

    res.json({
      id: row.id,
      userId: row.user_id,
      type: row.type,
      caption: row.caption,
      tags: row.tags || [],
      images: row.images || [],
      videoUrl: row.video_url,
      likes: row.likes,
      author: {
        displayName: row.author_name,
        avatarUrl: row.author_avatar
      },
      comments,
      createdAt: row.created_at
    });
  } catch (error) {
    console.error('Get post error:', error);
    res.status(500).json({ error: 'Failed to get post' });
  }
});

// Like post
app.post('/api/posts/:id/like', authMiddleware, async (req, res) => {
  try {
    // Check if already liked
    const existing = await pool.query(
      'SELECT id FROM likes WHERE post_id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    );

    if (existing.rows.length > 0) {
      // Unlike
      await pool.query('DELETE FROM likes WHERE post_id = $1 AND user_id = $2', [req.params.id, req.userId]);
      await pool.query('UPDATE posts SET likes = likes - 1 WHERE id = $1', [req.params.id]);
      res.json({ liked: false });
    } else {
      // Like
      await pool.query('INSERT INTO likes (post_id, user_id) VALUES ($1, $2)', [req.params.id, req.userId]);
      await pool.query('UPDATE posts SET likes = likes + 1 WHERE id = $1', [req.params.id]);
      res.json({ liked: true });
    }
  } catch (error) {
    console.error('Like error:', error);
    res.status(500).json({ error: 'Failed to like post' });
  }
});

// Add comment
app.post('/api/posts/:id/comments', authMiddleware, async (req, res) => {
  try {
    const { text, isVoice, voiceUrl } = req.body;

    const result = await pool.query(
      'INSERT INTO comments (post_id, user_id, text, is_voice, voice_url) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [req.params.id, req.userId, text, isVoice || false, voiceUrl]
    );

    const userResult = await pool.query('SELECT display_name, avatar_url FROM users WHERE id = $1', [req.userId]);
    const user = userResult.rows[0];

    const comment = result.rows[0];
    res.json({
      id: comment.id,
      text: comment.text,
      isVoice: comment.is_voice,
      voiceUrl: comment.voice_url,
      author: {
        displayName: user.display_name,
        avatarUrl: user.avatar_url
      },
      createdAt: comment.created_at
    });
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

// ============ AI ADVICE ROUTES ============

app.post('/api/ai/advice', authMiddleware, async (req, res) => {
  try {
    const { outfitDescription, colorPalette, occasion, bodyType } = req.body;

    // Check if OpenAI is configured
    if (process.env.OPENAI_API_KEY) {
      const OpenAI = require('openai');
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const prompt = `You are a professional fashion stylist. Analyze this outfit and provide helpful, encouraging advice.

Outfit: ${outfitDescription}
${colorPalette ? `Colors: ${colorPalette}` : ''}
${occasion ? `Occasion: ${occasion}` : ''}
${bodyType ? `Body type: ${bodyType}` : ''}

Provide advice in this format:
1. Overall impression (1-2 sentences)
2. What works well (2-3 points)
3. Suggestions for improvement (2-3 points)
4. Accessories or styling tips
5. Similar looks to try

Be positive, specific, and actionable.`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500
      });

      const advice = completion.choices[0].message.content;

      // Save advice and increment usage
      await pool.query('INSERT INTO ai_advice (user_id, advice) VALUES ($1, $2)', [req.userId, advice]);
      await pool.query('UPDATE users SET ai_requests_used = ai_requests_used + 1 WHERE id = $1', [req.userId]);

      res.json({ advice, source: 'openai' });
    } else {
      // Fallback mock advice
      const mockAdvice = `Great outfit choice! Here's my styling advice:

1. **Overall Impression**: This look has great potential with a nice balance of style and comfort.

2. **What Works Well**:
   - The color combination creates visual interest
   - The silhouette flatters your body type
   - Good choice for the ${occasion || 'occasion'}

3. **Suggestions**:
   - Consider adding a statement accessory to elevate the look
   - A structured bag would complement this outfit nicely
   - Try layering with a light jacket for added dimension

4. **Accessories**: Gold jewelry would pair beautifully with these tones. Consider a delicate necklace or statement earrings.

5. **Similar Looks**: Try pairing with white sneakers for a casual vibe, or heeled boots for evening wear.`;

      await pool.query('UPDATE users SET ai_requests_used = ai_requests_used + 1 WHERE id = $1', [req.userId]);

      res.json({ advice: mockAdvice, source: 'mock' });
    }
  } catch (error) {
    console.error('AI advice error:', error);
    res.status(500).json({ error: 'Failed to get AI advice' });
  }
});

// ============ HEALTH CHECK ============

app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'StyleWise API is running',
    version: '1.0.0'
  });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy' });
});

// Start server
initDB().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`StyleWise API running on port ${PORT}`);
  });
});
