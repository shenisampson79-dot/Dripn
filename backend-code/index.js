const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
const { notifyVIPPurchase } = require('./notificationService');

const app = express();
const PORT = process.env.PORT || 3000;

// VIP price IDs - used to detect VIP purchases
const VIP_PRICE_IDS = ['price_vip_monthly', 'price_vip_yearly'];

// Helper to get Stripe credentials from Replit connector (cached)
let stripeCredentialsCache = null;
let stripeCredentialsCacheTime = 0;
const CACHE_TTL = 60000; // 1 minute cache

async function getStripeCredentials() {
  const now = Date.now();
  if (stripeCredentialsCache && (now - stripeCredentialsCacheTime) < CACHE_TTL) {
    return stripeCredentialsCache;
  }

  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken || !hostname) {
    return null;
  }

  const isProduction = process.env.REPLIT_DEPLOYMENT === '1';
  const targetEnvironment = isProduction ? 'production' : 'development';

  const url = new URL(`https://${hostname}/api/v2/connection`);
  url.searchParams.set('include_secrets', 'true');
  url.searchParams.set('connector_names', 'stripe');
  url.searchParams.set('environment', targetEnvironment);

  const connResponse = await fetch(url.toString(), {
    headers: {
      'Accept': 'application/json',
      'X_REPLIT_TOKEN': xReplitToken
    }
  });

  const connData = await connResponse.json();
  const connectionSettings = connData.items?.[0];

  if (connectionSettings?.settings) {
    stripeCredentialsCache = connectionSettings.settings;
    stripeCredentialsCacheTime = now;
  }

  return stripeCredentialsCache;
}

// Helper to check if a price ID is a VIP tier
function isVIPPriceId(priceId) {
  if (!priceId) return false;
  return VIP_PRICE_IDS.includes(priceId) || 
         priceId.toLowerCase().includes('vip') ||
         priceId.toLowerCase().includes('price_vip');
}

// Stripe webhook endpoint - MUST be before express.json() middleware
// This handles VIP purchase notifications
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const Stripe = require('stripe');
  
  try {
    const credentials = await getStripeCredentials();

    if (!credentials?.secret || !credentials?.webhook_secret) {
      console.log('Stripe webhook: Missing Stripe credentials');
      return res.status(200).json({ received: true });
    }

    const stripe = new Stripe(credentials.secret, {
      apiVersion: '2024-11-20.acacia'
    });

    const sig = req.headers['stripe-signature'];
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        credentials.webhook_secret
      );
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).json({ error: 'Invalid signature' });
    }

    console.log('Stripe webhook received:', event.type);

    // Handle checkout session completed
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const customerEmail = session.customer_email || session.customer_details?.email;
      const customerName = session.customer_details?.name;
      
      // Check metadata for VIP tier
      const isVIP = session.metadata?.tier === 'vip' || 
                    session.metadata?.planTier === 'vip';
      
      if (isVIP) {
        console.log('VIP purchase detected via metadata for:', customerEmail);
        const result = await notifyVIPPurchase(customerEmail, customerName, new Date().toISOString());
        console.log('VIP notification result:', result);
      }
    }

    // Handle subscription creation/update
    if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated') {
      const subscription = event.data.object;
      
      // Check if any item has a VIP price
      let hasVIPPrice = false;
      if (subscription.items?.data) {
        hasVIPPrice = subscription.items.data.some(item => isVIPPriceId(item.price?.id));
      }
      
      // Also check metadata
      const hasVIPMetadata = subscription.metadata?.tier === 'vip' || 
                             subscription.metadata?.planTier === 'vip';
      
      if (hasVIPPrice || hasVIPMetadata) {
        try {
          const customer = await stripe.customers.retrieve(subscription.customer);
          console.log('VIP subscription detected for:', customer.email);
          
          const result = await notifyVIPPurchase(
            customer.email,
            customer.name,
            new Date(subscription.created * 1000).toISOString()
          );
          console.log('VIP notification result:', result);
        } catch (err) {
          console.error('Error retrieving customer:', err.message);
        }
      }
    }

    // Handle invoice.paid for subscription renewals
    if (event.type === 'invoice.paid') {
      const invoice = event.data.object;
      
      // Check if any line item has a VIP price
      let hasVIPItem = false;
      if (invoice.lines?.data) {
        hasVIPItem = invoice.lines.data.some(line => isVIPPriceId(line.price?.id));
      }
      
      if (hasVIPItem && invoice.billing_reason === 'subscription_create') {
        console.log('VIP invoice paid for:', invoice.customer_email);
        const result = await notifyVIPPurchase(
          invoice.customer_email,
          invoice.customer_name,
          new Date(invoice.created * 1000).toISOString()
        );
        console.log('VIP notification result:', result);
      }
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(200).json({ received: true });
  }
});

// Middleware - AFTER webhook route
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

      CREATE TABLE IF NOT EXISTS stylists (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255),
        display_name VARCHAR(100) NOT NULL,
        avatar_url TEXT,
        bio TEXT,
        specialties TEXT[],
        years_experience INTEGER DEFAULT 0,
        status VARCHAR(20) DEFAULT 'pending',
        approved_by UUID,
        approved_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS vip_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        stylist_id UUID REFERENCES stylists(id) ON DELETE CASCADE,
        vip_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        scheduled_at TIMESTAMP NOT NULL,
        duration_minutes INTEGER DEFAULT 15,
        status VARCHAR(20) DEFAULT 'scheduled',
        notes TEXT,
        session_notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS admin_users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        display_name VARCHAR(100),
        role VARCHAR(20) DEFAULT 'admin',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS vip_peer_calls (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        caller_id UUID REFERENCES users(id) ON DELETE CASCADE,
        callee_id UUID REFERENCES users(id) ON DELETE CASCADE,
        room_url TEXT,
        room_token TEXT,
        status VARCHAR(20) DEFAULT 'pending',
        started_at TIMESTAMP,
        ended_at TIMESTAMP,
        duration_seconds INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE vip_sessions ADD COLUMN IF NOT EXISTS room_url TEXT;
      ALTER TABLE vip_sessions ADD COLUMN IF NOT EXISTS room_token TEXT;
    `);
    console.log('Database tables initialized');
  } catch (error) {
    console.error('Database initialization error:', error.message);
  }
}

// Auth middleware for regular users
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

// Auth middleware for stylists
function stylistAuthMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'stylist') {
      return res.status(403).json({ error: 'Stylist access required' });
    }
    req.stylistId = decoded.stylistId;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Auth middleware for admins
function adminAuthMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    req.adminId = decoded.adminId;
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

// ============ ADMIN ROUTES ============

// Admin login
app.post('/api/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await pool.query('SELECT * FROM admin_users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const admin = result.rows[0];
    const validPassword = await bcrypt.compare(password, admin.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign({ adminId: admin.id, role: 'admin' }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      admin: {
        id: admin.id,
        email: admin.email,
        displayName: admin.display_name,
        role: admin.role
      }
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Create admin (first admin setup - should be protected in production)
app.post('/api/admin/setup', async (req, res) => {
  try {
    const { email, password, displayName, setupKey } = req.body;

    // Simple setup key protection
    if (setupKey !== process.env.ADMIN_SETUP_KEY && setupKey !== 'stylewise-admin-setup-2024') {
      return res.status(403).json({ error: 'Invalid setup key' });
    }

    const existingAdmin = await pool.query('SELECT id FROM admin_users WHERE email = $1', [email]);
    if (existingAdmin.rows.length > 0) {
      return res.status(400).json({ error: 'Admin already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO admin_users (email, password_hash, display_name) VALUES ($1, $2, $3) RETURNING id, email, display_name, role',
      [email, passwordHash, displayName || 'Admin']
    );

    const admin = result.rows[0];
    const token = jwt.sign({ adminId: admin.id, role: 'admin' }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      admin: {
        id: admin.id,
        email: admin.email,
        displayName: admin.display_name,
        role: admin.role
      }
    });
  } catch (error) {
    console.error('Admin setup error:', error);
    res.status(500).json({ error: 'Admin setup failed' });
  }
});

// Register a new stylist (admin only)
app.post('/api/admin/stylists', adminAuthMiddleware, async (req, res) => {
  try {
    const { email, displayName, bio, specialties, yearsExperience } = req.body;

    if (!email || !displayName) {
      return res.status(400).json({ error: 'Email and display name required' });
    }

    const existingStylist = await pool.query('SELECT id FROM stylists WHERE email = $1', [email]);
    if (existingStylist.rows.length > 0) {
      return res.status(400).json({ error: 'Stylist with this email already exists' });
    }

    const result = await pool.query(
      `INSERT INTO stylists (email, display_name, bio, specialties, years_experience, status) 
       VALUES ($1, $2, $3, $4, $5, 'pending') 
       RETURNING id, email, display_name, bio, specialties, years_experience, status, created_at`,
      [email, displayName, bio || '', specialties || [], yearsExperience || 0]
    );

    const stylist = result.rows[0];
    res.json({
      id: stylist.id,
      email: stylist.email,
      displayName: stylist.display_name,
      bio: stylist.bio,
      specialties: stylist.specialties,
      yearsExperience: stylist.years_experience,
      status: stylist.status,
      createdAt: stylist.created_at
    });
  } catch (error) {
    console.error('Register stylist error:', error);
    res.status(500).json({ error: 'Failed to register stylist' });
  }
});

// Approve stylist and set password (admin only)
app.post('/api/admin/stylists/:id/approve', adminAuthMiddleware, async (req, res) => {
  try {
    const { password } = req.body;
    const stylistId = req.params.id;

    if (!password) {
      return res.status(400).json({ error: 'Password required for approval' });
    }

    const stylistResult = await pool.query('SELECT * FROM stylists WHERE id = $1', [stylistId]);
    if (stylistResult.rows.length === 0) {
      return res.status(404).json({ error: 'Stylist not found' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `UPDATE stylists 
       SET status = 'approved', password_hash = $1, approved_by = $2, approved_at = CURRENT_TIMESTAMP 
       WHERE id = $3 
       RETURNING id, email, display_name, status, approved_at`,
      [passwordHash, req.adminId, stylistId]
    );

    const stylist = result.rows[0];
    res.json({
      id: stylist.id,
      email: stylist.email,
      displayName: stylist.display_name,
      status: stylist.status,
      approvedAt: stylist.approved_at,
      message: 'Stylist approved and can now login'
    });
  } catch (error) {
    console.error('Approve stylist error:', error);
    res.status(500).json({ error: 'Failed to approve stylist' });
  }
});

// Get all stylists (admin only)
app.get('/api/admin/stylists', adminAuthMiddleware, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, email, display_name, bio, specialties, years_experience, status, approved_at, created_at 
      FROM stylists 
      ORDER BY created_at DESC
    `);

    const stylists = result.rows.map(s => ({
      id: s.id,
      email: s.email,
      displayName: s.display_name,
      bio: s.bio,
      specialties: s.specialties,
      yearsExperience: s.years_experience,
      status: s.status,
      approvedAt: s.approved_at,
      createdAt: s.created_at
    }));

    res.json(stylists);
  } catch (error) {
    console.error('Get stylists error:', error);
    res.status(500).json({ error: 'Failed to get stylists' });
  }
});

// Revoke/suspend stylist (admin only)
app.post('/api/admin/stylists/:id/revoke', adminAuthMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE stylists SET status = 'suspended' WHERE id = $1 RETURNING id, email, status`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Stylist not found' });
    }

    res.json({ message: 'Stylist access revoked', stylist: result.rows[0] });
  } catch (error) {
    console.error('Revoke stylist error:', error);
    res.status(500).json({ error: 'Failed to revoke stylist' });
  }
});

// ============ STYLIST ROUTES ============

// Stylist login
app.post('/api/stylist/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await pool.query('SELECT * FROM stylists WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const stylist = result.rows[0];

    if (stylist.status !== 'approved') {
      return res.status(403).json({ error: 'Account not approved. Please contact administrator.' });
    }

    if (!stylist.password_hash) {
      return res.status(403).json({ error: 'Account setup incomplete. Please contact administrator.' });
    }

    const validPassword = await bcrypt.compare(password, stylist.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign({ stylistId: stylist.id, role: 'stylist' }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      stylist: {
        id: stylist.id,
        email: stylist.email,
        displayName: stylist.display_name,
        avatarUrl: stylist.avatar_url,
        bio: stylist.bio,
        specialties: stylist.specialties,
        yearsExperience: stylist.years_experience
      }
    });
  } catch (error) {
    console.error('Stylist login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get stylist profile
app.get('/api/stylist/profile', stylistAuthMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, display_name, avatar_url, bio, specialties, years_experience FROM stylists WHERE id = $1',
      [req.stylistId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Stylist not found' });
    }

    const stylist = result.rows[0];
    res.json({
      id: stylist.id,
      email: stylist.email,
      displayName: stylist.display_name,
      avatarUrl: stylist.avatar_url,
      bio: stylist.bio,
      specialties: stylist.specialties,
      yearsExperience: stylist.years_experience
    });
  } catch (error) {
    console.error('Get stylist profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// Update stylist profile
app.put('/api/stylist/profile', stylistAuthMiddleware, async (req, res) => {
  try {
    const { displayName, bio, avatarUrl, specialties } = req.body;

    const result = await pool.query(
      `UPDATE stylists 
       SET display_name = COALESCE($1, display_name), 
           bio = COALESCE($2, bio), 
           avatar_url = COALESCE($3, avatar_url),
           specialties = COALESCE($4, specialties)
       WHERE id = $5 
       RETURNING id, email, display_name, avatar_url, bio, specialties`,
      [displayName, bio, avatarUrl, specialties, req.stylistId]
    );

    const stylist = result.rows[0];
    res.json({
      id: stylist.id,
      email: stylist.email,
      displayName: stylist.display_name,
      avatarUrl: stylist.avatar_url,
      bio: stylist.bio,
      specialties: stylist.specialties
    });
  } catch (error) {
    console.error('Update stylist profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// ============ VIP SESSION ROUTES ============

// Get stylist's sessions
app.get('/api/stylist/sessions', stylistAuthMiddleware, async (req, res) => {
  try {
    const { status, upcoming } = req.query;
    
    let query = `
      SELECT s.*, u.display_name as vip_name, u.avatar_url as vip_avatar, u.email as vip_email
      FROM vip_sessions s
      JOIN users u ON s.vip_user_id = u.id
      WHERE s.stylist_id = $1
    `;
    const params = [req.stylistId];

    if (status) {
      query += ` AND s.status = $${params.length + 1}`;
      params.push(status);
    }

    if (upcoming === 'true') {
      query += ` AND s.scheduled_at > NOW()`;
    }

    query += ` ORDER BY s.scheduled_at ASC`;

    const result = await pool.query(query, params);

    const sessions = result.rows.map(s => ({
      id: s.id,
      scheduledAt: s.scheduled_at,
      durationMinutes: s.duration_minutes,
      status: s.status,
      notes: s.notes,
      sessionNotes: s.session_notes,
      completedAt: s.completed_at,
      vipUser: {
        id: s.vip_user_id,
        displayName: s.vip_name,
        avatarUrl: s.vip_avatar,
        email: s.vip_email
      },
      createdAt: s.created_at
    }));

    res.json(sessions);
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({ error: 'Failed to get sessions' });
  }
});

// Get single session details
app.get('/api/stylist/sessions/:id', stylistAuthMiddleware, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT s.*, u.display_name as vip_name, u.avatar_url as vip_avatar, u.email as vip_email
      FROM vip_sessions s
      JOIN users u ON s.vip_user_id = u.id
      WHERE s.id = $1 AND s.stylist_id = $2
    `, [req.params.id, req.stylistId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const s = result.rows[0];
    res.json({
      id: s.id,
      scheduledAt: s.scheduled_at,
      durationMinutes: s.duration_minutes,
      status: s.status,
      notes: s.notes,
      sessionNotes: s.session_notes,
      completedAt: s.completed_at,
      vipUser: {
        id: s.vip_user_id,
        displayName: s.vip_name,
        avatarUrl: s.vip_avatar,
        email: s.vip_email
      },
      createdAt: s.created_at
    });
  } catch (error) {
    console.error('Get session error:', error);
    res.status(500).json({ error: 'Failed to get session' });
  }
});

// Update session (add notes, change status)
app.put('/api/stylist/sessions/:id', stylistAuthMiddleware, async (req, res) => {
  try {
    const { sessionNotes, status } = req.body;

    let query = 'UPDATE vip_sessions SET ';
    const updates = [];
    const params = [];

    if (sessionNotes !== undefined) {
      params.push(sessionNotes);
      updates.push(`session_notes = $${params.length}`);
    }

    if (status) {
      params.push(status);
      updates.push(`status = $${params.length}`);
      if (status === 'completed') {
        updates.push('completed_at = CURRENT_TIMESTAMP');
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    params.push(req.params.id);
    params.push(req.stylistId);
    query += updates.join(', ') + ` WHERE id = $${params.length - 1} AND stylist_id = $${params.length} RETURNING *`;

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update session error:', error);
    res.status(500).json({ error: 'Failed to update session' });
  }
});

// Complete a session
app.post('/api/stylist/sessions/:id/complete', stylistAuthMiddleware, async (req, res) => {
  try {
    const { sessionNotes } = req.body;

    const result = await pool.query(
      `UPDATE vip_sessions 
       SET status = 'completed', session_notes = COALESCE($1, session_notes), completed_at = CURRENT_TIMESTAMP 
       WHERE id = $2 AND stylist_id = $3 
       RETURNING *`,
      [sessionNotes, req.params.id, req.stylistId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json({ message: 'Session completed', session: result.rows[0] });
  } catch (error) {
    console.error('Complete session error:', error);
    res.status(500).json({ error: 'Failed to complete session' });
  }
});

// Book a VIP session (for VIP users)
app.post('/api/sessions/book', authMiddleware, async (req, res) => {
  try {
    const { stylistId, scheduledAt, notes } = req.body;

    // Check if user is VIP
    const userResult = await pool.query('SELECT subscription_tier FROM users WHERE id = $1', [req.userId]);
    if (userResult.rows.length === 0 || userResult.rows[0].subscription_tier !== 'vip') {
      return res.status(403).json({ error: 'VIP subscription required to book stylist sessions' });
    }

    // Check stylist availability (no overlapping sessions)
    const conflictCheck = await pool.query(
      `SELECT id FROM vip_sessions 
       WHERE stylist_id = $1 
       AND status != 'cancelled'
       AND scheduled_at <= $2 
       AND scheduled_at + (duration_minutes || ' minutes')::interval > $2`,
      [stylistId, scheduledAt]
    );

    if (conflictCheck.rows.length > 0) {
      return res.status(409).json({ error: 'Time slot not available' });
    }

    // Check monthly session limit (4 per month for VIP)
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const sessionCount = await pool.query(
      `SELECT COUNT(*) FROM vip_sessions 
       WHERE vip_user_id = $1 AND created_at >= $2 AND status != 'cancelled'`,
      [req.userId, monthStart]
    );

    if (parseInt(sessionCount.rows[0].count) >= 4) {
      return res.status(403).json({ error: 'Monthly session limit (4) reached' });
    }

    const result = await pool.query(
      `INSERT INTO vip_sessions (stylist_id, vip_user_id, scheduled_at, notes) 
       VALUES ($1, $2, $3, $4) 
       RETURNING *`,
      [stylistId, req.userId, scheduledAt, notes]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Book session error:', error);
    res.status(500).json({ error: 'Failed to book session' });
  }
});

// Get available stylists (for VIP users)
app.get('/api/stylists/available', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, display_name, avatar_url, bio, specialties, years_experience 
      FROM stylists 
      WHERE status = 'approved'
      ORDER BY years_experience DESC
    `);

    const stylists = result.rows.map(s => ({
      id: s.id,
      displayName: s.display_name,
      avatarUrl: s.avatar_url,
      bio: s.bio,
      specialties: s.specialties,
      yearsExperience: s.years_experience
    }));

    res.json(stylists);
  } catch (error) {
    console.error('Get available stylists error:', error);
    res.status(500).json({ error: 'Failed to get stylists' });
  }
});

// Get user's booked sessions
app.get('/api/sessions/my', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT s.*, st.display_name as stylist_name, st.avatar_url as stylist_avatar
      FROM vip_sessions s
      JOIN stylists st ON s.stylist_id = st.id
      WHERE s.vip_user_id = $1
      ORDER BY s.scheduled_at DESC
    `, [req.userId]);

    const sessions = result.rows.map(s => ({
      id: s.id,
      scheduledAt: s.scheduled_at,
      durationMinutes: s.duration_minutes,
      status: s.status,
      notes: s.notes,
      stylist: {
        id: s.stylist_id,
        displayName: s.stylist_name,
        avatarUrl: s.stylist_avatar
      },
      createdAt: s.created_at
    }));

    res.json(sessions);
  } catch (error) {
    console.error('Get user sessions error:', error);
    res.status(500).json({ error: 'Failed to get sessions' });
  }
});

// Cancel a session
app.post('/api/sessions/:id/cancel', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE vip_sessions SET status = 'cancelled' WHERE id = $1 AND vip_user_id = $2 RETURNING *`,
      [req.params.id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json({ message: 'Session cancelled', session: result.rows[0] });
  } catch (error) {
    console.error('Cancel session error:', error);
    res.status(500).json({ error: 'Failed to cancel session' });
  }
});

// ============ VIP VIDEO CALLING ROUTES ============

// VIP auth middleware - verifies user is VIP tier
async function vipAuthMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    
    const userResult = await pool.query('SELECT subscription_tier FROM users WHERE id = $1', [req.userId]);
    if (userResult.rows.length === 0 || userResult.rows[0].subscription_tier !== 'vip') {
      return res.status(403).json({ error: 'VIP subscription required for video calls' });
    }
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Generate a unique room URL for video calls
function generateRoomUrl() {
  const roomId = uuidv4().substring(0, 8);
  const baseUrl = process.env.REPLIT_DEV_DOMAIN || 'stylewise.replit.app';
  return `https://${baseUrl}/video-room/${roomId}`;
}

// Get list of VIP members available for video calls
app.get('/api/video/vip-members', vipAuthMiddleware, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, display_name, avatar_url, bio 
      FROM users 
      WHERE subscription_tier = 'vip' AND id != $1
      ORDER BY display_name ASC
    `, [req.userId]);

    const members = result.rows.map(u => ({
      id: u.id,
      displayName: u.display_name,
      avatarUrl: u.avatar_url,
      bio: u.bio
    }));

    res.json(members);
  } catch (error) {
    console.error('Get VIP members error:', error);
    res.status(500).json({ error: 'Failed to get VIP members' });
  }
});

// Initiate a VIP-to-VIP video call
app.post('/api/video/call', vipAuthMiddleware, async (req, res) => {
  try {
    const { calleeId } = req.body;

    if (!calleeId) {
      return res.status(400).json({ error: 'Callee ID required' });
    }

    // Verify callee is also VIP
    const calleeResult = await pool.query('SELECT subscription_tier, display_name FROM users WHERE id = $1', [calleeId]);
    if (calleeResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (calleeResult.rows[0].subscription_tier !== 'vip') {
      return res.status(403).json({ error: 'Can only call VIP members' });
    }

    const roomUrl = generateRoomUrl();
    const roomToken = uuidv4();

    const result = await pool.query(
      `INSERT INTO vip_peer_calls (caller_id, callee_id, room_url, room_token, status) 
       VALUES ($1, $2, $3, $4, 'pending') 
       RETURNING *`,
      [req.userId, calleeId, roomUrl, roomToken]
    );

    res.json({
      callId: result.rows[0].id,
      roomUrl: result.rows[0].room_url,
      roomToken: result.rows[0].room_token,
      status: result.rows[0].status,
      calleeName: calleeResult.rows[0].display_name
    });
  } catch (error) {
    console.error('Initiate call error:', error);
    res.status(500).json({ error: 'Failed to initiate call' });
  }
});

// Accept a video call
app.post('/api/video/call/:id/accept', vipAuthMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE vip_peer_calls 
       SET status = 'active', started_at = CURRENT_TIMESTAMP 
       WHERE id = $1 AND callee_id = $2 AND status = 'pending'
       RETURNING *`,
      [req.params.id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Call not found or already handled' });
    }

    res.json({
      id: result.rows[0].id,
      roomUrl: result.rows[0].room_url,
      roomToken: result.rows[0].room_token,
      status: result.rows[0].status
    });
  } catch (error) {
    console.error('Accept call error:', error);
    res.status(500).json({ error: 'Failed to accept call' });
  }
});

// Decline or end a video call
app.post('/api/video/call/:id/end', vipAuthMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE vip_peer_calls 
       SET status = 'ended', ended_at = CURRENT_TIMESTAMP,
           duration_seconds = EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - COALESCE(started_at, created_at)))::INTEGER
       WHERE id = $1 AND (caller_id = $2 OR callee_id = $2)
       RETURNING *`,
      [req.params.id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Call not found' });
    }

    res.json({ message: 'Call ended', call: result.rows[0] });
  } catch (error) {
    console.error('End call error:', error);
    res.status(500).json({ error: 'Failed to end call' });
  }
});

// Get pending incoming calls
app.get('/api/video/incoming', vipAuthMiddleware, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.*, u.display_name as caller_name, u.avatar_url as caller_avatar
      FROM vip_peer_calls c
      JOIN users u ON c.caller_id = u.id
      WHERE c.callee_id = $1 AND c.status = 'pending'
      AND c.created_at > NOW() - INTERVAL '2 minutes'
      ORDER BY c.created_at DESC
    `, [req.userId]);

    const calls = result.rows.map(c => ({
      id: c.id,
      caller: {
        id: c.caller_id,
        displayName: c.caller_name,
        avatarUrl: c.caller_avatar
      },
      roomUrl: c.room_url,
      createdAt: c.created_at
    }));

    res.json(calls);
  } catch (error) {
    console.error('Get incoming calls error:', error);
    res.status(500).json({ error: 'Failed to get incoming calls' });
  }
});

// Get call history
app.get('/api/video/history', vipAuthMiddleware, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.*, 
             caller.display_name as caller_name, caller.avatar_url as caller_avatar,
             callee.display_name as callee_name, callee.avatar_url as callee_avatar
      FROM vip_peer_calls c
      JOIN users caller ON c.caller_id = caller.id
      JOIN users callee ON c.callee_id = callee.id
      WHERE c.caller_id = $1 OR c.callee_id = $1
      ORDER BY c.created_at DESC
      LIMIT 50
    `, [req.userId]);

    const calls = result.rows.map(c => ({
      id: c.id,
      caller: {
        id: c.caller_id,
        displayName: c.caller_name,
        avatarUrl: c.caller_avatar
      },
      callee: {
        id: c.callee_id,
        displayName: c.callee_name,
        avatarUrl: c.callee_avatar
      },
      status: c.status,
      durationSeconds: c.duration_seconds,
      createdAt: c.created_at
    }));

    res.json(calls);
  } catch (error) {
    console.error('Get call history error:', error);
    res.status(500).json({ error: 'Failed to get call history' });
  }
});

// Start video session with stylist (VIP only)
app.post('/api/sessions/:id/start-video', authMiddleware, async (req, res) => {
  try {
    // Check if user is VIP
    const userResult = await pool.query('SELECT subscription_tier FROM users WHERE id = $1', [req.userId]);
    if (userResult.rows.length === 0 || userResult.rows[0].subscription_tier !== 'vip') {
      return res.status(403).json({ error: 'VIP subscription required for video sessions' });
    }

    // Check session belongs to user and is scheduled
    const sessionResult = await pool.query(
      `SELECT * FROM vip_sessions WHERE id = $1 AND vip_user_id = $2`,
      [req.params.id, req.userId]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const session = sessionResult.rows[0];
    if (session.status === 'completed' || session.status === 'cancelled') {
      return res.status(400).json({ error: 'Session is not available' });
    }

    const roomUrl = generateRoomUrl();
    const roomToken = uuidv4();

    const updateResult = await pool.query(
      `UPDATE vip_sessions 
       SET room_url = $1, room_token = $2, status = 'in_progress'
       WHERE id = $3
       RETURNING *`,
      [roomUrl, roomToken, req.params.id]
    );

    res.json({
      sessionId: updateResult.rows[0].id,
      roomUrl: updateResult.rows[0].room_url,
      roomToken: updateResult.rows[0].room_token,
      status: updateResult.rows[0].status
    });
  } catch (error) {
    console.error('Start video session error:', error);
    res.status(500).json({ error: 'Failed to start video session' });
  }
});

// Stylist joins video session
app.post('/api/stylist/sessions/:id/join-video', stylistAuthMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM vip_sessions WHERE id = $1 AND stylist_id = $2`,
      [req.params.id, req.stylistId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const session = result.rows[0];
    if (!session.room_url) {
      return res.status(400).json({ error: 'Video session not started by VIP user yet' });
    }

    res.json({
      sessionId: session.id,
      roomUrl: session.room_url,
      roomToken: session.room_token,
      status: session.status
    });
  } catch (error) {
    console.error('Stylist join video error:', error);
    res.status(500).json({ error: 'Failed to join video session' });
  }
});

// ============ ADMIN NOTIFICATION TEST ============

// Test endpoint to verify VIP purchase notifications (admin only)
app.post('/api/admin/test-vip-notification', adminAuthMiddleware, async (req, res) => {
  try {
    const { testEmail, testName } = req.body;
    
    const result = await notifyVIPPurchase(
      testEmail || 'test@example.com',
      testName || 'Test Customer',
      new Date().toISOString()
    );
    
    res.json({
      message: 'VIP notification test completed',
      emailSent: result.emailSent,
      smsSent: result.smsSent,
      details: {
        emailRecipients: ['shenisampson79@gmail.com', 'sheni_sampson@yahoo.co.uk'],
        smsRecipient: '+447835913601',
        note: result.smsSent ? 'SMS sent successfully' : 'SMS skipped - Twilio not configured'
      }
    });
  } catch (error) {
    console.error('Test notification error:', error);
    res.status(500).json({ error: 'Failed to send test notification', details: error.message });
  }
});

// ============ NEWSLETTER SIGNUP ============

app.post('/api/newsletter/subscribe', async (req, res) => {
  try {
    const { email, name, preferences } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS newsletter_subscribers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(100),
        preferences JSONB DEFAULT '{}',
        subscribed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT true
      )
    `);

    const existing = await pool.query(
      'SELECT * FROM newsletter_subscribers WHERE email = $1',
      [email.toLowerCase()]
    );

    if (existing.rows.length > 0) {
      if (existing.rows[0].is_active) {
        return res.json({ 
          success: true, 
          message: 'You are already subscribed to our newsletter',
          alreadySubscribed: true 
        });
      } else {
        await pool.query(
          'UPDATE newsletter_subscribers SET is_active = true, subscribed_at = CURRENT_TIMESTAMP WHERE email = $1',
          [email.toLowerCase()]
        );
        return res.json({ 
          success: true, 
          message: 'Welcome back! You have been resubscribed to our newsletter',
          resubscribed: true 
        });
      }
    }

    await pool.query(
      'INSERT INTO newsletter_subscribers (email, name, preferences) VALUES ($1, $2, $3)',
      [email.toLowerCase(), name || null, preferences ? JSON.stringify(preferences) : '{}']
    );

    const sgMail = require('@sendgrid/mail');
    const sendgridApiKey = process.env.SENDGRID_API_KEY;
    
    if (sendgridApiKey) {
      sgMail.setApiKey(sendgridApiKey);
      
      try {
        await sgMail.send({
          to: email,
          from: 'noreply@stylewise.app',
          subject: 'Welcome to StyleWise Weekly Style Tips!',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #4A3428;">Welcome to StyleWise!</h1>
              <p>Hi${name ? ` ${name}` : ''},</p>
              <p>Thank you for subscribing to our weekly style tips newsletter!</p>
              <p>You'll receive:</p>
              <ul>
                <li>Weekly style inspiration and trending looks</li>
                <li>Exclusive fashion tips from our AI stylist</li>
                <li>Early access to new features and updates</li>
                <li>Special deals and bargains from top brands</li>
              </ul>
              <p>Stay stylish!</p>
              <p>The StyleWise Team</p>
            </div>
          `
        });
      } catch (emailError) {
        console.error('Failed to send welcome email:', emailError);
      }
    }

    res.json({ 
      success: true, 
      message: 'Successfully subscribed to StyleWise newsletter!' 
    });
  } catch (error) {
    console.error('Newsletter subscription error:', error);
    res.status(500).json({ error: 'Failed to subscribe to newsletter' });
  }
});

app.post('/api/newsletter/unsubscribe', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    await pool.query(
      'UPDATE newsletter_subscribers SET is_active = false WHERE email = $1',
      [email.toLowerCase()]
    );

    res.json({ success: true, message: 'Successfully unsubscribed from newsletter' });
  } catch (error) {
    console.error('Newsletter unsubscribe error:', error);
    res.status(500).json({ error: 'Failed to unsubscribe from newsletter' });
  }
});

// Get available newsletter templates (admin only)
app.get('/api/newsletter/templates', adminAuthMiddleware, async (req, res) => {
  try {
    const { getAllNewsletters } = require('./newsletterTemplates');
    const templates = getAllNewsletters();
    res.json({ templates });
  } catch (error) {
    console.error('Get newsletter templates error:', error);
    res.status(500).json({ error: 'Failed to get newsletter templates' });
  }
});

// Get a specific newsletter template (admin only)
app.get('/api/newsletter/templates/:id', adminAuthMiddleware, async (req, res) => {
  try {
    const { getNewsletter } = require('./newsletterTemplates');
    const newsletter = getNewsletter(req.params.id);
    
    if (!newsletter) {
      return res.status(404).json({ error: 'Newsletter template not found' });
    }
    
    res.json({ newsletter });
  } catch (error) {
    console.error('Get newsletter template error:', error);
    res.status(500).json({ error: 'Failed to get newsletter template' });
  }
});

// Send newsletter to all active subscribers (admin only)
app.post('/api/newsletter/send', adminAuthMiddleware, async (req, res) => {
  try {
    const { templateId, testEmail } = req.body;
    
    if (!templateId) {
      return res.status(400).json({ error: 'Template ID is required' });
    }

    const { getNewsletter } = require('./newsletterTemplates');
    const newsletter = getNewsletter(templateId);
    
    if (!newsletter) {
      return res.status(404).json({ error: 'Newsletter template not found' });
    }

    const sgMail = require('@sendgrid/mail');
    
    // Get SendGrid credentials
    const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
    const xReplitToken = process.env.REPL_IDENTITY 
      ? 'repl ' + process.env.REPL_IDENTITY 
      : process.env.WEB_REPL_RENEWAL 
      ? 'depl ' + process.env.WEB_REPL_RENEWAL 
      : null;

    if (!xReplitToken) {
      return res.status(500).json({ error: 'SendGrid credentials not available' });
    }

    const response = await fetch(
      'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=sendgrid',
      {
        headers: {
          'Accept': 'application/json',
          'X_REPLIT_TOKEN': xReplitToken
        }
      }
    );

    const data = await response.json();
    const sendGridSettings = data.items?.[0];

    if (!sendGridSettings || !sendGridSettings.settings.api_key || !sendGridSettings.settings.from_email) {
      return res.status(500).json({ error: 'SendGrid not connected' });
    }

    sgMail.setApiKey(sendGridSettings.settings.api_key);
    const fromEmail = sendGridSettings.settings.from_email;

    // If test email provided, only send to that email
    if (testEmail) {
      await sgMail.send({
        to: testEmail,
        from: fromEmail,
        subject: newsletter.subject,
        text: newsletter.plainText,
        html: newsletter.html,
      });

      return res.json({ 
        success: true, 
        message: `Test newsletter sent to ${testEmail}`,
        sentCount: 1
      });
    }

    // Get all active subscribers
    const subscribersResult = await pool.query(
      'SELECT email, name FROM newsletter_subscribers WHERE is_active = true'
    );

    if (subscribersResult.rows.length === 0) {
      return res.json({ 
        success: true, 
        message: 'No active subscribers to send to',
        sentCount: 0
      });
    }

    // Send to all subscribers in batches of 100
    const subscribers = subscribersResult.rows;
    let sentCount = 0;
    const batchSize = 100;

    for (let i = 0; i < subscribers.length; i += batchSize) {
      const batch = subscribers.slice(i, i + batchSize);
      const messages = batch.map(sub => ({
        to: sub.email,
        from: fromEmail,
        subject: newsletter.subject,
        text: newsletter.plainText,
        html: newsletter.html,
      }));

      try {
        await Promise.all(messages.map(msg => sgMail.send(msg)));
        sentCount += batch.length;
      } catch (batchError) {
        console.error(`Error sending batch ${i / batchSize + 1}:`, batchError.message);
      }
    }

    // Log the send
    await pool.query(`
      CREATE TABLE IF NOT EXISTS newsletter_sends (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        template_id VARCHAR(100) NOT NULL,
        subject VARCHAR(255) NOT NULL,
        sent_count INTEGER DEFAULT 0,
        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        sent_by VARCHAR(255)
      )
    `);

    await pool.query(
      'INSERT INTO newsletter_sends (template_id, subject, sent_count, sent_by) VALUES ($1, $2, $3, $4)',
      [templateId, newsletter.subject, sentCount, req.admin?.email || 'admin']
    );

    res.json({ 
      success: true, 
      message: `Newsletter sent to ${sentCount} subscribers`,
      sentCount,
      templateId,
      subject: newsletter.subject
    });
  } catch (error) {
    console.error('Send newsletter error:', error);
    res.status(500).json({ error: 'Failed to send newsletter' });
  }
});

// Get newsletter send history (admin only)
app.get('/api/newsletter/history', adminAuthMiddleware, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM newsletter_sends 
      ORDER BY sent_at DESC 
      LIMIT 50
    `);
    
    res.json({ history: result.rows });
  } catch (error) {
    console.error('Get newsletter history error:', error);
    res.json({ history: [] });
  }
});

// Get subscriber count (admin only)
app.get('/api/newsletter/stats', adminAuthMiddleware, async (req, res) => {
  try {
    const activeResult = await pool.query(
      'SELECT COUNT(*) as count FROM newsletter_subscribers WHERE is_active = true'
    );
    const totalResult = await pool.query(
      'SELECT COUNT(*) as count FROM newsletter_subscribers'
    );
    
    res.json({ 
      activeSubscribers: parseInt(activeResult.rows[0]?.count || 0),
      totalSubscribers: parseInt(totalResult.rows[0]?.count || 0)
    });
  } catch (error) {
    console.error('Get newsletter stats error:', error);
    res.json({ activeSubscribers: 0, totalSubscribers: 0 });
  }
});

// ============ REFERRAL TRACKING ============

app.post('/api/referral/track', async (req, res) => {
  try {
    const { referralCode, newUserId, newUserEmail } = req.body;
    
    if (!referralCode || !newUserId) {
      return res.status(400).json({ error: 'Referral code and new user ID are required' });
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS referrals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        referral_code VARCHAR(20) NOT NULL,
        referred_user_id UUID NOT NULL,
        referred_user_email VARCHAR(255),
        referred_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        reward_claimed BOOLEAN DEFAULT false
      )
    `);

    await pool.query(
      'INSERT INTO referrals (referral_code, referred_user_id, referred_user_email) VALUES ($1, $2, $3)',
      [referralCode.toUpperCase(), newUserId, newUserEmail || null]
    );

    res.json({ success: true, message: 'Referral tracked successfully' });
  } catch (error) {
    console.error('Referral tracking error:', error);
    res.status(500).json({ error: 'Failed to track referral' });
  }
});

app.get('/api/referral/stats/:code', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT COUNT(*) as total_referrals FROM referrals WHERE referral_code = $1',
      [req.params.code.toUpperCase()]
    );

    res.json({ 
      referralCode: req.params.code.toUpperCase(),
      totalReferrals: parseInt(result.rows[0]?.total_referrals || 0)
    });
  } catch (error) {
    console.error('Referral stats error:', error);
    res.status(500).json({ error: 'Failed to get referral stats' });
  }
});

// ============ HEALTH CHECK ============

app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'StyleWise API is running',
    version: '1.0.0',
    features: {
      vipNotifications: true,
      emailAlerts: 'SendGrid',
      smsAlerts: process.env.TWILIO_ACCOUNT_SID ? 'Twilio (configured)' : 'Twilio (not configured)'
    }
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
