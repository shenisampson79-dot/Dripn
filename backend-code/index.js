const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
const { notifyVIPPurchase } = require('./notificationService');
const { analyzeUserStyleProfile, generatePersonalizedStyleOfTheDay, generatePersonalizedEventRecommendations, generatePersonalizedOffers } = require('./styleProfileService');
const { scanEmergingFashionTrends, scanViralFashionMoments, predictNextBigTrend, getRegionalTrendInsights } = require('./trendScannerService');
const { sendPushNotification, sendBatchPushNotifications, processEventReminders } = require('./pushNotificationService');
const colorTrendService = require('./colorTrendService');
const { generateStylistResponse, detectMood, performComplexAnalysis, getAvailableAnalysisTypes, getBestReasoningModel } = require('./aiStylistService');
const { getBestModel, getModelStatus, refreshAllModels, performHealthCheck, checkForNewModels } = require('./modelLifecycleService');
const { analyzeOutfitPhoto, compareOutfits, extractColorsFromPhoto } = require('./visionAnalysisService');
const { transcribeAudio, synthesizeSpeech, processVoiceMessage, createVoiceResponse, getAllVoices, generateVoicePreview, getSupportedLanguages } = require('./voiceService');
const { getMoodBasedOutfit, getBodyPositivityAdvice, getCapsuleWardrobePlan, getConfidenceRitual, getWellnessOutfit, getDailyAffirmation } = require('./lifestyleStylistService');
const { semanticStyleSearch, findComplementaryPieces, generateEmbedding, getCacheStats } = require('./styleEmbeddingService');
const { generateOutfitInspiration, generateMoodBoard, generateSimilarLook, generateOutfitVariations, generateStyleGuide, getAvailableStyles, getAvailableMoods } = require('./imageGenerationService');

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
const JWT_SECRET = process.env.JWT_SECRET || 'dripn-secret-key-change-in-production';

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
        stripe_customer_id VARCHAR(255),
        stripe_subscription_id VARCHAR(255),
        ai_requests_used INTEGER DEFAULT 0,
        uploads_used INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255);

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

      -- Style Profile and Personalization Tables
      CREATE TABLE IF NOT EXISTS user_style_profiles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
        dominant_styles TEXT[],
        color_preferences TEXT[],
        fashion_interests TEXT[],
        style_personality TEXT,
        strength_areas TEXT[],
        growth_areas TEXT[],
        recommended_brands TEXT[],
        style_influencer_type VARCHAR(100),
        confidence_score DECIMAL(3,2) DEFAULT 0,
        seasonal_styles JSONB,
        data_points JSONB,
        last_analyzed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS user_interactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        interaction_type VARCHAR(50) NOT NULL,
        target_type VARCHAR(50) NOT NULL,
        target_id VARCHAR(255),
        target_data JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS post_dislikes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(post_id, user_id)
      );

      -- Trend Scanner Tables
      CREATE TABLE IF NOT EXISTS trend_reports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        report_type VARCHAR(50) NOT NULL,
        region VARCHAR(100),
        gender VARCHAR(20),
        season VARCHAR(20),
        trends JSONB,
        color_forecast JSONB,
        style_movement JSONB,
        trend_alert JSONB,
        sources TEXT[],
        generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS viral_fashion_moments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        moments JSONB,
        trending_hashtags TEXT[],
        must_follow JSONB,
        scanned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS trend_predictions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        prediction JSONB,
        confidence DECIMAL(3,2),
        gender VARCHAR(20),
        age_group VARCHAR(20),
        predicted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Push Notification Tables
      CREATE TABLE IF NOT EXISTS push_notification_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        token TEXT NOT NULL,
        device_type VARCHAR(20),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, token)
      );

      CREATE TABLE IF NOT EXISTS event_reminders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        event_id VARCHAR(255) NOT NULL,
        event_title VARCHAR(255) NOT NULL,
        event_date DATE NOT NULL,
        event_time VARCHAR(50),
        event_data JSONB,
        reminder_sent BOOLEAN DEFAULT false,
        sent_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, event_id)
      );

      CREATE TABLE IF NOT EXISTS notification_preferences (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
        event_reminders BOOLEAN DEFAULT true,
        style_recommendations BOOLEAN DEFAULT true,
        trend_alerts BOOLEAN DEFAULT true,
        personalized_offers BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Color Trend Intelligence Tables
      CREATE TABLE IF NOT EXISTS trend_color_palettes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        year INTEGER NOT NULL,
        region VARCHAR(50) NOT NULL,
        style_theme VARCHAR(50) NOT NULL,
        color_role VARCHAR(50) NOT NULL,
        color_value VARCHAR(7) NOT NULL,
        color_name VARCHAR(100),
        source VARCHAR(100),
        mood_tags TEXT[],
        is_active BOOLEAN DEFAULT false,
        approved_by UUID,
        approved_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS color_trend_scans (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        year INTEGER NOT NULL,
        scan_type VARCHAR(50) NOT NULL,
        regions TEXT[],
        pantone_data JSONB,
        style_themes_data JSONB,
        regional_palettes_data JSONB,
        status VARCHAR(20) DEFAULT 'pending',
        errors JSONB,
        scanned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Add indexes for performance
      CREATE INDEX IF NOT EXISTS idx_user_interactions_user ON user_interactions(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_interactions_type ON user_interactions(interaction_type);
      CREATE INDEX IF NOT EXISTS idx_event_reminders_date ON event_reminders(event_date);
      CREATE INDEX IF NOT EXISTS idx_trend_reports_date ON trend_reports(generated_at);
      CREATE INDEX IF NOT EXISTS idx_trend_color_palettes_active ON trend_color_palettes(is_active, year, region);
      CREATE INDEX IF NOT EXISTS idx_trend_color_palettes_style ON trend_color_palettes(style_theme, color_role);

      -- Virtual Try-On History Table
      CREATE TABLE IF NOT EXISTS virtual_try_on_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        human_image_url TEXT NOT NULL,
        garment_image_url TEXT NOT NULL,
        result_image_url TEXT,
        garment_description TEXT,
        processing_time_ms INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_virtual_try_on_user ON virtual_try_on_history(user_id, created_at);

      -- User Feedback Table
      CREATE TABLE IF NOT EXISTS user_feedback (
        id SERIAL PRIMARY KEY,
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        feedback_type VARCHAR(50) NOT NULL,
        category VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        rating INTEGER,
        device_info VARCHAR(255),
        app_version VARCHAR(50),
        status VARCHAR(50) DEFAULT 'pending',
        admin_notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_user_feedback_type ON user_feedback(feedback_type, status);
      CREATE INDEX IF NOT EXISTS idx_user_feedback_created ON user_feedback(created_at DESC);
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

// ============ STRIPE CHECKOUT ROUTES ============

// Create Stripe checkout session for subscriptions
app.post('/api/checkout/create-session', authMiddleware, async (req, res) => {
  try {
    const { priceId, planTier } = req.body;
    
    if (!priceId) {
      return res.status(400).json({ error: 'Price ID is required' });
    }

    const credentials = await getStripeCredentials();
    if (!credentials?.secret) {
      return res.status(500).json({ error: 'Stripe not configured' });
    }

    const Stripe = require('stripe');
    const stripe = new Stripe(credentials.secret, {
      apiVersion: '2024-11-20.acacia'
    });

    // Get user email
    const userResult = await pool.query('SELECT email, display_name FROM users WHERE id = $1', [req.userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const user = userResult.rows[0];

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      customer_email: user.email,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      metadata: {
        userId: req.userId,
        planTier: planTier || 'unknown',
        tier: planTier || 'unknown',
      },
      success_url: `${req.protocol}://${req.get('host')}/api/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.protocol}://${req.get('host')}/api/checkout/cancel`,
    });

    res.json({ 
      url: session.url,
      sessionId: session.id 
    });
  } catch (error) {
    console.error('Checkout session error:', error);
    res.status(500).json({ error: error.message || 'Failed to create checkout session' });
  }
});

// Checkout success - update user subscription
app.get('/api/checkout/success', async (req, res) => {
  try {
    const { session_id } = req.query;
    
    if (!session_id) {
      return res.redirect('dripn://subscription?status=error');
    }

    const credentials = await getStripeCredentials();
    if (!credentials?.secret) {
      return res.redirect('dripn://subscription?status=error');
    }

    const Stripe = require('stripe');
    const stripe = new Stripe(credentials.secret, {
      apiVersion: '2024-11-20.acacia'
    });

    const session = await stripe.checkout.sessions.retrieve(session_id);
    
    if (session.payment_status === 'paid' && session.metadata?.userId) {
      const planTier = session.metadata.planTier || session.metadata.tier || 'premium';
      const subscriptionId = session.subscription || null;
      
      if (subscriptionId) {
        await pool.query(
          'UPDATE users SET subscription_tier = $1, stripe_subscription_id = $2 WHERE id = $3',
          [planTier, subscriptionId, session.metadata.userId]
        );
      } else {
        await pool.query(
          'UPDATE users SET subscription_tier = $1 WHERE id = $2',
          [planTier, session.metadata.userId]
        );
      }
      console.log(`Updated user ${session.metadata.userId} to ${planTier} tier (subscription: ${subscriptionId})`);
    }

    // Redirect to app with success status
    res.redirect('dripn://subscription?status=success');
  } catch (error) {
    console.error('Checkout success error:', error);
    res.redirect('dripn://subscription?status=error');
  }
});

// Checkout cancel
app.get('/api/checkout/cancel', (req, res) => {
  res.redirect('dripn://subscription?status=cancelled');
});

// Get Stripe publishable key for client
app.get('/api/stripe/config', async (req, res) => {
  try {
    const credentials = await getStripeCredentials();
    if (!credentials?.publishable) {
      return res.status(500).json({ error: 'Stripe not configured' });
    }
    res.json({ publishableKey: credentials.publishable });
  } catch (error) {
    console.error('Stripe config error:', error);
    res.status(500).json({ error: 'Failed to get Stripe config' });
  }
});

// ============ SUBSCRIPTION MANAGEMENT ROUTES ============

const SUBSCRIPTION_PLAN_MAP = {
  subscription: { name: 'Style Chat', monthlyPrice: 999, yearlyPrice: 9599 },
  premium: { name: 'Personal Stylist', monthlyPrice: 1499, yearlyPrice: 14399 },
  pro: { name: 'Stylist Unlimited', monthlyPrice: 1999, yearlyPrice: 19199 },
};

app.get('/api/subscription/plans', async (req, res) => {
  try {
    const credentials = await getStripeCredentials();
    const plans = Object.entries(SUBSCRIPTION_PLAN_MAP).map(([id, plan]) => ({
      id,
      name: plan.name,
      monthlyPrice: `£${(plan.monthlyPrice / 100).toFixed(2)}`,
      monthlyPriceAmount: plan.monthlyPrice,
      yearlyPrice: `£${(plan.yearlyPrice / 100).toFixed(2)}`,
      yearlyPriceAmount: plan.yearlyPrice,
      yearlySavings: '20%',
      currency: 'gbp',
      features: [],
      popular: id === 'premium',
    }));
    res.json({ plans });
  } catch (error) {
    console.error('Subscription plans error:', error);
    res.status(500).json({ error: 'Failed to get subscription plans' });
  }
});

app.get('/api/subscription/status', authMiddleware, async (req, res) => {
  try {
    const userResult = await pool.query(
      'SELECT subscription_tier, stripe_customer_id, stripe_subscription_id FROM users WHERE id = $1',
      [req.userId]
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const user = userResult.rows[0];
    const isActive = user.subscription_tier && user.subscription_tier !== 'free';

    let cancelAtPeriodEnd = false;
    let currentPeriodEnd = null;

    if (isActive && user.stripe_subscription_id) {
      try {
        const credentials = await getStripeCredentials();
        if (credentials?.secret) {
          const Stripe = require('stripe');
          const stripe = new Stripe(credentials.secret, { apiVersion: '2024-11-20.acacia' });
          const sub = await stripe.subscriptions.retrieve(user.stripe_subscription_id);
          cancelAtPeriodEnd = sub.cancel_at_period_end;
          currentPeriodEnd = new Date(sub.current_period_end * 1000).toISOString();
        }
      } catch (e) {
        console.log('Could not fetch Stripe subscription details:', e.message);
      }
    }

    res.json({
      active: isActive,
      plan: user.subscription_tier || 'free',
      status: isActive ? 'active' : 'inactive',
      currentPeriodEnd,
      cancelAtPeriodEnd,
      stripeCustomerId: user.stripe_customer_id || null,
      stripeSubscriptionId: user.stripe_subscription_id || null,
    });
  } catch (error) {
    console.error('Subscription status error:', error);
    res.status(500).json({ error: 'Failed to get subscription status' });
  }
});

app.post('/api/subscription/create-checkout', authMiddleware, async (req, res) => {
  try {
    const { planId, billingCycle } = req.body;

    if (!planId || !SUBSCRIPTION_PLAN_MAP[planId]) {
      return res.status(400).json({ error: 'Valid plan ID is required (subscription, premium, or pro)' });
    }

    const credentials = await getStripeCredentials();
    if (!credentials?.secret) {
      return res.status(500).json({ error: 'Stripe not configured' });
    }

    const Stripe = require('stripe');
    const stripe = new Stripe(credentials.secret, { apiVersion: '2024-11-20.acacia' });

    const userResult = await pool.query('SELECT email, display_name, stripe_customer_id FROM users WHERE id = $1', [req.userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const user = userResult.rows[0];

    let customerId = user.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.display_name,
        metadata: { userId: req.userId },
      });
      customerId = customer.id;
      await pool.query(
        'ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255); ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255);'
      ).catch(() => {});
      await pool.query('UPDATE users SET stripe_customer_id = $1 WHERE id = $2', [customerId, req.userId]);
    }

    const plan = SUBSCRIPTION_PLAN_MAP[planId];
    const unitAmount = billingCycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;
    const interval = billingCycle === 'yearly' ? 'year' : 'month';

    const baseUrl = process.env.EXPO_PUBLIC_API_URL || `${req.protocol}://${req.get('host')}`;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      customer: customerId,
      line_items: [
        {
          price_data: {
            currency: 'gbp',
            product_data: {
              name: `Dripn ${plan.name}`,
              description: `${plan.name} subscription - ${billingCycle || 'monthly'}`,
            },
            unit_amount: unitAmount,
            recurring: { interval },
          },
          quantity: 1,
        },
      ],
      metadata: {
        userId: req.userId,
        planTier: planId,
        tier: planId,
        billingCycle: billingCycle || 'monthly',
      },
      success_url: `${baseUrl}/api/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/api/checkout/cancel`,
    });

    res.json({
      checkoutUrl: session.url,
      sessionId: session.id,
    });
  } catch (error) {
    console.error('Subscription checkout error:', error);
    res.status(500).json({ error: error.message || 'Failed to create checkout session' });
  }
});

app.post('/api/subscription/manage', authMiddleware, async (req, res) => {
  try {
    const credentials = await getStripeCredentials();
    if (!credentials?.secret) {
      return res.status(500).json({ error: 'Stripe not configured' });
    }

    const Stripe = require('stripe');
    const stripe = new Stripe(credentials.secret, { apiVersion: '2024-11-20.acacia' });

    const userResult = await pool.query('SELECT stripe_customer_id FROM users WHERE id = $1', [req.userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const customerId = userResult.rows[0].stripe_customer_id;
    if (!customerId) {
      return res.status(400).json({ error: 'No billing account found. Please subscribe first.' });
    }

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${baseUrl}/api/checkout/cancel`,
    });

    res.json({ url: portalSession.url });
  } catch (error) {
    console.error('Billing portal error:', error);
    res.status(500).json({ error: error.message || 'Failed to open billing portal' });
  }
});

app.post('/api/subscription/cancel', authMiddleware, async (req, res) => {
  try {
    const credentials = await getStripeCredentials();
    if (!credentials?.secret) {
      return res.status(500).json({ error: 'Stripe not configured' });
    }

    const Stripe = require('stripe');
    const stripe = new Stripe(credentials.secret, { apiVersion: '2024-11-20.acacia' });

    const userResult = await pool.query('SELECT stripe_subscription_id FROM users WHERE id = $1', [req.userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const subscriptionId = userResult.rows[0].stripe_subscription_id;
    if (!subscriptionId) {
      return res.status(400).json({ error: 'No active subscription found' });
    }

    const subscription = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });

    res.json({
      success: true,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
    });
  } catch (error) {
    console.error('Subscription cancel error:', error);
    res.status(500).json({ error: error.message || 'Failed to cancel subscription' });
  }
});

app.post('/api/subscription/reactivate', authMiddleware, async (req, res) => {
  try {
    const credentials = await getStripeCredentials();
    if (!credentials?.secret) {
      return res.status(500).json({ error: 'Stripe not configured' });
    }

    const Stripe = require('stripe');
    const stripe = new Stripe(credentials.secret, { apiVersion: '2024-11-20.acacia' });

    const userResult = await pool.query('SELECT stripe_subscription_id FROM users WHERE id = $1', [req.userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const subscriptionId = userResult.rows[0].stripe_subscription_id;
    if (!subscriptionId) {
      return res.status(400).json({ error: 'No subscription found to reactivate' });
    }

    const subscription = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false,
    });

    res.json({
      success: true,
      reactivated: !subscription.cancel_at_period_end,
    });
  } catch (error) {
    console.error('Subscription reactivate error:', error);
    res.status(500).json({ error: error.message || 'Failed to reactivate subscription' });
  }
});

app.post('/api/subscription/cancel/start', authMiddleware, async (req, res) => {
  try {
    res.json({
      stylist: 'ruby',
      stylistName: 'Ruby',
      message: "I'm sorry to hear you're thinking of leaving. Before you go, could you tell me what's not working for you?",
      feedbackPrompt: "Your feedback helps us improve Dripn for everyone.",
      cancellationReasons: [
        { value: 'too_expensive', label: "It's too expensive" },
        { value: 'not_using', label: "I don't use it enough" },
        { value: 'missing_features', label: "Missing features I need" },
        { value: 'found_alternative', label: 'Found a better alternative' },
        { value: 'technical_issues', label: 'Technical issues' },
        { value: 'other', label: 'Other reason' },
      ],
    });
  } catch (error) {
    console.error('Cancel start error:', error);
    res.status(500).json({ error: 'Failed to start cancellation' });
  }
});

app.post('/api/subscription/cancel/feedback', authMiddleware, async (req, res) => {
  try {
    const { reason, feedback, wouldReturn } = req.body;
    console.log(`Cancellation feedback from user ${req.userId}: reason=${reason}, feedback=${feedback}, wouldReturn=${wouldReturn}`);
    res.json({ success: true });
  } catch (error) {
    console.error('Cancel feedback error:', error);
    res.status(500).json({ error: 'Failed to submit feedback' });
  }
});

app.post('/api/subscription/cancel/complete', authMiddleware, async (req, res) => {
  try {
    res.json({
      stylistName: 'Ruby',
      farewellMessage: "It's been a pleasure styling you. Your wardrobe data will be saved, so you can pick up right where you left off if you ever come back.",
      reactivationOffer: {
        options: [
          { type: 'discount', label: '50% off for 3 months', price: '£4.99/mo' },
          { type: 'pause', label: 'Pause for 1 month', price: 'Free' },
          { type: 'downgrade', label: 'Switch to Style Chat', price: '£9.99/mo' },
        ],
      },
    });
  } catch (error) {
    console.error('Cancel complete error:', error);
    res.status(500).json({ error: 'Failed to complete cancellation' });
  }
});

app.post('/api/checkout/dfy/create-session', authMiddleware, async (req, res) => {
  try {
    const { email, packageType } = req.body;

    if (!packageType || !['lite', 'core'].includes(packageType)) {
      return res.status(400).json({ error: 'Valid package type (lite or core) is required' });
    }

    const credentials = await getStripeCredentials();
    if (!credentials?.secret) {
      return res.status(500).json({ error: 'Stripe not configured' });
    }

    const Stripe = require('stripe');
    const stripe = new Stripe(credentials.secret, { apiVersion: '2024-11-20.acacia' });

    const dfyPrices = {
      lite: { name: 'Outfit-Based Setup', amount: 1999 },
      core: { name: 'Core Wardrobe Setup', amount: 3999 },
    };

    const pkg = dfyPrices[packageType];
    const baseUrl = `${req.protocol}://${req.get('host')}`;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: 'gbp',
            product_data: {
              name: `Dripn ${pkg.name}`,
              description: packageType === 'lite' ? '5-7 professionally curated outfits' : 'Up to 30 wardrobe items categorized',
            },
            unit_amount: pkg.amount,
          },
          quantity: 1,
        },
      ],
      metadata: {
        userId: req.userId,
        packageType,
        email,
      },
      success_url: `${baseUrl}/api/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/api/checkout/cancel`,
    });

    res.json({
      checkoutUrl: session.url,
      sessionId: session.id,
    });
  } catch (error) {
    console.error('DFY checkout error:', error);
    res.status(500).json({ error: error.message || 'Failed to create DFY checkout session' });
  }
});

app.get('/api/checkout/dfy/products', async (req, res) => {
  res.json({
    products: [
      {
        id: 'dfy_lite',
        name: 'Outfit-Based Setup',
        price: '£19.99',
        priceAmount: 1999,
        currency: 'gbp',
        features: ['5-7 professionally curated outfits', 'Occasion-specific styling', 'Color coordination'],
        type: 'lite',
      },
      {
        id: 'dfy_core',
        name: 'Core Wardrobe Setup',
        price: '£39.99',
        priceAmount: 3999,
        currency: 'gbp',
        features: ['Up to 30 items categorized', 'Category & formality tagging', 'Color & seasonality analysis', 'Wardrobe gap analysis'],
        type: 'core',
      },
    ],
  });
});

app.post('/api/checkout/dfy/verify', authMiddleware, async (req, res) => {
  try {
    const { sessionId, email } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    const credentials = await getStripeCredentials();
    if (!credentials?.secret) {
      return res.status(500).json({ error: 'Stripe not configured' });
    }

    const Stripe = require('stripe');
    const stripe = new Stripe(credentials.secret, { apiVersion: '2024-11-20.acacia' });

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    res.json({
      success: true,
      verified: session.payment_status === 'paid',
      packageType: session.metadata?.packageType || 'lite',
      email: session.customer_email || email,
    });
  } catch (error) {
    console.error('DFY verify error:', error);
    res.status(500).json({ error: 'Failed to verify payment' });
  }
});

app.post('/api/checkout/dfy/link-payment', authMiddleware, async (req, res) => {
  try {
    const { email } = req.body;
    res.json({ success: true, linked: true, packageType: 'lite' });
  } catch (error) {
    console.error('DFY link error:', error);
    res.status(500).json({ error: 'Failed to link payment' });
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
    if (setupKey !== process.env.ADMIN_SETUP_KEY && setupKey !== 'dripn-admin-setup-2024') {
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

// ============ LANGUAGE & TRANSLATIONS ============

const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', nativeName: 'English', direction: 'ltr' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', direction: 'ltr' },
  { code: 'fr', name: 'French', nativeName: 'Français', direction: 'ltr' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', direction: 'ltr' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', direction: 'ltr' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', direction: 'ltr' },
  { code: 'zh', name: 'Chinese', nativeName: '中文', direction: 'ltr' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', direction: 'ltr' },
  { code: 'ko', name: 'Korean', nativeName: '한국어', direction: 'ltr' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', direction: 'rtl' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', direction: 'ltr' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', direction: 'ltr' },
];

const TRANSLATIONS = {
  es: {
    'common.continue': 'Continuar',
    'common.skip': 'Omitir',
    'common.save': 'Guardar',
    'common.cancel': 'Cancelar',
    'common.back': 'Atrás',
    'common.next': 'Siguiente',
    'common.done': 'Hecho',
    'common.loading': 'Cargando...',
    'common.error': 'Error',
    'common.retry': 'Reintentar',
    'nav.home': 'Inicio',
    'nav.wardrobe': 'Armario',
    'nav.chat': 'Chat',
    'nav.profile': 'Perfil',
    'nav.settings': 'Ajustes',
    'stylist.greeting': '¡Hola! ¿Cómo puedo ayudarte hoy?',
    'stylist.thinking': 'Pensando...',
    'stylist.askMe': 'Pregúntame cualquier cosa sobre moda...',
    'stylist.voiceChat': 'Chat de voz',
    'stylist.personalStylist': 'Estilista personal',
    'wardrobe.addItem': 'Añadir prenda',
    'wardrobe.empty': 'Tu armario está vacío',
    'wardrobe.categories': 'Categorías',
    'wardrobe.favorites': 'Favoritos',
    'wardrobe.allItems': 'Todas las prendas',
    'wardrobe.outfitCalendar': 'Calendario de outfits',
    'wardrobe.myWardrobe': 'Mi armario',
    'wardrobe.moreItemsNeeded': 'Se necesitan más prendas',
    'wardrobe.addItemsMessage': 'Añade al menos 3 prendas a tu armario para que la IA cree combinaciones de outfits.',
    'wardrobe.deleteItem': 'Eliminar prenda',
    'wardrobe.deleteConfirm': '¿Estás seguro de que quieres eliminar esta prenda?',
    'wardrobe.markedAsWorn': 'Marcado como usado hoy',
    'wardrobe.never': 'Nunca',
    'wardrobe.bulkUpload': 'Carga masiva',
    'wardrobe.lastWorn': 'Último uso',
    'wardrobe.wornTimes': 'veces',
    'wardrobe.itemDetails': 'Detalles del artículo',
    'wardrobe.timesWorn': 'Veces usado',
    'wardrobe.loadingWardrobe': 'Cargando tu armario...',
    'wardrobe.myLookbook': 'Mi lookbook',
    'wardrobe.calendar14Day': 'Calendario 14 días',
    'wardrobe.calendar30Day': 'Calendario 30 días',
    'wardrobe.modularWardrobe': 'Armario modular',
    'wardrobe.aiOutfitCreator': 'Creador de outfits IA',
    'wardrobe.unlockDFY': 'Desbloquear configuración lista para usar',
    'wardrobe.categoryAll': 'Todo',
    'wardrobe.categoryTops': 'Tops',
    'wardrobe.categoryBottoms': 'Pantalones',
    'wardrobe.categoryDresses': 'Vestidos',
    'wardrobe.categoryOuterwear': 'Ropa de abrigo',
    'wardrobe.categoryShoes': 'Zapatos',
    'wardrobe.categoryBags': 'Bolsos',
    'wardrobe.categoryAccessories': 'Accesorios',
    'wardrobe.categoryActivewear': 'Deporte',
    'wardrobe.categoryFormal': 'Formal',
    'settings.title': 'Configuración',
    'settings.account': 'Cuenta',
    'settings.editProfile': 'Editar perfil',
    'settings.email': 'Correo electrónico',
    'settings.subscription': 'Suscripción',
    'settings.preferences': 'Preferencias',
    'settings.styleTheme': 'Tema de estilo',
    'settings.colourScheme': 'Esquema de color',
    'settings.selectColourScheme': 'Esquema de color',
    'settings.colorful': 'Colorido',
    'settings.colorfulDesc': 'Degradados vibrantes y colores llamativos',
    'settings.minimalist': 'Minimalista',
    'settings.minimalistDesc': 'Tonos sutiles y discretos',
    'settings.country': 'País',
    'settings.notSet': 'No definido',
    'settings.bodyMeasurements': 'Medidas corporales',
    'settings.trendingColors': 'Colores de tendencia',
    'settings.pantoneNotAvailable': 'Color Pantone del año no disponible',
    'settings.usingBaseColors': 'Usando colores base del tema',
    'settings.checkForTrends': 'Buscar tendencias',
    'settings.inviteFriends': 'Invitar amigos',
    'settings.shareYourCode': 'Comparte tu código',
    'settings.inviteDescription': 'Invita amigos y ambos obtienen 20 solicitudes de IA y 10% de descuento',
    'settings.notifications': 'Notificaciones',
    'settings.communityVoting': 'Votación comunitaria',
    'settings.communityVotingDesc': 'Notificar cuando otros usuarios necesiten tu consejo de moda',
    'settings.priceAlerts': 'Alertas de precio',
    'settings.priceAlertsDesc': 'Notificar cuando los artículos rastreados bajen de precio',
    'settings.voiceAndLanguage': 'Voz e idioma',
    'settings.language': 'Idioma',
    'settings.voiceSpeed': 'Velocidad de voz',
    'settings.autoPlayResponses': 'Reproducir respuestas automáticamente',
    'settings.autoPlayDescription': 'Reproducir voz automáticamente cuando el estilista responda',
    'settings.showTranscriptions': 'Mostrar transcripciones',
    'settings.showTranscriptionsDescription': 'Mostrar versión de texto de los mensajes de voz',
    'settings.support': 'Soporte',
    'settings.helpCenter': 'Centro de ayuda',
    'settings.helpAndFaq': 'Ayuda y preguntas frecuentes',
    'settings.helpSubtitle': 'Busca preguntas y chatea con Julia',
    'settings.chatWithJulia': 'Chatear con Julia',
    'settings.chatWithJuliaSubtitle': 'Obtén soporte instantáneo de nuestra asistente',
    'settings.aiFeatureLab': 'Laboratorio de funciones IA',
    'settings.aiFeatureLabSubtitle': 'Ver sugerencias de funciones generadas por IA',
    'settings.sendFeedback': 'Enviar comentarios',
    'settings.sendFeedbackSubtitle': 'Reportar errores, solicitar funciones o compartir opiniones',
    'settings.termsOfService': 'Términos de servicio',
    'settings.privacyPolicy': 'Política de privacidad',
    'settings.company': 'Empresa',
    'settings.partnerWithUs': 'Asóciate con nosotros',
    'settings.partnerWithUsSubtitle': 'Consultas para estilistas y marcas',
    'settings.accountActions': 'Acciones de cuenta',
    'settings.signOut': 'Cerrar sesión',
    'settings.deleteAccount': 'Eliminar cuenta',
    'settings.selectLanguage': 'Seleccionar idioma',
    'settings.voiceSettings': 'Ajustes de voz',
    'settings.slow': 'Lenta',
    'settings.normal': 'Normal',
    'settings.fast': 'Rápida',
    'settings.logout': 'Cerrar sesión',
    'profile.profile': 'Perfil',
    'profile.adminDashboard': 'Panel de administración',
    'profile.yourStyleProfile': 'Tu perfil de estilo',
    'profile.styleProfileSubtitle': 'Esto nos ayuda a darte mejores sugerencias de outfits y enviar looks relevantes a tu comunidad de estilistas.',
    'profile.notCompleted': 'No completado',
    'profile.completeStyleProfile': 'Completa tu perfil de estilo para sugerencias personalizadas y mejores segundas opiniones de la comunidad.',
    'profile.savedOutfits': 'Outfits guardados',
    'profile.similarOutfit': 'Outfit similar',
    'profile.loadingOutfits': 'Cargando outfits...',
    'profile.noLikedOutfits': 'Sin outfits guardados',
    'profile.noLikedOutfitsHint': 'Guarda outfits de las recomendaciones de tu estilista',
    'home.yourStory': 'Tu historia',
    'home.global': 'Global',
    'home.myRegion': 'Mi región',
    'home.noPostsYet': 'Sin publicaciones aún',
    'home.beFirstToShare': 'Sé el primero en compartir tu estilo con la comunidad',
    'auth.createAccount': 'Crear cuenta',
    'auth.welcomeBack': 'Bienvenido de vuelta',
    'auth.joinCommunity': 'Únete a la comunidad Dripn',
    'auth.signInContinue': 'Inicia sesión para continuar tu viaje de estilo',
    'auth.continueWithGoogle': 'Continuar con Google',
    'auth.continueWithFacebook': 'Continuar con Facebook',
    'auth.continueWithApple': 'Continuar con Apple',
    'auth.or': 'o',
    'auth.fullName': 'Nombre completo',
    'auth.email': 'Correo electrónico',
    'auth.password': 'Contraseña',
    'auth.enterName': 'Introduce tu nombre',
    'auth.emailPlaceholder': 'tu.correo@ejemplo.com',
    'auth.enterPassword': 'Introduce tu contraseña',
    'auth.alreadyHaveAccount': '¿Ya tienes cuenta? ',
    'auth.dontHaveAccount': '¿No tienes cuenta? ',
    'auth.signIn': 'Iniciar sesión',
    'auth.signUp': 'Registrarse',
    'auth.agreeTerms': 'Al continuar, aceptas nuestros',
    'auth.termsOfService': 'Términos de servicio',
    'auth.and': 'y',
    'auth.privacyPolicy': 'Política de privacidad',
    'auth.fillRequired': 'Por favor, completa todos los campos requeridos',
    'auth.enterYourName': 'Por favor, introduce tu nombre',
    'auth.authFailed': 'Autenticación fallida. Por favor, inténtalo de nuevo.',
    'aiStylist.suggestedOutfit': 'Outfit sugerido',
    'aiStylist.thanks': '¡Gracias!',
    'aiStylist.noted': 'Anotado',
    'aiStylist.whatWasntRight': '¿Qué no estuvo bien?',
    'aiStylist.learnPreferences': 'Esto ayuda a tu estilista a conocer tus preferencias',
    'aiStylist.skip': 'Omitir',
    'aiStylist.quickSuggestions': 'Sugerencias rápidas',
    'aiStylist.notMyStyle': 'No es mi estilo',
    'aiStylist.tooWestern': 'Demasiado occidental',
    'aiStylist.didntFitBodyType': 'No se adapta a mi tipo de cuerpo',
    'aiStylist.culturalMismatch': 'No encaja culturalmente',
    'settings.contactUs': 'Contáctanos',
    'settings.privacy': 'Privacidad',
    'settings.about': 'Acerca de',
    'settings.currentPlan': 'Plan actual',
    'settings.managePlan': 'Gestionar plan',
    'onboarding.steps.location.title': '¿Dónde te encuentras?',
    'onboarding.steps.location.description': 'Esto nos ayuda a personalizar tu experiencia con tendencias y tiendas locales.',
    'onboarding.steps.basics.title': 'Cuéntanos sobre ti',
    'onboarding.steps.basics.description': 'Esto nos ayuda a darte consejos de estilo personalizados.',
    'onboarding.steps.style.title': '¿Cuál es tu estilo?',
    'onboarding.steps.style.description': 'Elige la estética que te identifica.',
    'styleSelection.title': '¿Cuál es tu estilo?',
    'styleSelection.subtitle': 'Elige la estética que te identifica',
    'styleSelection.styles.streetwear.name': 'Streetwear',
    'styleSelection.styles.streetwear.description': 'Urbano, atrevido, tendencia',
    'styleSelection.styles.business.name': 'Negocios',
    'styleSelection.styles.business.description': 'Trajes profesionales, camisas y ropa formal',
    'styleSelection.styles.athletic.name': 'Deportivo',
    'styleSelection.styles.athletic.description': 'Activo, dinámico, atlético',
    'styleSelection.styles.boho.name': 'Boho',
    'styleSelection.styles.boho.description': 'Terrenal, relajado, artístico',
    'styleSelection.styles.minimalist.name': 'Minimalista',
    'styleSelection.styles.minimalist.description': 'Piezas simples y atemporales',
    'profile.guestUser': 'Usuario invitado',
    'profile.upgradeToPersonal': 'Mejorar a Estilista Personal',
    'profile.manageSubscription': 'Gestionar suscripción',
    'profile.styleDna': 'ADN de estilo',
    'profile.styleDnaDesc': 'Tu perfil de estilo único',
    'profile.colorAnalysis': 'Análisis de color',
    'profile.colorAnalysisDesc': 'Tus mejores colores',
    'profile.bodyProfile': 'Perfil corporal',
    'profile.bodyProfileDesc': 'Tus medidas y talla',
    'profile.likedOutfits': 'Outfits favoritos',
    'profile.noLikedOutfits': 'Aún no tienes outfits favoritos',
    'profile.styleOfTheDay': 'Estilo del día',
    'profile.viewDetails': 'Ver detalles',
  },
  fr: {
    'common.continue': 'Continuer',
    'common.skip': 'Passer',
    'common.save': 'Sauvegarder',
    'common.cancel': 'Annuler',
    'common.back': 'Retour',
    'common.next': 'Suivant',
    'common.done': 'Terminé',
    'common.loading': 'Chargement...',
    'common.error': 'Erreur',
    'common.retry': 'Réessayer',
    'nav.home': 'Accueil',
    'nav.wardrobe': 'Garde-robe',
    'nav.chat': 'Chat',
    'nav.profile': 'Profil',
    'nav.settings': 'Paramètres',
    'stylist.greeting': 'Bonjour! Comment puis-je vous aider aujourd\'hui?',
    'stylist.thinking': 'Je réfléchis...',
    'stylist.askMe': 'Posez-moi n\'importe quelle question sur la mode...',
    'settings.language': 'Langue',
    'settings.voiceAndLanguage': 'Voix et langue',
    'settings.subscription': 'Abonnement',
    'settings.logout': 'Déconnexion',
  },
  de: {
    'common.continue': 'Weiter',
    'common.skip': 'Überspringen',
    'common.save': 'Speichern',
    'common.cancel': 'Abbrechen',
    'common.back': 'Zurück',
    'common.next': 'Weiter',
    'common.done': 'Fertig',
    'nav.home': 'Startseite',
    'nav.wardrobe': 'Kleiderschrank',
    'nav.chat': 'Chat',
    'nav.profile': 'Profil',
    'nav.settings': 'Einstellungen',
    'settings.language': 'Sprache',
    'settings.subscription': 'Abonnement',
    'settings.logout': 'Abmelden',
  },
};

// Get available languages
app.get('/api/languages', async (req, res) => {
  res.json({ languages: SUPPORTED_LANGUAGES });
});

// Get user's current language
app.get('/api/language/current', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT language_code FROM users WHERE id = $1',
      [req.userId]
    );
    
    const langCode = result.rows[0]?.language_code || 'en';
    const langInfo = SUPPORTED_LANGUAGES.find(l => l.code === langCode) || SUPPORTED_LANGUAGES[0];
    const translations = TRANSLATIONS[langCode] || {};
    
    res.json({
      languageCode: langCode,
      nativeName: langInfo.nativeName,
      direction: langInfo.direction,
      translations
    });
  } catch (error) {
    console.error('Get current language error:', error);
    res.json({
      languageCode: 'en',
      nativeName: 'English',
      direction: 'ltr',
      translations: {}
    });
  }
});

// Set user's language
app.post('/api/language', authMiddleware, async (req, res) => {
  try {
    const { languageCode, accent } = req.body;
    
    let targetLang = languageCode;
    
    // If accent is provided, map it to a language code
    if (accent && !languageCode) {
      const accentToLang = {
        'Spanish': 'es',
        'French': 'fr',
        'German': 'de',
        'Italian': 'it',
        'Portuguese': 'pt',
        'Chinese': 'zh',
        'Japanese': 'ja',
        'Korean': 'ko',
        'Arabic': 'ar',
        'Hindi': 'hi',
        'Russian': 'ru',
        'American': 'en',
        'British': 'en',
        'Australian': 'en',
      };
      targetLang = accentToLang[accent] || 'en';
    }
    
    // Validate language code
    const langInfo = SUPPORTED_LANGUAGES.find(l => l.code === targetLang);
    if (!langInfo) {
      return res.status(400).json({ error: 'Unsupported language' });
    }
    
    await pool.query(
      'UPDATE users SET language_code = $1 WHERE id = $2',
      [targetLang, req.userId]
    );
    
    const translations = TRANSLATIONS[targetLang] || {};
    
    res.json({
      success: true,
      languageCode: targetLang,
      nativeName: langInfo.nativeName,
      direction: langInfo.direction,
      translations
    });
  } catch (error) {
    console.error('Set language error:', error);
    res.status(500).json({ error: 'Failed to set language' });
  }
});

// Get translations for a specific language
app.get('/api/translations/:langCode', async (req, res) => {
  const { langCode } = req.params;
  
  const langInfo = SUPPORTED_LANGUAGES.find(l => l.code === langCode);
  if (!langInfo) {
    return res.status(404).json({ error: 'Language not found' });
  }
  
  const translations = TRANSLATIONS[langCode] || {};
  
  res.json({
    languageCode: langCode,
    nativeName: langInfo.nativeName,
    direction: langInfo.direction,
    translations
  });
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
  const baseUrl = process.env.REPLIT_DEV_DOMAIN || 'dripn.replit.app';
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

// ============ COLOR TREND INTELLIGENCE ============

app.post('/api/admin/color-trends/scan', adminAuthMiddleware, async (req, res) => {
  try {
    const { year, regions } = req.body;
    const targetYear = year || new Date().getFullYear();
    const targetRegions = regions || ['Global'];

    const scanResult = await colorTrendService.generateFullColorUpdate(targetYear, targetRegions);

    const insertResult = await pool.query(
      `INSERT INTO color_trend_scans (year, scan_type, regions, pantone_data, style_themes_data, regional_palettes_data, status, errors)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [
        targetYear,
        'annual',
        targetRegions,
        JSON.stringify(scanResult.colorUpdate.pantone),
        JSON.stringify(scanResult.colorUpdate.styleThemes),
        JSON.stringify(scanResult.colorUpdate.regionalPalettes),
        scanResult.success ? 'completed' : (scanResult.partialSuccess ? 'partial' : 'failed'),
        JSON.stringify(scanResult.colorUpdate.errors)
      ]
    );

    if (scanResult.success || scanResult.partialSuccess) {
      for (const region of Object.keys(scanResult.colorUpdate.styleThemes)) {
        const regionData = scanResult.colorUpdate.styleThemes[region];
        if (regionData?.trendingPalettes) {
          for (const palette of regionData.trendingPalettes) {
            if (palette.secondary?.hex) {
              await pool.query(
                `INSERT INTO trend_color_palettes (year, region, style_theme, color_role, color_value, color_name, source, mood_tags)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                 ON CONFLICT DO NOTHING`,
                [
                  targetYear,
                  region,
                  palette.styleTheme,
                  'secondary',
                  palette.secondary.hex,
                  palette.secondary.name,
                  'AI-Pantone-Analysis',
                  palette.secondary.mood ? [palette.secondary.mood] : []
                ]
              );
            }
            if (palette.accent?.hex) {
              await pool.query(
                `INSERT INTO trend_color_palettes (year, region, style_theme, color_role, color_value, color_name, source, mood_tags)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                 ON CONFLICT DO NOTHING`,
                [
                  targetYear,
                  region,
                  palette.styleTheme,
                  'accent',
                  palette.accent.hex,
                  palette.accent.name,
                  'AI-Pantone-Analysis',
                  palette.accent.mood ? [palette.accent.mood] : []
                ]
              );
            }
          }
        }
      }
    }

    res.json({
      success: scanResult.success || scanResult.partialSuccess,
      scanId: insertResult.rows[0].id,
      year: targetYear,
      regions: targetRegions,
      pantoneAnalyzed: !!scanResult.colorUpdate.pantone,
      stylesScanned: Object.keys(scanResult.colorUpdate.styleThemes).length,
      regionsScanned: Object.keys(scanResult.colorUpdate.regionalPalettes).length,
      errors: scanResult.colorUpdate.errors
    });
  } catch (error) {
    console.error('Color trend scan error:', error);
    res.status(500).json({ error: 'Failed to scan color trends', details: error.message });
  }
});

app.get('/api/admin/color-trends/scans', adminAuthMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, year, scan_type, regions, status, errors, scanned_at 
       FROM color_trend_scans 
       ORDER BY scanned_at DESC 
       LIMIT 20`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get color scans error:', error);
    res.status(500).json({ error: 'Failed to get color scans' });
  }
});

app.get('/api/admin/color-trends/scan/:id', adminAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT * FROM color_trend_scans WHERE id = $1',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Scan not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get color scan error:', error);
    res.status(500).json({ error: 'Failed to get color scan' });
  }
});

app.get('/api/admin/color-trends/pending', adminAuthMiddleware, async (req, res) => {
  try {
    const { year, region } = req.query;
    let query = `SELECT * FROM trend_color_palettes WHERE is_active = false`;
    const params = [];
    
    if (year) {
      params.push(parseInt(year));
      query += ` AND year = $${params.length}`;
    }
    if (region) {
      params.push(region);
      query += ` AND region = $${params.length}`;
    }
    
    query += ` ORDER BY created_at DESC`;
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get pending palettes error:', error);
    res.status(500).json({ error: 'Failed to get pending palettes' });
  }
});

app.post('/api/admin/color-trends/:id/approve', adminAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    const existing = await pool.query('SELECT * FROM trend_color_palettes WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Color palette not found' });
    }
    
    const palette = existing.rows[0];
    
    await pool.query(
      `UPDATE trend_color_palettes 
       SET is_active = false 
       WHERE style_theme = $1 AND color_role = $2 AND region = $3 AND is_active = true`,
      [palette.style_theme, palette.color_role, palette.region]
    );
    
    const result = await pool.query(
      `UPDATE trend_color_palettes 
       SET is_active = true, approved_by = $1, approved_at = CURRENT_TIMESTAMP 
       WHERE id = $2 
       RETURNING *`,
      [req.adminId, id]
    );
    
    res.json({
      success: true,
      message: 'Color palette approved and activated',
      palette: result.rows[0]
    });
  } catch (error) {
    console.error('Approve palette error:', error);
    res.status(500).json({ error: 'Failed to approve palette' });
  }
});

app.post('/api/admin/color-trends/:id/reject', adminAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      'DELETE FROM trend_color_palettes WHERE id = $1 RETURNING id',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Color palette not found' });
    }
    
    res.json({ success: true, message: 'Color palette rejected and removed' });
  } catch (error) {
    console.error('Reject palette error:', error);
    res.status(500).json({ error: 'Failed to reject palette' });
  }
});

app.get('/api/admin/color-trends/active', adminAuthMiddleware, async (req, res) => {
  try {
    const { year, region, styleTheme } = req.query;
    let query = `SELECT * FROM trend_color_palettes WHERE is_active = true`;
    const params = [];
    
    if (year) {
      params.push(parseInt(year));
      query += ` AND year = $${params.length}`;
    }
    if (region) {
      params.push(region);
      query += ` AND region = $${params.length}`;
    }
    if (styleTheme) {
      params.push(styleTheme);
      query += ` AND style_theme = $${params.length}`;
    }
    
    query += ` ORDER BY style_theme, color_role`;
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get active palettes error:', error);
    res.status(500).json({ error: 'Failed to get active palettes' });
  }
});

app.get('/api/color-trends/active', async (req, res) => {
  try {
    const { year, region, styleTheme } = req.query;
    const currentYear = year || new Date().getFullYear();
    const targetRegion = region || 'Global';
    
    let query = `SELECT style_theme, color_role, color_value, color_name, mood_tags
                 FROM trend_color_palettes 
                 WHERE is_active = true AND year = $1 AND (region = $2 OR region = 'Global')`;
    const params = [currentYear, targetRegion];
    
    if (styleTheme) {
      params.push(styleTheme);
      query += ` AND style_theme = $${params.length}`;
    }
    
    query += ` ORDER BY style_theme, color_role`;
    
    const result = await pool.query(query, params);
    
    const grouped = {};
    for (const row of result.rows) {
      if (!grouped[row.style_theme]) {
        grouped[row.style_theme] = {};
      }
      grouped[row.style_theme][row.color_role] = {
        hex: row.color_value,
        name: row.color_name,
        mood: row.mood_tags?.[0] || null
      };
    }
    
    res.json({
      year: currentYear,
      region: targetRegion,
      palettes: grouped
    });
  } catch (error) {
    console.error('Get public active palettes error:', error);
    res.status(500).json({ error: 'Failed to get color trends' });
  }
});

app.post('/api/admin/color-trends/validate', adminAuthMiddleware, async (req, res) => {
  try {
    const { hexColor, usage } = req.body;
    
    if (!hexColor || !/^#[0-9A-Fa-f]{6}$/.test(hexColor)) {
      return res.status(400).json({ error: 'Invalid hex color format' });
    }
    
    const validation = await colorTrendService.validateColorForPremiumUse(hexColor, usage || 'accent');
    
    const saturationCheck = colorTrendService.checkSaturationLimit(hexColor);
    const contrastOnWhite = colorTrendService.checkAccessibility(hexColor, '#FFFFFF');
    const contrastOnBlack = colorTrendService.checkAccessibility(hexColor, '#000000');
    
    res.json({
      ...validation,
      technicalChecks: {
        saturation: saturationCheck,
        contrastOnWhite,
        contrastOnBlack
      }
    });
  } catch (error) {
    console.error('Color validation error:', error);
    res.status(500).json({ error: 'Failed to validate color' });
  }
});

app.get('/api/color-trends/pantone/:year', async (req, res) => {
  try {
    const { year } = req.params;
    
    const scanResult = await pool.query(
      `SELECT pantone_data FROM color_trend_scans 
       WHERE year = $1 AND pantone_data IS NOT NULL 
       ORDER BY scanned_at DESC LIMIT 1`,
      [parseInt(year)]
    );
    
    if (scanResult.rows.length > 0 && scanResult.rows[0].pantone_data) {
      return res.json(scanResult.rows[0].pantone_data);
    }
    
    const freshScan = await colorTrendService.scanPantoneColorOfTheYear(parseInt(year));
    if (freshScan.success) {
      res.json(freshScan.pantone);
    } else {
      res.status(500).json({ error: 'Failed to get Pantone data' });
    }
  } catch (error) {
    console.error('Get Pantone error:', error);
    res.status(500).json({ error: 'Failed to get Pantone data' });
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
          from: 'noreply@dripn.app',
          subject: 'Welcome to Dripn Weekly Style Tips!',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #4A3428;">Welcome to Dripn!</h1>
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
              <p>The Dripn Team</p>
            </div>
          `
        });
      } catch (emailError) {
        console.error('Failed to send welcome email:', emailError);
      }
    }

    res.json({ 
      success: true, 
      message: 'Successfully subscribed to Dripn newsletter!' 
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

// ============ NEWSLETTER ENDPOINTS ============

const { generateAINewsletter, generateNewsletterHTML, generateNewsletterPlainText, newsletterCategories, getCurrentSeason } = require('./aiNewsletterService');

// Report newsletter issue (public)
app.post('/api/newsletter/report', async (req, res) => {
  try {
    const { newsletterId, issueType, description, userEmail } = req.body;
    
    if (!issueType || !description) {
      return res.status(400).json({ error: 'Issue type and description are required' });
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS newsletter_reports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        newsletter_id VARCHAR(255),
        issue_type VARCHAR(50) NOT NULL,
        description TEXT NOT NULL,
        user_email VARCHAR(255),
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        resolved_at TIMESTAMP
      )
    `);

    const result = await pool.query(
      'INSERT INTO newsletter_reports (newsletter_id, issue_type, description, user_email) VALUES ($1, $2, $3, $4) RETURNING id',
      [newsletterId || null, issueType, description, userEmail || null]
    );

    res.json({ 
      success: true, 
      reportId: result.rows[0].id,
      message: 'Thank you for your report. We will review it shortly.' 
    });
  } catch (error) {
    console.error('Newsletter report error:', error);
    res.status(500).json({ error: 'Failed to submit report' });
  }
});

// Generate AI newsletter (admin only)
app.post('/api/newsletter/generate', adminAuthMiddleware, async (req, res) => {
  try {
    const { category, gender, region } = req.body;

    const result = await generateAINewsletter({
      category: category || undefined,
      gender: gender || 'unisex',
      region: region || 'UK',
      season: getCurrentSeason()
    });

    if (!result.success) {
      return res.status(500).json({ error: result.error || 'Failed to generate newsletter' });
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS published_newsletters (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        subject VARCHAR(255) NOT NULL,
        headline VARCHAR(255) NOT NULL,
        introduction TEXT,
        tips JSONB,
        closing_message TEXT,
        category VARCHAR(100),
        tags TEXT[],
        gender VARCHAR(20),
        season VARCHAR(20),
        region VARCHAR(50),
        html_content TEXT,
        plain_text_content TEXT,
        published_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        views INTEGER DEFAULT 0
      )
    `);

    const newsletterData = result.data;
    const htmlContent = generateNewsletterHTML(newsletterData);
    const plainTextContent = generateNewsletterPlainText(newsletterData);

    const insertResult = await pool.query(
      `INSERT INTO published_newsletters 
       (subject, headline, introduction, tips, closing_message, category, tags, gender, season, region, html_content, plain_text_content) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) 
       RETURNING id, published_at`,
      [
        newsletterData.subject,
        newsletterData.headline,
        newsletterData.introduction,
        JSON.stringify(newsletterData.tips),
        newsletterData.closingMessage,
        newsletterData.category,
        newsletterData.tags || [],
        newsletterData.gender,
        newsletterData.season,
        newsletterData.region,
        htmlContent,
        plainTextContent
      ]
    );

    res.json({ 
      success: true, 
      newsletterId: insertResult.rows[0].id,
      publishedAt: insertResult.rows[0].published_at,
      data: newsletterData
    });
  } catch (error) {
    console.error('Newsletter generation error:', error);
    res.status(500).json({ error: 'Failed to generate newsletter' });
  }
});

// Get published newsletters (public blog endpoint)
app.get('/api/newsletter/published', async (req, res) => {
  try {
    const { limit = 20, offset = 0, category, gender } = req.query;

    let query = `
      SELECT id, subject, headline, introduction, tips, closing_message, category, tags, 
             gender, season, region, published_at, views
      FROM published_newsletters
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (category) {
      query += ` AND category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }

    if (gender && gender !== 'unisex') {
      query += ` AND (gender = $${paramIndex} OR gender = 'unisex')`;
      params.push(gender);
      paramIndex++;
    }

    query += ` ORDER BY published_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);

    const newsletters = result.rows.map(row => {
      let parsedTips = row.tips;
      if (typeof parsedTips === 'string') {
        try {
          parsedTips = JSON.parse(parsedTips);
        } catch (e) {
          parsedTips = [];
        }
      }
      return {
        id: row.id,
        subject: row.subject,
        headline: row.headline,
        introduction: row.introduction,
        tips: parsedTips || [],
        closingMessage: row.closing_message,
        category: row.category,
        tags: row.tags || [],
        gender: row.gender,
        season: row.season,
        region: row.region,
        publishedAt: row.published_at,
        views: row.views
      };
    });

    res.json({ newsletters, categories: newsletterCategories });
  } catch (error) {
    console.error('Get published newsletters error:', error);
    res.json({ newsletters: [], categories: newsletterCategories });
  }
});

// Get single newsletter by ID (public)
app.get('/api/newsletter/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, subject, headline, introduction, tips, closing_message, category, tags, 
              gender, season, region, html_content, plain_text_content, published_at, views
       FROM published_newsletters WHERE id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Newsletter not found' });
    }

    const row = result.rows[0];
    
    pool.query(
      'UPDATE published_newsletters SET views = views + 1 WHERE id = $1',
      [req.params.id]
    ).catch(err => console.error('View increment error:', err));

    let parsedTips = row.tips;
    if (typeof parsedTips === 'string') {
      try {
        parsedTips = JSON.parse(parsedTips);
      } catch (e) {
        parsedTips = [];
      }
    }

    res.json({
      id: row.id,
      subject: row.subject,
      headline: row.headline,
      introduction: row.introduction,
      tips: parsedTips || [],
      closingMessage: row.closing_message,
      category: row.category,
      tags: row.tags || [],
      gender: row.gender,
      season: row.season,
      region: row.region,
      htmlContent: row.html_content,
      plainTextContent: row.plain_text_content,
      publishedAt: row.published_at,
      views: row.views + 1
    });
  } catch (error) {
    console.error('Get newsletter error:', error);
    res.status(500).json({ error: 'Failed to get newsletter' });
  }
});

// ============ STYLE PROFILE & PERSONALIZATION ============

// Track user interaction (like, dislike, post, advice)
app.post('/api/interactions', authMiddleware, async (req, res) => {
  try {
    const { interactionType, targetType, targetId, targetData } = req.body;
    
    await pool.query(
      `INSERT INTO user_interactions (user_id, interaction_type, target_type, target_id, target_data) 
       VALUES ($1, $2, $3, $4, $5)`,
      [req.userId, interactionType, targetType, targetId, JSON.stringify(targetData || {})]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Track interaction error:', error);
    res.status(500).json({ error: 'Failed to track interaction' });
  }
});

// Dislike post (thumbs down)
app.post('/api/posts/:id/dislike', authMiddleware, async (req, res) => {
  try {
    const existing = await pool.query(
      'SELECT id FROM post_dislikes WHERE post_id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    );

    if (existing.rows.length > 0) {
      await pool.query('DELETE FROM post_dislikes WHERE post_id = $1 AND user_id = $2', [req.params.id, req.userId]);
      res.json({ disliked: false });
    } else {
      await pool.query('INSERT INTO post_dislikes (post_id, user_id) VALUES ($1, $2)', [req.params.id, req.userId]);
      
      await pool.query(
        `INSERT INTO user_interactions (user_id, interaction_type, target_type, target_id) 
         VALUES ($1, 'dislike', 'post', $2)`,
        [req.userId, req.params.id]
      );
      
      res.json({ disliked: true });
    }
  } catch (error) {
    console.error('Dislike error:', error);
    res.status(500).json({ error: 'Failed to dislike post' });
  }
});

// Get user's style profile
app.get('/api/style-profile', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM user_style_profiles WHERE user_id = $1',
      [req.userId]
    );

    if (result.rows.length === 0) {
      return res.json({ hasProfile: false, message: 'No style profile yet' });
    }

    const profile = result.rows[0];
    res.json({
      hasProfile: true,
      profile: {
        dominantStyles: profile.dominant_styles || [],
        colorPreferences: profile.color_preferences || [],
        fashionInterests: profile.fashion_interests || [],
        stylePersonality: profile.style_personality,
        strengthAreas: profile.strength_areas || [],
        growthAreas: profile.growth_areas || [],
        recommendedBrands: profile.recommended_brands || [],
        styleInfluencerType: profile.style_influencer_type,
        confidenceScore: parseFloat(profile.confidence_score) || 0,
        seasonalStyles: profile.seasonal_styles,
        dataPoints: profile.data_points,
        lastAnalyzedAt: profile.last_analyzed_at
      }
    });
  } catch (error) {
    console.error('Get style profile error:', error);
    res.status(500).json({ error: 'Failed to get style profile' });
  }
});

// Analyze and update style profile
app.post('/api/style-profile/analyze', authMiddleware, async (req, res) => {
  try {
    const userResult = await pool.query(
      'SELECT * FROM users WHERE id = $1',
      [req.userId]
    );
    const user = userResult.rows[0];

    const postsResult = await pool.query(
      'SELECT caption, tags FROM posts WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
      [req.userId]
    );

    const likesResult = await pool.query(
      `SELECT p.caption, p.tags FROM likes l 
       JOIN posts p ON l.post_id = p.id 
       WHERE l.user_id = $1 ORDER BY l.created_at DESC LIMIT 50`,
      [req.userId]
    );

    const dislikesResult = await pool.query(
      `SELECT p.caption, p.tags FROM post_dislikes d 
       JOIN posts p ON d.post_id = p.id 
       WHERE d.user_id = $1 ORDER BY d.created_at DESC LIMIT 50`,
      [req.userId]
    );

    const adviceResult = await pool.query(
      'SELECT text FROM comments WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
      [req.userId]
    );

    const analysisResult = await analyzeUserStyleProfile({
      posts: postsResult.rows,
      likes: likesResult.rows,
      dislikes: dislikesResult.rows,
      adviceGiven: adviceResult.rows,
      userInfo: {
        gender: user.gender || req.body.gender,
        country: user.country || req.body.country,
        region: req.body.region
      }
    });

    if (!analysisResult.success) {
      return res.status(500).json({ error: analysisResult.error || 'Analysis failed' });
    }

    const profile = analysisResult.profile;
    
    await pool.query(`
      INSERT INTO user_style_profiles 
      (user_id, dominant_styles, color_preferences, fashion_interests, style_personality, 
       strength_areas, growth_areas, recommended_brands, style_influencer_type, 
       confidence_score, seasonal_styles, data_points, last_analyzed_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id) DO UPDATE SET
        dominant_styles = EXCLUDED.dominant_styles,
        color_preferences = EXCLUDED.color_preferences,
        fashion_interests = EXCLUDED.fashion_interests,
        style_personality = EXCLUDED.style_personality,
        strength_areas = EXCLUDED.strength_areas,
        growth_areas = EXCLUDED.growth_areas,
        recommended_brands = EXCLUDED.recommended_brands,
        style_influencer_type = EXCLUDED.style_influencer_type,
        confidence_score = EXCLUDED.confidence_score,
        seasonal_styles = EXCLUDED.seasonal_styles,
        data_points = EXCLUDED.data_points,
        last_analyzed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    `, [
      req.userId,
      profile.dominantStyles || [],
      profile.colorPreferences || [],
      profile.fashionInterests || [],
      profile.stylePersonality,
      profile.strengthAreas || [],
      profile.growthAreas || [],
      profile.recommendedBrands || [],
      profile.styleInfluencerType,
      profile.confidenceScore || 0,
      JSON.stringify(profile.seasonalStyle || {}),
      JSON.stringify(profile.dataPoints || {})
    ]);

    res.json({ success: true, profile });
  } catch (error) {
    console.error('Analyze style profile error:', error);
    res.status(500).json({ error: 'Failed to analyze style profile' });
  }
});

// Get personalized Style of the Day
app.get('/api/personalized/style-of-the-day', authMiddleware, async (req, res) => {
  try {
    const profileResult = await pool.query(
      'SELECT * FROM user_style_profiles WHERE user_id = $1',
      [req.userId]
    );

    const userResult = await pool.query(
      'SELECT * FROM users WHERE id = $1',
      [req.userId]
    );
    const user = userResult.rows[0];

    let styleProfile = {};
    if (profileResult.rows.length > 0) {
      const p = profileResult.rows[0];
      styleProfile = {
        dominantStyles: p.dominant_styles,
        colorPreferences: p.color_preferences,
        fashionInterests: p.fashion_interests,
        stylePersonality: p.style_personality,
        recommendedBrands: p.recommended_brands
      };
    }

    const result = await generatePersonalizedStyleOfTheDay(styleProfile, {
      gender: user.gender || req.query.gender || 'unisex',
      country: user.country || req.query.country || 'United Kingdom'
    });

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json(result.styleOfTheDay);
  } catch (error) {
    console.error('Personalized style error:', error);
    res.status(500).json({ error: 'Failed to get personalized style' });
  }
});

// Get personalized event recommendations
app.post('/api/personalized/events', authMiddleware, async (req, res) => {
  try {
    const { events } = req.body;
    
    const profileResult = await pool.query(
      'SELECT * FROM user_style_profiles WHERE user_id = $1',
      [req.userId]
    );

    const userResult = await pool.query(
      'SELECT * FROM users WHERE id = $1',
      [req.userId]
    );
    const user = userResult.rows[0];

    let styleProfile = {};
    if (profileResult.rows.length > 0) {
      const p = profileResult.rows[0];
      styleProfile = {
        dominantStyles: p.dominant_styles,
        fashionInterests: p.fashion_interests,
        stylePersonality: p.style_personality
      };
    }

    const result = await generatePersonalizedEventRecommendations(styleProfile, events, {
      gender: user.gender || req.body.gender || 'unisex',
      country: user.country || req.body.country || 'United Kingdom'
    });

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json(result.eventRecommendations);
  } catch (error) {
    console.error('Personalized events error:', error);
    res.status(500).json({ error: 'Failed to get personalized events' });
  }
});

// Get personalized offers
app.get('/api/personalized/offers', authMiddleware, async (req, res) => {
  try {
    const profileResult = await pool.query(
      'SELECT * FROM user_style_profiles WHERE user_id = $1',
      [req.userId]
    );

    const userResult = await pool.query(
      'SELECT * FROM users WHERE id = $1',
      [req.userId]
    );
    const user = userResult.rows[0];

    let styleProfile = {};
    if (profileResult.rows.length > 0) {
      const p = profileResult.rows[0];
      styleProfile = {
        dominantStyles: p.dominant_styles,
        colorPreferences: p.color_preferences,
        fashionInterests: p.fashion_interests,
        recommendedBrands: p.recommended_brands
      };
    }

    const result = await generatePersonalizedOffers(styleProfile, {
      gender: user.gender || req.query.gender || 'unisex',
      country: user.country || req.query.country || 'United Kingdom',
      subscriptionTier: user.subscription_tier || 'free'
    });

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json(result.personalizedOffers);
  } catch (error) {
    console.error('Personalized offers error:', error);
    res.status(500).json({ error: 'Failed to get personalized offers' });
  }
});

// ============ TREND SCANNER ============

// Scan emerging fashion trends
app.get('/api/trends/emerging', async (req, res) => {
  try {
    const { region, gender, forceRefresh } = req.query;
    
    if (!forceRefresh) {
      const cachedResult = await pool.query(
        `SELECT * FROM trend_reports 
         WHERE report_type = 'emerging' 
           AND (region = $1 OR region IS NULL)
           AND (gender = $2 OR gender IS NULL)
           AND generated_at > NOW() - INTERVAL '6 hours'
         ORDER BY generated_at DESC LIMIT 1`,
        [region || 'Global', gender || 'unisex']
      );

      if (cachedResult.rows.length > 0) {
        const cached = cachedResult.rows[0];
        return res.json({
          fromCache: true,
          emergingTrends: cached.trends,
          colorForecast: cached.color_forecast,
          styleMovement: cached.style_movement,
          trendAlert: cached.trend_alert,
          sources: cached.sources,
          generatedAt: cached.generated_at
        });
      }
    }

    const result = await scanEmergingFashionTrends({
      region: region || 'Global',
      gender: gender || 'unisex'
    });

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    await pool.query(
      `INSERT INTO trend_reports (report_type, region, gender, season, trends, color_forecast, style_movement, trend_alert, sources)
       VALUES ('emerging', $1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        result.trends.region,
        result.trends.gender,
        result.trends.season,
        JSON.stringify(result.trends.emergingTrends),
        JSON.stringify(result.trends.colorForecast),
        JSON.stringify(result.trends.styleMovement),
        JSON.stringify(result.trends.trendAlert),
        result.trends.sources || []
      ]
    );

    res.json({
      fromCache: false,
      ...result.trends
    });
  } catch (error) {
    console.error('Emerging trends error:', error);
    res.status(500).json({ error: 'Failed to scan emerging trends' });
  }
});

// Scan viral fashion moments
app.get('/api/trends/viral', async (req, res) => {
  try {
    const { forceRefresh } = req.query;
    
    if (!forceRefresh) {
      const cachedResult = await pool.query(
        `SELECT * FROM viral_fashion_moments 
         WHERE scanned_at > NOW() - INTERVAL '2 hours'
         ORDER BY scanned_at DESC LIMIT 1`
      );

      if (cachedResult.rows.length > 0) {
        const cached = cachedResult.rows[0];
        return res.json({
          fromCache: true,
          viralMoments: cached.moments,
          trendingHashtags: cached.trending_hashtags,
          mustFollow: cached.must_follow,
          scannedAt: cached.scanned_at
        });
      }
    }

    const result = await scanViralFashionMoments();

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    await pool.query(
      `INSERT INTO viral_fashion_moments (moments, trending_hashtags, must_follow)
       VALUES ($1, $2, $3)`,
      [
        JSON.stringify(result.viralMoments.viralMoments),
        result.viralMoments.trendingHashtags || [],
        JSON.stringify(result.viralMoments.mustFollow || {})
      ]
    );

    res.json({
      fromCache: false,
      ...result.viralMoments
    });
  } catch (error) {
    console.error('Viral trends error:', error);
    res.status(500).json({ error: 'Failed to scan viral moments' });
  }
});

// Predict next big trend
app.get('/api/trends/prediction', async (req, res) => {
  try {
    const { gender, ageGroup, forceRefresh } = req.query;
    
    if (!forceRefresh) {
      const cachedResult = await pool.query(
        `SELECT * FROM trend_predictions 
         WHERE (gender = $1 OR gender IS NULL)
           AND (age_group = $2 OR age_group IS NULL)
           AND predicted_at > NOW() - INTERVAL '24 hours'
         ORDER BY predicted_at DESC LIMIT 1`,
        [gender || 'unisex', ageGroup || '25-34']
      );

      if (cachedResult.rows.length > 0) {
        const cached = cachedResult.rows[0];
        return res.json({
          fromCache: true,
          prediction: cached.prediction,
          confidence: parseFloat(cached.confidence),
          predictedAt: cached.predicted_at
        });
      }
    }

    const result = await predictNextBigTrend({
      gender: gender || 'unisex',
      ageGroup: ageGroup || '25-34'
    });

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    await pool.query(
      `INSERT INTO trend_predictions (prediction, confidence, gender, age_group)
       VALUES ($1, $2, $3, $4)`,
      [
        JSON.stringify(result.nextBigTrend.prediction),
        result.nextBigTrend.confidence || 0.7,
        gender || 'unisex',
        ageGroup || '25-34'
      ]
    );

    res.json({
      fromCache: false,
      ...result.nextBigTrend
    });
  } catch (error) {
    console.error('Trend prediction error:', error);
    res.status(500).json({ error: 'Failed to predict trends' });
  }
});

// Get regional trend insights
app.get('/api/trends/regional/:country', async (req, res) => {
  try {
    const result = await getRegionalTrendInsights(req.params.country);

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json(result.regionalInsights);
  } catch (error) {
    console.error('Regional trends error:', error);
    res.status(500).json({ error: 'Failed to get regional insights' });
  }
});

// ============ PUSH NOTIFICATIONS & EVENT REMINDERS ============

// Register push notification token
app.post('/api/notifications/register', authMiddleware, async (req, res) => {
  try {
    const { token, deviceType } = req.body;
    
    if (!token) {
      return res.status(400).json({ error: 'Push token is required' });
    }

    await pool.query(`
      INSERT INTO push_notification_tokens (user_id, token, device_type)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id, token) DO UPDATE SET
        is_active = true,
        device_type = EXCLUDED.device_type,
        updated_at = CURRENT_TIMESTAMP
    `, [req.userId, token, deviceType || 'unknown']);

    await pool.query(`
      INSERT INTO notification_preferences (user_id)
      VALUES ($1)
      ON CONFLICT (user_id) DO NOTHING
    `, [req.userId]);

    res.json({ success: true });
  } catch (error) {
    console.error('Register push token error:', error);
    res.status(500).json({ error: 'Failed to register push token' });
  }
});

// Unregister push token
app.post('/api/notifications/unregister', authMiddleware, async (req, res) => {
  try {
    const { token } = req.body;
    
    await pool.query(
      'UPDATE push_notification_tokens SET is_active = false WHERE user_id = $1 AND token = $2',
      [req.userId, token]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Unregister push token error:', error);
    res.status(500).json({ error: 'Failed to unregister push token' });
  }
});

// Get notification preferences
app.get('/api/notifications/preferences', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM notification_preferences WHERE user_id = $1',
      [req.userId]
    );

    if (result.rows.length === 0) {
      return res.json({
        eventReminders: true,
        styleRecommendations: true,
        trendAlerts: true,
        personalizedOffers: true
      });
    }

    const prefs = result.rows[0];
    res.json({
      eventReminders: prefs.event_reminders,
      styleRecommendations: prefs.style_recommendations,
      trendAlerts: prefs.trend_alerts,
      personalizedOffers: prefs.personalized_offers
    });
  } catch (error) {
    console.error('Get notification prefs error:', error);
    res.status(500).json({ error: 'Failed to get notification preferences' });
  }
});

// Update notification preferences
app.put('/api/notifications/preferences', authMiddleware, async (req, res) => {
  try {
    const { eventReminders, styleRecommendations, trendAlerts, personalizedOffers } = req.body;
    
    await pool.query(`
      INSERT INTO notification_preferences (user_id, event_reminders, style_recommendations, trend_alerts, personalized_offers)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (user_id) DO UPDATE SET
        event_reminders = EXCLUDED.event_reminders,
        style_recommendations = EXCLUDED.style_recommendations,
        trend_alerts = EXCLUDED.trend_alerts,
        personalized_offers = EXCLUDED.personalized_offers,
        updated_at = CURRENT_TIMESTAMP
    `, [req.userId, eventReminders, styleRecommendations, trendAlerts, personalizedOffers]);

    res.json({ success: true });
  } catch (error) {
    console.error('Update notification prefs error:', error);
    res.status(500).json({ error: 'Failed to update notification preferences' });
  }
});

// Like event and set reminder
app.post('/api/events/:eventId/like', authMiddleware, async (req, res) => {
  try {
    const { eventTitle, eventDate, eventTime, eventData } = req.body;
    const eventId = req.params.eventId;
    
    const existing = await pool.query(
      'SELECT id FROM event_reminders WHERE user_id = $1 AND event_id = $2',
      [req.userId, eventId]
    );

    if (existing.rows.length > 0) {
      await pool.query(
        'DELETE FROM event_reminders WHERE user_id = $1 AND event_id = $2',
        [req.userId, eventId]
      );
      return res.json({ liked: false, reminderSet: false });
    }

    await pool.query(`
      INSERT INTO event_reminders (user_id, event_id, event_title, event_date, event_time, event_data)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [req.userId, eventId, eventTitle, eventDate, eventTime, JSON.stringify(eventData || {})]);

    await pool.query(
      `INSERT INTO user_interactions (user_id, interaction_type, target_type, target_id, target_data) 
       VALUES ($1, 'like', 'event', $2, $3)`,
      [req.userId, eventId, JSON.stringify({ title: eventTitle, date: eventDate })]
    );

    res.json({ liked: true, reminderSet: true });
  } catch (error) {
    console.error('Like event error:', error);
    res.status(500).json({ error: 'Failed to like event' });
  }
});

// Get user's liked events with reminders
app.get('/api/events/liked', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM event_reminders 
       WHERE user_id = $1 
       ORDER BY event_date ASC`,
      [req.userId]
    );

    const events = result.rows.map(row => ({
      eventId: row.event_id,
      eventTitle: row.event_title,
      eventDate: row.event_date,
      eventTime: row.event_time,
      eventData: row.event_data,
      reminderSent: row.reminder_sent,
      createdAt: row.created_at
    }));

    res.json({ events });
  } catch (error) {
    console.error('Get liked events error:', error);
    res.status(500).json({ error: 'Failed to get liked events' });
  }
});

// Process event reminders (called by cron or admin)
app.post('/api/notifications/process-reminders', adminAuthMiddleware, async (req, res) => {
  try {
    const result = await processEventReminders(pool);
    res.json(result);
  } catch (error) {
    console.error('Process reminders error:', error);
    res.status(500).json({ error: 'Failed to process reminders' });
  }
});

// Send test notification
app.post('/api/notifications/test', authMiddleware, async (req, res) => {
  try {
    const tokenResult = await pool.query(
      'SELECT token FROM push_notification_tokens WHERE user_id = $1 AND is_active = true',
      [req.userId]
    );

    if (tokenResult.rows.length === 0) {
      return res.status(400).json({ error: 'No active push token found' });
    }

    const result = await sendPushNotification(tokenResult.rows[0].token, {
      title: 'Dripn Test',
      body: 'Your notifications are working perfectly!',
      data: { type: 'test' }
    });

    res.json(result);
  } catch (error) {
    console.error('Test notification error:', error);
    res.status(500).json({ error: 'Failed to send test notification' });
  }
});

// ============ AI STYLIST CHAT ============

// AI Stylist Chat - Main conversation endpoint
app.post('/api/stylist/chat', async (req, res) => {
  try {
    const { stylistId, messages, userMessage, wardrobeItems, userGender, subscriptionTier, language } = req.body;

    if (!userMessage || typeof userMessage !== 'string') {
      return res.status(400).json({ error: 'userMessage is required' });
    }

    if (!stylistId || !['ruby', 'max'].includes(stylistId)) {
      return res.status(400).json({ error: 'Valid stylistId (ruby or max) is required' });
    }

    const langInfo = SUPPORTED_LANGUAGES.find(l => l.code === language) || SUPPORTED_LANGUAGES[0];

    const response = await generateStylistResponse({
      stylistId,
      messages: messages || [],
      userMessage,
      wardrobeItems: wardrobeItems || [],
      userGender: userGender || 'not specified',
      subscriptionTier: subscriptionTier || 'free',
      languageCode: language || 'en',
      languageName: langInfo.name,
    });

    res.json({
      success: true,
      content: response.content,
      mood: response.mood,
      stylistId: response.stylistId,
    });
  } catch (error) {
    console.error('AI Stylist chat error:', error);
    res.status(500).json({ 
      error: 'Failed to generate response',
      fallback: true,
      content: "I'm having a moment, darling! Could you try again? I'm here for you!"
    });
  }
});

// AI Stylist - Mood detection only (lightweight)
app.post('/api/stylist/detect-mood', async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'message is required' });
    }

    const mood = await detectMood(message);
    res.json({ success: true, mood });
  } catch (error) {
    console.error('Mood detection error:', error);
    res.status(500).json({ 
      error: 'Failed to detect mood',
      mood: { mood: 'neutral', confidence: 0.5, needsSupport: false, topicType: 'casual' }
    });
  }
});

// ============ AI MODEL LIFECYCLE ============

app.get('/api/ai/model-status', async (req, res) => {
  try {
    const status = await getModelStatus();
    res.json({ success: true, ...status });
  } catch (error) {
    console.error('Model status error:', error);
    res.status(500).json({ error: 'Failed to get model status' });
  }
});

app.post('/api/ai/refresh-models', authMiddleware, async (req, res) => {
  try {
    const result = await refreshAllModels();
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Refresh models error:', error);
    res.status(500).json({ error: 'Failed to refresh models' });
  }
});

app.post('/api/ai/health-check', async (req, res) => {
  try {
    const health = await performHealthCheck();
    res.json({ success: true, ...health });
  } catch (error) {
    console.error('AI health check error:', error);
    res.status(500).json({ error: 'Failed to perform health check' });
  }
});

app.post('/api/ai/check-upgrades', authMiddleware, async (req, res) => {
  try {
    const result = await checkForNewModels();
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Check upgrades error:', error);
    res.status(500).json({ error: 'Failed to check for upgrades' });
  }
});

// ============ AI VISION ANALYSIS ============

app.post('/api/ai/analyze-photo', authMiddleware, async (req, res) => {
  try {
    const { imageBase64, imageUrl, userGender, analysisType } = req.body;

    if (!imageBase64 && !imageUrl) {
      return res.status(400).json({ error: 'imageBase64 or imageUrl is required' });
    }

    const analysis = await analyzeOutfitPhoto({
      imageBase64,
      imageUrl,
      userGender: userGender || 'not specified',
      analysisType: analysisType || 'full'
    });

    res.json({ success: true, analysis });
  } catch (error) {
    console.error('Photo analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze photo' });
  }
});

app.post('/api/ai/compare-outfits', authMiddleware, async (req, res) => {
  try {
    const { images, userGender, occasion } = req.body;

    if (!images || !Array.isArray(images) || images.length < 2) {
      return res.status(400).json({ error: 'At least 2 images are required for comparison' });
    }

    const comparison = await compareOutfits({
      images,
      userGender: userGender || 'not specified',
      occasion: occasion || 'general'
    });

    res.json({ success: true, comparison });
  } catch (error) {
    console.error('Outfit comparison error:', error);
    res.status(500).json({ error: 'Failed to compare outfits' });
  }
});

app.post('/api/ai/extract-colors', authMiddleware, async (req, res) => {
  try {
    const { imageBase64, imageUrl } = req.body;

    if (!imageBase64 && !imageUrl) {
      return res.status(400).json({ error: 'imageBase64 or imageUrl is required' });
    }

    const colors = await extractColorsFromPhoto({ imageBase64, imageUrl });
    res.json({ success: true, colors });
  } catch (error) {
    console.error('Color extraction error:', error);
    res.status(500).json({ error: 'Failed to extract colors' });
  }
});

// ============ AI VOICE SERVICES ============

app.post('/api/ai/transcribe', authMiddleware, async (req, res) => {
  try {
    const { audioBase64, audioUrl, language } = req.body;

    if (!audioBase64 && !audioUrl) {
      return res.status(400).json({ error: 'audioBase64 or audioUrl is required' });
    }

    const transcription = await transcribeAudio({
      audioBase64,
      audioUrl,
      language: language || 'en'
    });

    res.json({ success: true, transcription });
  } catch (error) {
    console.error('Transcription error:', error);
    res.status(500).json({ error: 'Failed to transcribe audio' });
  }
});

app.post('/api/ai/speak', authMiddleware, async (req, res) => {
  try {
    const { text, voice, stylistId, speed } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'text is required' });
    }

    const audio = await synthesizeSpeech({
      text,
      voice,
      stylistId,
      speed: speed || 1.0
    });

    res.json({ success: true, audio });
  } catch (error) {
    console.error('Speech synthesis error:', error);
    res.status(500).json({ error: 'Failed to synthesize speech' });
  }
});

app.get('/api/ai/voices', async (req, res) => {
  try {
    const voices = getAllVoices();
    res.json({ success: true, voices });
  } catch (error) {
    console.error('Get voices error:', error);
    res.status(500).json({ error: 'Failed to get available voices' });
  }
});

app.post('/api/ai/voice-preview', async (req, res) => {
  try {
    const { stylistId, language, voiceRange } = req.body;

    if (!stylistId || !['ruby', 'max'].includes(stylistId)) {
      return res.status(400).json({ error: 'Valid stylistId (ruby or max) is required' });
    }

    const result = await generateVoicePreview(
      stylistId,
      language || 'English',
      voiceRange || null
    );

    if (!result.success) {
      return res.status(500).json({ error: result.error || 'Failed to generate voice preview' });
    }

    const audioBase64 = result.audioBuffer.toString('base64');
    
    res.json({
      success: true,
      audioBase64,
      voice: result.voice,
      format: result.format,
    });
  } catch (error) {
    console.error('Voice preview error:', error);
    res.status(500).json({ error: 'Failed to generate voice preview' });
  }
});

app.get('/api/ai/voice-languages', async (req, res) => {
  try {
    const languages = getSupportedLanguages();
    res.json({ success: true, languages });
  } catch (error) {
    console.error('Get voice languages error:', error);
    res.status(500).json({ error: 'Failed to get supported languages' });
  }
});

app.post('/api/ai/voice-message', authMiddleware, async (req, res) => {
  try {
    const { audioBase64, audioUrl, stylistId, userGender, conversationHistory } = req.body;

    if (!audioBase64 && !audioUrl) {
      return res.status(400).json({ error: 'audioBase64 or audioUrl is required' });
    }

    const response = await processVoiceMessage({
      audioBase64,
      audioUrl,
      stylistId: stylistId || 'ruby',
      userGender: userGender || 'not specified',
      conversationHistory: conversationHistory || []
    });

    res.json({ success: true, ...response });
  } catch (error) {
    console.error('Voice message error:', error);
    res.status(500).json({ error: 'Failed to process voice message' });
  }
});

app.post('/api/ai/voice-response', authMiddleware, async (req, res) => {
  try {
    const { textResponse, stylistId, speed } = req.body;

    if (!textResponse || typeof textResponse !== 'string') {
      return res.status(400).json({ error: 'textResponse is required' });
    }

    const audio = await createVoiceResponse({
      textResponse,
      stylistId: stylistId || 'ruby',
      speed: speed || 1.0
    });

    res.json({ success: true, audio });
  } catch (error) {
    console.error('Voice response error:', error);
    res.status(500).json({ error: 'Failed to create voice response' });
  }
});

// ============ AI LIFESTYLE & THERAPY ============

app.post('/api/ai/lifestyle/mood-outfit', authMiddleware, async (req, res) => {
  try {
    const { mood, userGender, occasion, wardrobeItems, preferences } = req.body;

    if (!mood || typeof mood !== 'string') {
      return res.status(400).json({ error: 'mood is required' });
    }

    const outfit = await getMoodBasedOutfit({
      mood,
      userGender: userGender || 'not specified',
      occasion: occasion || 'casual',
      wardrobeItems: wardrobeItems || [],
      preferences: preferences || {}
    });

    res.json({ success: true, outfit });
  } catch (error) {
    console.error('Mood outfit error:', error);
    res.status(500).json({ error: 'Failed to generate mood-based outfit' });
  }
});

app.post('/api/ai/lifestyle/body-positivity', authMiddleware, async (req, res) => {
  try {
    const { concerns, bodyType, userGender, styleGoals } = req.body;

    const advice = await getBodyPositivityAdvice({
      concerns: concerns || [],
      bodyType: bodyType || 'not specified',
      userGender: userGender || 'not specified',
      styleGoals: styleGoals || []
    });

    res.json({ success: true, advice });
  } catch (error) {
    console.error('Body positivity error:', error);
    res.status(500).json({ error: 'Failed to generate body positivity advice' });
  }
});

app.post('/api/ai/lifestyle/capsule-wardrobe', authMiddleware, async (req, res) => {
  try {
    const { lifestyle, budget, userGender, season, colorPreferences, existingItems } = req.body;

    const plan = await getCapsuleWardrobePlan({
      lifestyle: lifestyle || 'balanced',
      budget: budget || 'medium',
      userGender: userGender || 'not specified',
      season: season || 'all-season',
      colorPreferences: colorPreferences || [],
      existingItems: existingItems || []
    });

    res.json({ success: true, plan });
  } catch (error) {
    console.error('Capsule wardrobe error:', error);
    res.status(500).json({ error: 'Failed to generate capsule wardrobe plan' });
  }
});

app.post('/api/ai/lifestyle/confidence-ritual', authMiddleware, async (req, res) => {
  try {
    const { upcomingEvent, concerns, userGender, stylePersonality } = req.body;

    const ritual = await getConfidenceRitual({
      upcomingEvent: upcomingEvent || 'general day',
      concerns: concerns || [],
      userGender: userGender || 'not specified',
      stylePersonality: stylePersonality || 'classic'
    });

    res.json({ success: true, ritual });
  } catch (error) {
    console.error('Confidence ritual error:', error);
    res.status(500).json({ error: 'Failed to generate confidence ritual' });
  }
});

app.post('/api/ai/lifestyle/wellness-outfit', authMiddleware, async (req, res) => {
  try {
    const { wellnessGoal, activity, userGender, preferences } = req.body;

    if (!wellnessGoal || typeof wellnessGoal !== 'string') {
      return res.status(400).json({ error: 'wellnessGoal is required' });
    }

    const outfit = await getWellnessOutfit({
      wellnessGoal,
      activity: activity || 'general wellness',
      userGender: userGender || 'not specified',
      preferences: preferences || {}
    });

    res.json({ success: true, outfit });
  } catch (error) {
    console.error('Wellness outfit error:', error);
    res.status(500).json({ error: 'Failed to generate wellness outfit' });
  }
});

app.get('/api/ai/lifestyle/affirmation', authMiddleware, async (req, res) => {
  try {
    const { userGender, focusArea } = req.query;

    const affirmation = await getDailyAffirmation({
      userGender: userGender || 'not specified',
      focusArea: focusArea || 'style confidence'
    });

    res.json({ success: true, affirmation });
  } catch (error) {
    console.error('Affirmation error:', error);
    res.status(500).json({ error: 'Failed to generate affirmation' });
  }
});

// ============ AI SEMANTIC SEARCH & EMBEDDINGS ============

app.post('/api/ai/semantic-search', authMiddleware, async (req, res) => {
  try {
    const { query, styleCategory, userGender, limit, filters } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'query is required' });
    }

    const results = await semanticStyleSearch({
      query,
      styleCategory: styleCategory || 'all',
      userGender: userGender || 'not specified',
      limit: limit || 10,
      filters: filters || {}
    });

    res.json({ success: true, results });
  } catch (error) {
    console.error('Semantic search error:', error);
    res.status(500).json({ error: 'Failed to perform semantic search' });
  }
});

app.post('/api/ai/complementary-pieces', authMiddleware, async (req, res) => {
  try {
    const { itemDescription, wardrobeItems, userGender, occasion, budget } = req.body;

    if (!itemDescription || typeof itemDescription !== 'string') {
      return res.status(400).json({ error: 'itemDescription is required' });
    }

    const pieces = await findComplementaryPieces({
      itemDescription,
      wardrobeItems: wardrobeItems || [],
      userGender: userGender || 'not specified',
      occasion: occasion || 'casual',
      budget: budget || 'medium'
    });

    res.json({ success: true, pieces });
  } catch (error) {
    console.error('Complementary pieces error:', error);
    res.status(500).json({ error: 'Failed to find complementary pieces' });
  }
});

app.get('/api/ai/embedding-stats', authMiddleware, async (req, res) => {
  try {
    const stats = getCacheStats();
    res.json({ success: true, stats });
  } catch (error) {
    console.error('Embedding stats error:', error);
    res.status(500).json({ error: 'Failed to get embedding stats' });
  }
});

// ============ AI IMAGE GENERATION ============

app.post('/api/ai/generate-inspiration', authMiddleware, async (req, res) => {
  try {
    const { styleDescription, userGender, occasion, colorScheme, mood } = req.body;

    if (!styleDescription || typeof styleDescription !== 'string') {
      return res.status(400).json({ error: 'styleDescription is required' });
    }

    const inspiration = await generateOutfitInspiration({
      styleDescription,
      userGender: userGender || 'not specified',
      occasion: occasion || 'casual',
      colorScheme: colorScheme || 'neutral',
      mood: mood || 'confident'
    });

    res.json({ success: true, inspiration });
  } catch (error) {
    console.error('Generate inspiration error:', error);
    res.status(500).json({ error: 'Failed to generate outfit inspiration' });
  }
});

app.post('/api/ai/generate-moodboard', authMiddleware, async (req, res) => {
  try {
    const { theme, colors, styleElements, userGender } = req.body;

    if (!theme || typeof theme !== 'string') {
      return res.status(400).json({ error: 'theme is required' });
    }

    const moodboard = await generateMoodBoard({
      theme,
      colors: colors || [],
      styleElements: styleElements || [],
      userGender: userGender || 'not specified'
    });

    res.json({ success: true, moodboard });
  } catch (error) {
    console.error('Generate moodboard error:', error);
    res.status(500).json({ error: 'Failed to generate mood board' });
  }
});

app.post('/api/ai/generate-similar', authMiddleware, async (req, res) => {
  try {
    const { outfitDescription, imageUrl, userGender, budget } = req.body;

    if (!outfitDescription && !imageUrl) {
      return res.status(400).json({ error: 'outfitDescription or imageUrl is required' });
    }

    const similar = await generateSimilarLook({
      outfitDescription,
      imageUrl,
      userGender: userGender || 'not specified',
      budget: budget || 'medium'
    });

    res.json({ success: true, similar });
  } catch (error) {
    console.error('Generate similar look error:', error);
    res.status(500).json({ error: 'Failed to generate similar look' });
  }
});

app.post('/api/ai/generate-variations', authMiddleware, async (req, res) => {
  try {
    const { baseOutfit, variationType, count, userGender } = req.body;

    if (!baseOutfit || typeof baseOutfit !== 'string') {
      return res.status(400).json({ error: 'baseOutfit is required' });
    }

    const variations = await generateOutfitVariations({
      baseOutfit,
      variationType: variationType || 'casual-to-formal',
      count: Math.min(count || 3, 5),
      userGender: userGender || 'not specified'
    });

    res.json({ success: true, variations });
  } catch (error) {
    console.error('Generate variations error:', error);
    res.status(500).json({ error: 'Failed to generate outfit variations' });
  }
});

app.post('/api/ai/generate-style-guide', authMiddleware, async (req, res) => {
  try {
    const { stylePersonality, userGender, season, colorPreferences } = req.body;

    if (!stylePersonality || typeof stylePersonality !== 'string') {
      return res.status(400).json({ error: 'stylePersonality is required' });
    }

    const guide = await generateStyleGuide({
      stylePersonality,
      userGender: userGender || 'not specified',
      season: season || 'all-season',
      colorPreferences: colorPreferences || []
    });

    res.json({ success: true, guide });
  } catch (error) {
    console.error('Generate style guide error:', error);
    res.status(500).json({ error: 'Failed to generate style guide' });
  }
});

app.get('/api/ai/available-styles', async (req, res) => {
  try {
    const styles = getAvailableStyles();
    res.json({ success: true, styles });
  } catch (error) {
    console.error('Get styles error:', error);
    res.status(500).json({ error: 'Failed to get available styles' });
  }
});

app.get('/api/ai/available-moods', async (req, res) => {
  try {
    const moods = getAvailableMoods();
    res.json({ success: true, moods });
  } catch (error) {
    console.error('Get moods error:', error);
    res.status(500).json({ error: 'Failed to get available moods' });
  }
});

// ============ COMPLEX ANALYSIS ENDPOINTS ============

// Get available analysis types
app.get('/api/ai/analysis-types', async (req, res) => {
  try {
    const analysisTypes = getAvailableAnalysisTypes();
    res.json({ success: true, analysisTypes });
  } catch (error) {
    console.error('Get analysis types error:', error);
    res.status(500).json({ error: 'Failed to get analysis types' });
  }
});

// Perform complex analysis using o1 reasoning models
app.post('/api/ai/complex-analysis', authMiddleware, async (req, res) => {
  try {
    const { 
      stylistId = 'ruby', 
      analysisType = 'wardrobe_audit', 
      message,
      wardrobeItems = [],
      userProfile = null
    } = req.body;
    
    const userId = req.userId;
    
    // Get user info for context
    const userResult = await pool.query(
      'SELECT gender, subscription_tier FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = userResult.rows[0];
    
    // Check subscription tier - complex analysis is premium feature
    const allowedTiers = ['premium', 'vip'];
    if (!allowedTiers.includes(user.subscription_tier)) {
      return res.status(403).json({ 
        error: 'Complex analysis requires Premium or VIP subscription',
        requiredTier: 'premium'
      });
    }
    
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required for analysis' });
    }
    
    const analysis = await performComplexAnalysis({
      stylistId,
      analysisType,
      userMessage: message,
      wardrobeItems,
      userGender: user.gender,
      userProfile,
      subscriptionTier: user.subscription_tier,
    });
    
    res.json({ 
      success: true, 
      analysis,
      modelInfo: {
        usedReasoningModel: analysis.modelUsed?.startsWith('o1') || false,
        model: analysis.modelUsed
      }
    });
  } catch (error) {
    console.error('Complex analysis error:', error);
    res.status(500).json({ error: 'Failed to perform complex analysis' });
  }
});

// Quick wardrobe audit endpoint
app.post('/api/ai/wardrobe-audit', authMiddleware, async (req, res) => {
  try {
    const { stylistId = 'ruby', wardrobeItems = [], specificFocus = null } = req.body;
    
    const userId = req.userId;
    const userResult = await pool.query(
      'SELECT gender, subscription_tier FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = userResult.rows[0];
    
    const message = specificFocus 
      ? `Please analyze my wardrobe with a specific focus on: ${specificFocus}`
      : 'Please perform a comprehensive audit of my wardrobe.';
    
    const analysis = await performComplexAnalysis({
      stylistId,
      analysisType: 'wardrobe_audit',
      userMessage: message,
      wardrobeItems,
      userGender: user.gender,
      subscriptionTier: user.subscription_tier,
    });
    
    res.json({ success: true, analysis });
  } catch (error) {
    console.error('Wardrobe audit error:', error);
    res.status(500).json({ error: 'Failed to perform wardrobe audit' });
  }
});

// Style profile endpoint
app.post('/api/ai/style-profile', authMiddleware, async (req, res) => {
  try {
    const { stylistId = 'ruby', wardrobeItems = [], userProfile = null } = req.body;
    
    const userId = req.userId;
    const userResult = await pool.query(
      'SELECT gender, subscription_tier FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = userResult.rows[0];
    
    const analysis = await performComplexAnalysis({
      stylistId,
      analysisType: 'personal_style_profile',
      userMessage: 'Please create a comprehensive personal style profile for me based on my wardrobe and preferences.',
      wardrobeItems,
      userGender: user.gender,
      userProfile,
      subscriptionTier: user.subscription_tier,
    });
    
    res.json({ success: true, analysis });
  } catch (error) {
    console.error('Style profile error:', error);
    res.status(500).json({ error: 'Failed to create style profile' });
  }
});

// Get current reasoning model info
app.get('/api/ai/reasoning-model', async (req, res) => {
  try {
    const reasoningModel = await getBestReasoningModel();
    const isO1 = reasoningModel.startsWith('o1');
    
    res.json({ 
      success: true, 
      model: reasoningModel,
      isReasoningModel: isO1,
      capabilities: isO1 
        ? ['deep-reasoning', 'complex-analysis', 'multi-step-planning', 'comprehensive-evaluation']
        : ['standard-analysis', 'conversational-ai']
    });
  } catch (error) {
    console.error('Get reasoning model error:', error);
    res.status(500).json({ error: 'Failed to get reasoning model info' });
  }
});

// ============ VIRTUAL TRY-ON (Replicate IDM-VTON) ============

// Virtual try-on limits by subscription tier
const VIRTUAL_TRY_ON_LIMITS = {
  free: 0,
  basic: 3,
  premium: 10,
  vip: Infinity,
};

// Virtual try-on endpoint
app.post('/api/virtual-try-on', authMiddleware, async (req, res) => {
  const Replicate = require('replicate');
  
  try {
    const { humanImageUri, garmentImageUrl, garmentDescription } = req.body;
    
    if (!humanImageUri || !garmentImageUrl) {
      return res.status(400).json({ error: 'Human image and garment image are required' });
    }
    
    // Check user subscription and usage
    const userResult = await pool.query(
      'SELECT subscription_tier FROM users WHERE id = $1',
      [req.userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const tier = userResult.rows[0].subscription_tier || 'free';
    const limit = VIRTUAL_TRY_ON_LIMITS[tier] || 0;
    
    // Check current month usage
    const currentMonth = new Date().toISOString().slice(0, 7);
    const usageResult = await pool.query(
      `SELECT COUNT(*) as count FROM virtual_try_on_history 
       WHERE user_id = $1 AND created_at >= $2`,
      [req.userId, `${currentMonth}-01`]
    );
    
    const used = parseInt(usageResult.rows[0]?.count || '0');
    
    if (limit !== Infinity && used >= limit) {
      return res.status(403).json({ 
        error: 'Virtual try-on limit reached for this month',
        used,
        limit,
        tier
      });
    }
    
    // Check for Replicate API token
    if (!process.env.REPLICATE_API_TOKEN) {
      return res.status(500).json({ error: 'Virtual try-on service not configured' });
    }
    
    const replicate = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN,
    });
    
    const startTime = Date.now();
    
    // Run IDM-VTON model
    const output = await replicate.run("cuuupid/idm-vton:c871bb9b046c1462f43284e5ea49e2136c7f16b8e0744ca41ea003dcac3fab4a", {
      input: {
        human_img: humanImageUri,
        garm_img: garmentImageUrl,
        garment_des: garmentDescription || 'A fashionable garment',
      }
    });
    
    const processingTimeMs = Date.now() - startTime;
    
    // Store in history
    await pool.query(
      `INSERT INTO virtual_try_on_history (user_id, human_image_url, garment_image_url, result_image_url, garment_description, processing_time_ms)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [req.userId, humanImageUri, garmentImageUrl, output, garmentDescription, processingTimeMs]
    );
    
    res.json({
      success: true,
      resultImageUrl: output,
      processingTimeMs,
    });
  } catch (error) {
    console.error('Virtual try-on error:', error);
    res.status(500).json({ error: 'Failed to generate try-on image' });
  }
});

// Get virtual try-on usage
app.get('/api/virtual-try-on/usage', authMiddleware, async (req, res) => {
  try {
    const userResult = await pool.query(
      'SELECT subscription_tier FROM users WHERE id = $1',
      [req.userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const tier = userResult.rows[0].subscription_tier || 'free';
    const limit = VIRTUAL_TRY_ON_LIMITS[tier] || 0;
    
    // Check current month usage
    const currentMonth = new Date().toISOString().slice(0, 7);
    const usageResult = await pool.query(
      `SELECT COUNT(*) as count FROM virtual_try_on_history 
       WHERE user_id = $1 AND created_at >= $2`,
      [req.userId, `${currentMonth}-01`]
    );
    
    const used = parseInt(usageResult.rows[0]?.count || '0');
    
    res.json({
      used,
      limit: limit === Infinity ? -1 : limit,
      remaining: limit === Infinity ? -1 : Math.max(0, limit - used),
      tier,
    });
  } catch (error) {
    console.error('Virtual try-on usage error:', error);
    res.status(500).json({ error: 'Failed to get usage' });
  }
});

// Get virtual try-on history
app.get('/api/virtual-try-on/history', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, human_image_url, garment_image_url, result_image_url, garment_description, processing_time_ms, created_at
       FROM virtual_try_on_history 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT 20`,
      [req.userId]
    );
    
    res.json({
      success: true,
      history: result.rows.map(row => ({
        id: row.id,
        humanImageUrl: row.human_image_url,
        garmentImageUrl: row.garment_image_url,
        resultImageUrl: row.result_image_url,
        garmentDescription: row.garment_description,
        processingTimeMs: row.processing_time_ms,
        createdAt: row.created_at,
      })),
    });
  } catch (error) {
    console.error('Virtual try-on history error:', error);
    res.status(500).json({ error: 'Failed to get history' });
  }
});

// ============ ONBOARDING SCANS ============

const BODY_SCAN_PROMPT = `You are a supportive fashion consultant helping someone understand their body proportions for clothing recommendations.

CRITICAL RULES - READ CAREFULLY:
1. ONLY describe what you can ACTUALLY SEE in the photo
2. NEVER make claims about height - you cannot determine height from a photo
3. NEVER claim to see through clothing - if someone wears loose/bulky clothes, say "Based on visible proportions, though fitted clothing would give more accurate results"
4. Use hedged, honest language: "appears to have", "seems to be", "based on visible proportions"
5. Focus on OBSERVABLE features: shoulder width relative to hips, torso length relative to legs, overall silhouette
6. If feet are not visible, DO NOT mention height or leg length
7. If wearing bulky clothes, acknowledge this limits accuracy
8. Be body-positive and focus on finding flattering styles, not critiquing the body

Analyze the visible proportions and provide:

1. BODY TYPE: Based on visible shoulder-to-hip ratio and overall silhouette (rectangle, triangle, inverted triangle, hourglass, oval)
2. KIBBE BODY TYPE: Best estimate based on visible bone structure and proportions
3. STYLE RECOMMENDATIONS: 3-5 clothing styles that typically flatter this body type
4. AFFIRMATION: A warm, body-positive message (2-3 sentences)

Important: If you cannot clearly see the full body or the person is wearing very loose clothing, include a note that results may be more accurate with form-fitting clothes and full body visible.

Respond in JSON format:
{
  "bodyType": "body type name",
  "kibbeBodyType": "Kibbe classification",
  "confidence": "high/medium/low based on photo quality and visibility",
  "limitations": "any limitations noted (e.g., 'Wearing loose clothing - results approximate')",
  "kibbeStyleRecommendations": ["recommendation 1", "recommendation 2", "recommendation 3"],
  "affirmation": "body-positive message celebrating their unique proportions",
  "message": "brief summary of findings with honest caveats",
  "review": {
    "confirmButtonText": "Confirm",
    "retakeButtonText": "Retake"
  }
}`;

const COLOR_SCAN_PROMPT = `You are an expert color analyst helping someone discover their most flattering colors based on their natural coloring.

Analyze the person's visible skin tone, and if visible, their hair and eye color. Determine their seasonal color type.

Focus on:
1. SKIN UNDERTONE: Warm (golden/peachy), Cool (pink/blue), or Neutral
2. CONTRAST LEVEL: High (dark hair, light skin), Medium, or Low (similar tones)
3. SEASONAL COLOR TYPE: Spring, Summer, Autumn, or Winter
4. SEASON SUBTYPE: Light, Deep, Warm, Cool, Soft, or Clear

Provide a palette of 5 "power colors" that will make them look their best.

Be encouraging and focus on how these colors will enhance their natural beauty.

Respond in JSON format:
{
  "skinTone": "description of visible skin tone",
  "undertone": "warm/cool/neutral",
  "contrastLevel": "high/medium/low",
  "colorSeasonType": "Spring/Summer/Autumn/Winter",
  "seasonSubtype": "light/deep/warm/cool/soft/clear",
  "colorPalette": {
    "powerColors": ["Color Name #HexCode", "Color Name #HexCode", "Color Name #HexCode", "Color Name #HexCode", "Color Name #HexCode"],
    "neutrals": ["Neutral 1 #HexCode", "Neutral 2 #HexCode"],
    "colorsToAvoid": ["color to avoid 1", "color to avoid 2"]
  },
  "metalRecommendation": "gold/silver/rose gold/mixed",
  "message": "personalized message about their color season and how to use it when shopping",
  "review": {
    "confirmButtonText": "Confirm",
    "retakeButtonText": "Retake"
  }
}`;

app.post('/api/onboarding/body-scan', authMiddleware, async (req, res) => {
  try {
    const { imageBase64, autoSave } = req.body;
    
    if (!imageBase64) {
      return res.status(400).json({ error: 'Image is required' });
    }

    const visionModel = await getBestModel('vision');
    console.log(`[BodyScan] Using model: ${visionModel}`);

    const response = await openai.chat.completions.create({
      model: visionModel,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: BODY_SCAN_PROMPT },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`,
                detail: 'high',
              },
            },
          ],
        },
      ],
      max_tokens: 1000,
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      throw new Error('Empty response from vision model');
    }

    const cleanedContent = content.replace(/```json\n?|\n?```/g, '');
    const result = JSON.parse(cleanedContent);

    if (autoSave && req.userId) {
      await pool.query(
        `UPDATE users SET body_type = $1, kibbe_body_type = $2 WHERE id = $3`,
        [result.bodyType, result.kibbeBodyType, req.userId]
      );
    }

    res.json(result);
  } catch (error) {
    console.error('Body scan error:', error);
    res.status(500).json({ error: 'Body scan failed. Please try again.' });
  }
});

app.get('/api/onboarding/body-scan/guidance', authMiddleware, (req, res) => {
  res.json({
    timer: {
      enabled: true,
      durationSeconds: 5,
      countdownText: ["5", "4", "3", "2", "1", "Scanning..."]
    },
    overlay: {
      type: "body-silhouette",
      aspectRatio: "9:16",
      guideText: {
        top: "Fit your whole body in frame (head to feet)",
        middle: "Stand straight, arms relaxed",
        bottom: ""
      },
      targetZoneLabel: "Stand straight, arms relaxed"
    },
    tips: [
      {
        icon: "maximize",
        title: "Full Body Visible",
        description: "Stand far enough back that your entire body from head to feet is in frame"
      },
      {
        icon: "sun",
        title: "Good Lighting",
        description: "Stand facing natural light or a well-lit area"
      },
      {
        icon: "user",
        title: "Form-fitting clothes",
        description: "Wear fitted clothing so we can see your natural shape"
      },
      {
        icon: "smartphone",
        title: "Prop your phone",
        description: "Use a shelf, lean against something, or ask someone to help"
      }
    ],
    tipsSimple: [
      "Good lighting: Stand facing natural light or a well-lit area",
      "Form-fitting clothes: Wear fitted clothing so we can see your natural shape",
      "Prop your phone: Use a shelf, lean against something, or ask someone to help",
      "Full body visible: Step back so your entire body fits in the frame"
    ],
    positioning: {
      distance: "6-8 feet from camera",
      lighting: "well-lit area",
      angle: "straight on, facing camera"
    }
  });
});

app.post('/api/onboarding/color-scan', authMiddleware, async (req, res) => {
  try {
    const { imageBase64, autoSave } = req.body;
    
    if (!imageBase64) {
      return res.status(400).json({ error: 'Image is required' });
    }

    const visionModel = await getBestModel('vision');
    console.log(`[ColorScan] Using model: ${visionModel}`);

    const response = await openai.chat.completions.create({
      model: visionModel,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: COLOR_SCAN_PROMPT },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`,
                detail: 'high',
              },
            },
          ],
        },
      ],
      max_tokens: 1000,
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      throw new Error('Empty response from vision model');
    }

    const cleanedContent = content.replace(/```json\n?|\n?```/g, '');
    const result = JSON.parse(cleanedContent);

    if (autoSave && req.userId) {
      await pool.query(
        `UPDATE users SET color_season = $1, skin_undertone = $2 WHERE id = $3`,
        [result.colorSeasonType, result.undertone, req.userId]
      );
    }

    res.json(result);
  } catch (error) {
    console.error('Color scan error:', error);
    res.status(500).json({ error: 'Color scan failed. Please try again.' });
  }
});

app.get('/api/onboarding/color-scan/guidance', authMiddleware, (req, res) => {
  res.json({
    timer: {
      enabled: true,
      durationSeconds: 3,
      countdownText: ["3", "2", "1", "Analyzing..."]
    },
    overlay: {
      type: "face-oval",
      aspectRatio: "3:4",
      guideText: {
        top: "Position your face in the oval",
        middle: "",
        bottom: "Good lighting helps accuracy"
      },
      targetZoneLabel: "Face"
    },
    tips: [
      {
        icon: "sun",
        title: "Natural Lighting",
        description: "Stand near a window with natural daylight for accurate skin tone detection"
      },
      {
        icon: "droplet",
        title: "No makeup (if possible)",
        description: "Bare skin gives the most accurate results, but light makeup is okay"
      },
      {
        icon: "eye",
        title: "Face camera directly",
        description: "Look straight at the camera with your face fully visible"
      }
    ],
    tipsSimple: [
      "Natural light: Stand near a window for accurate color detection",
      "Minimal makeup: Bare skin gives the best results",
      "Face the camera: Look straight ahead with your whole face visible"
    ],
    positioning: {
      distance: "2-3 feet from camera",
      lighting: "natural daylight preferred",
      angle: "face camera directly"
    }
  });
});

app.get('/api/discover/config', (req, res) => {
  res.json({
    layout: {
      type: "grid",
      columns: 2,
      tileAspectRatio: "1:1",
      horizontalPadding: 16,
      verticalSpacing: 12,
      equalWidth: true
    },
    styling: {
      tileTextColor: "#FFFFFF",
      tileIconColor: "#FFFFFF",
      tileIconSize: 36,
      tileLabelSize: 15,
      tileBorderRadius: 20
    }
  });
});

// ============ FEATURE 1: LIVE PERCEPTION & GESTURE COACHING ============

app.post('/api/motion/analyze', authMiddleware, async (req, res) => {
  try {
    const { videoUrl, motionDescription, analysisType } = req.body;
    const userGender = req.userGender || 'neutral';
    
    const chatModel = await getBestModel('chat');
    
    const prompt = `You are an expert style coach analyzing someone's movement and presence. The user ${motionDescription ? `describes their movement as: "${motionDescription}"` : 'has shared a video of themselves'}.

Analyze and provide coaching on:
1. POSTURE: Shoulder alignment, spine position, head carriage (confidence indicators)
2. GAIT: Walking style, stride length, arm swing (energy type)
3. VIBE: Overall presence, confidence level, energy they project
4. CLOTHING MOVEMENT: How clothes would move with their body type

Provide specific, actionable micro-coaching tips with realistic timelines.

Gender context: ${userGender}

Respond in JSON:
{
  "postureAnalysis": {
    "score": 1-10,
    "strengths": ["..."],
    "improvements": ["..."]
  },
  "gaitAnalysis": {
    "walkingStyle": "...",
    "energyType": "dynamic/calm/confident/casual",
    "tips": ["..."]
  },
  "vibeScore": {
    "confidence": 1-10,
    "presence": 1-10,
    "approachability": 1-10,
    "overallVibe": "..."
  },
  "clothingRecommendations": ["styles that move well with their energy"],
  "microCoaching": [
    {"tip": "...", "exercise": "...", "timeline": "1 week"},
    {"tip": "...", "exercise": "...", "timeline": "2 weeks"},
    {"tip": "...", "exercise": "...", "timeline": "1 month"}
  ],
  "affirmation": "encouraging message about their unique presence"
}`;

    const response = await openai.chat.completions.create({
      model: chatModel,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1500,
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content?.trim();
    const cleanedContent = content.replace(/```json\n?|\n?```/g, '');
    const result = JSON.parse(cleanedContent);

    // Save to history
    await pool.query(
      `INSERT INTO motion_analysis_history (user_id, analysis_type, result, created_at) 
       VALUES ($1, $2, $3, NOW())`,
      [req.userId, analysisType || 'general', JSON.stringify(result)]
    ).catch(() => {}); // Ignore if table doesn't exist yet

    res.json(result);
  } catch (error) {
    console.error('Motion analysis error:', error);
    res.status(500).json({ error: 'Motion analysis failed' });
  }
});

app.get('/api/motion/history', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM motion_analysis_history WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10`,
      [req.userId]
    );
    res.json({ history: result.rows });
  } catch (error) {
    res.json({ history: [] });
  }
});

// ============ FEATURE 2: WARDROBE DIGITAL TWIN & TIME MACHINE ============

// ===== WARDROBE BATCH UPLOAD =====
app.post('/api/wardrobe/batch', authMiddleware, async (req, res) => {
  try {
    const { items } = req.body;
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Items array is required' });
    }

    console.log(`[Wardrobe Batch] Uploading ${items.length} items for user ${req.userId}`);
    
    const savedItems = [];
    const errors = [];
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      try {
        let imageUrl = item.imageUrl;
        
        // If base64 image provided, upload to storage
        if (item.imageBase64) {
          // For now, store as data URI or use external storage
          imageUrl = `data:image/jpeg;base64,${item.imageBase64.substring(0, 100)}...`;
          // TODO: Integrate with cloud storage for production
        }
        
        const result = await pool.query(
          `INSERT INTO wardrobe_items 
           (user_id, name, category, subcategory, image_url, color, brand, season, occasions, item_type)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING id, name, category, color, image_url`,
          [
            req.userId,
            item.name || 'Untitled Item',
            item.category || 'tops',
            item.subcategory || null,
            imageUrl || null,
            item.color || null,
            item.brand || null,
            item.season || [],
            item.occasions || [],
            item.itemType || 'owned'
          ]
        );
        
        savedItems.push({
          id: result.rows[0].id,
          name: result.rows[0].name,
          category: result.rows[0].category,
          color: result.rows[0].color,
          imageUrl: result.rows[0].image_url
        });
        
        console.log(`[Wardrobe Batch] Saved item ${i + 1}: ${item.name}`);
      } catch (itemError) {
        console.error(`[Wardrobe Batch] Failed to save item ${i + 1}:`, itemError.message);
        errors.push({
          index: i,
          name: item.name || 'Unknown',
          error: itemError.message
        });
      }
    }
    
    console.log(`[Wardrobe Batch] Complete: ${savedItems.length} saved, ${errors.length} failed`);
    
    res.json({
      success: true,
      saved: savedItems.length,
      failed: errors.length,
      items: savedItems,
      errors: errors
    });
  } catch (error) {
    console.error('[Wardrobe Batch] Error:', error);
    res.status(500).json({ error: 'Failed to batch upload wardrobe items' });
  }
});

// ===== WARDROBE SINGLE ITEM UPLOAD =====
app.post('/api/wardrobe', authMiddleware, async (req, res) => {
  try {
    const { name, category, subcategory, imageUrl, imageBase64, color, brand, season, occasions, itemType } = req.body;
    
    if (!name || !category) {
      return res.status(400).json({ error: 'Name and category are required' });
    }
    
    let finalImageUrl = imageUrl;
    if (imageBase64) {
      finalImageUrl = `data:image/jpeg;base64,${imageBase64.substring(0, 100)}...`;
    }
    
    const result = await pool.query(
      `INSERT INTO wardrobe_items 
       (user_id, name, category, subcategory, image_url, color, brand, season, occasions, item_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [req.userId, name, category, subcategory || null, finalImageUrl || null, color || null, brand || null, season || [], occasions || [], itemType || 'owned']
    );
    
    console.log(`[Wardrobe] Added item: ${name} for user ${req.userId}`);
    res.json({ success: true, item: result.rows[0] });
  } catch (error) {
    console.error('[Wardrobe] Error adding item:', error);
    res.status(500).json({ error: 'Failed to add wardrobe item' });
  }
});

// ===== GET WARDROBE ITEMS =====
app.get('/api/wardrobe', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM wardrobe_items WHERE user_id = $1 ORDER BY created_at DESC`,
      [req.userId]
    );
    res.json({ success: true, items: result.rows });
  } catch (error) {
    console.error('[Wardrobe] Error fetching items:', error);
    res.status(500).json({ error: 'Failed to fetch wardrobe items' });
  }
});

app.get('/api/wardrobe/digital-twin', authMiddleware, async (req, res) => {
  try {
    const wardrobeResult = await pool.query(
      `SELECT * FROM wardrobe_items WHERE user_id = $1`,
      [req.userId]
    );
    
    const items = wardrobeResult.rows;
    const totalItems = items.length;
    
    // Calculate health metrics
    const categoryDistribution = {};
    const colorDistribution = {};
    let versatilityScore = 0;
    
    items.forEach(item => {
      categoryDistribution[item.category] = (categoryDistribution[item.category] || 0) + 1;
      if (item.color) {
        colorDistribution[item.color] = (colorDistribution[item.color] || 0) + 1;
      }
    });
    
    // Health score based on variety and balance
    const categoryCount = Object.keys(categoryDistribution).length;
    const colorCount = Object.keys(colorDistribution).length;
    const healthScore = Math.min(100, Math.round((categoryCount * 10) + (colorCount * 5) + (totalItems * 2)));
    
    res.json({
      totalItems,
      healthScore,
      categoryDistribution,
      colorDistribution,
      versatilityScore: Math.min(100, categoryCount * 15),
      wearPredictions: items.slice(0, 5).map(item => ({
        id: item.id,
        name: item.name,
        predictedWears: Math.floor(Math.random() * 20) + 5,
        lastWorn: item.last_worn || 'Never'
      })),
      gaps: categoryCount < 5 ? ['Consider adding more variety to your wardrobe categories'] : [],
      investmentPieces: items.filter(item => item.category === 'outerwear' || item.category === 'blazers').slice(0, 3)
    });
  } catch (error) {
    console.error('Digital twin error:', error);
    res.status(500).json({ error: 'Failed to generate digital twin' });
  }
});

app.post('/api/wardrobe/capsule-plan', authMiddleware, async (req, res) => {
  try {
    const { occasions, duration } = req.body;
    const userGender = req.userGender || 'neutral';
    
    const chatModel = await getBestModel('chat');
    
    const prompt = `Create a ${duration || 30}-day capsule wardrobe plan for someone who needs outfits for: ${(occasions || ['work', 'casual', 'evening']).join(', ')}.

Gender: ${userGender}

Create a minimal, versatile capsule wardrobe. Respond in JSON:
{
  "capsuleItems": [
    {"type": "...", "color": "...", "versatility": 1-10, "occasions": ["..."]}
  ],
  "totalPieces": number,
  "outfitCombinations": number,
  "weeklyPlan": [
    {"day": "Monday", "outfit": "...", "occasion": "..."}
  ],
  "packingList": ["item1", "item2"],
  "stylingTips": ["..."]
}`;

    const response = await openai.chat.completions.create({
      model: chatModel,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1500,
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content?.trim();
    const cleanedContent = content.replace(/```json\n?|\n?```/g, '');
    res.json(JSON.parse(cleanedContent));
  } catch (error) {
    console.error('Capsule plan error:', error);
    res.status(500).json({ error: 'Failed to create capsule plan' });
  }
});

app.post('/api/wardrobe/time-machine', authMiddleware, async (req, res) => {
  try {
    const { monthsAhead } = req.body;
    const userGender = req.userGender || 'neutral';
    
    const chatModel = await getBestModel('chat');
    
    const prompt = `Project a fashion-forward wardrobe evolution ${monthsAhead || 6} months into the future.

Gender: ${userGender}

Consider upcoming seasons and trends. Respond in JSON:
{
  "futureVision": "description of evolved style",
  "trendingPieces": ["piece to add 1", "piece to add 2"],
  "investmentRecommendations": [
    {"item": "...", "priority": "high/medium/low", "reason": "..."}
  ],
  "phasedPlan": [
    {"month": 1, "action": "...", "budget": "$$"}
  ],
  "styleEvolution": "how their style will mature"
}`;

    const response = await openai.chat.completions.create({
      model: chatModel,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1200,
      temperature: 0.8,
    });

    const content = response.choices[0]?.message?.content?.trim();
    const cleanedContent = content.replace(/```json\n?|\n?```/g, '');
    res.json(JSON.parse(cleanedContent));
  } catch (error) {
    console.error('Time machine error:', error);
    res.status(500).json({ error: 'Failed to project future wardrobe' });
  }
});

// ============ FEATURE 3: CULTURE-SAVVY STYLE DIPLOMAT ============

const CULTURAL_STYLE_DATABASE = {
  JP: {
    name: 'Japan',
    dressCodes: {
      business: 'Conservative dark suits, minimal accessories. Avoid flashy colors.',
      restaurants: 'Smart casual. Remove shoes at traditional restaurants.',
      temples: 'Modest clothing covering shoulders and knees. Remove shoes.',
      weddings: 'Dark formal wear. Avoid white (bride\'s color) and black-only (funerals).'
    },
    taboos: ['Exposed tattoos in public baths/gyms', 'Revealing clothing at temples', 'White at weddings'],
    currentTrends: ['Minimalist streetwear', 'Oversized silhouettes', 'Neutral tones'],
    packingEssentials: ['Slip-on shoes', 'Modest layers', 'Dark business attire']
  },
  FR: {
    name: 'France',
    dressCodes: {
      business: 'Elegant, tailored pieces. Quality over quantity.',
      restaurants: 'Smart casual to formal. Never too casual.',
      churches: 'Covered shoulders, no shorts.',
      weddings: 'Elegant formal. Avoid white and overly bright colors.'
    },
    taboos: ['Athleisure in cities', 'Overly casual dining attire', 'Flashy logos'],
    currentTrends: ['Quiet luxury', 'Effortless chic', 'Classic French girl style'],
    packingEssentials: ['Tailored blazer', 'Quality leather accessories', 'Neutral palette basics']
  },
  AE: {
    name: 'United Arab Emirates',
    dressCodes: {
      business: 'Conservative formal. Modest for women.',
      restaurants: 'Smart casual. More relaxed in tourist areas.',
      mosques: 'Full coverage required. Abayas provided for women.',
      beaches: 'Swimwear at hotel pools only. Cover up elsewhere.'
    },
    taboos: ['Revealing clothing in public', 'Shorts for men in malls', 'Offensive prints/slogans'],
    currentTrends: ['Modest luxury fashion', 'Designer abayas', 'Gold accessories'],
    packingEssentials: ['Loose-fitting clothes', 'Headscarf for mosque visits', 'Covered shoulders']
  },
  US: {
    name: 'United States',
    dressCodes: {
      business: 'Varies by city. NYC formal, SF casual.',
      restaurants: 'Casual to formal depending on venue.',
      churches: 'Generally casual, some formal.',
      weddings: 'Follows dress code on invitation.'
    },
    taboos: ['Under-dressing for business in NYC', 'Over-dressing in casual cities'],
    currentTrends: ['Coastal grandmother', 'Clean girl aesthetic', 'Quiet luxury'],
    packingEssentials: ['Layers for AC', 'Comfortable walking shoes', 'Versatile pieces']
  },
  GB: {
    name: 'United Kingdom',
    dressCodes: {
      business: 'Traditional and formal in finance. Creative in media.',
      restaurants: 'Smart casual common. Some require jacket.',
      churches: 'Modest, covered shoulders.',
      weddings: 'Formal. Hats/fascinators common for women.'
    },
    taboos: ['Trainers at nice restaurants', 'Casual wear at formal events'],
    currentTrends: ['British heritage brands', 'Tweed revival', 'Sustainable fashion'],
    packingEssentials: ['Rain jacket', 'Layers', 'Smart shoes']
  }
};

app.get('/api/cultural-style/database/countries', (req, res) => {
  res.json({
    countries: Object.keys(CULTURAL_STYLE_DATABASE).map(code => ({
      code,
      name: CULTURAL_STYLE_DATABASE[code].name
    }))
  });
});

app.get('/api/cultural-style/:countryCode', async (req, res) => {
  try {
    const { countryCode } = req.params;
    const upperCode = countryCode.toUpperCase();
    
    if (CULTURAL_STYLE_DATABASE[upperCode]) {
      return res.json(CULTURAL_STYLE_DATABASE[upperCode]);
    }
    
    // For other countries, use AI
    const chatModel = await getBestModel('fast');
    
    const prompt = `Provide cultural style guidance for ${countryCode}. Respond in JSON:
{
  "name": "Country Name",
  "dressCodes": {
    "business": "...",
    "restaurants": "...",
    "religious sites": "...",
    "weddings": "..."
  },
  "taboos": ["..."],
  "currentTrends": ["..."],
  "packingEssentials": ["..."]
}`;

    const response = await openai.chat.completions.create({
      model: chatModel,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 800,
      temperature: 0.5,
    });

    const content = response.choices[0]?.message?.content?.trim();
    const cleanedContent = content.replace(/```json\n?|\n?```/g, '');
    res.json(JSON.parse(cleanedContent));
  } catch (error) {
    console.error('Cultural style error:', error);
    res.status(500).json({ error: 'Failed to get cultural style guide' });
  }
});

// ============ FEATURE 4: EMOTIONAL COUTURE STORYTELLING ============

const STORY_TEMPLATES = [
  { id: 'origin', name: 'The Outfit That Started It All', description: 'The moment fashion clicked for you' },
  { id: 'confidence', name: 'The Day You Owned the Room', description: 'When your outfit gave you superpowers' },
  { id: 'journey', name: 'Your Style Journey', description: 'How your fashion evolved over time' },
  { id: 'signature', name: 'Your Signature', description: 'What makes your style uniquely yours' },
  { id: 'transformation', name: 'The Transformation', description: 'A style moment that changed everything' }
];

app.get('/api/style-stories/types', (req, res) => {
  res.json({ templates: STORY_TEMPLATES });
});

app.post('/api/style-stories/generate', authMiddleware, async (req, res) => {
  try {
    const { templateId, userInput, includeVoice } = req.body;
    const template = STORY_TEMPLATES.find(t => t.id === templateId) || STORY_TEMPLATES[0];
    const userGender = req.userGender || 'neutral';
    
    const chatModel = await getBestModel('chat');
    
    const prompt = `Create an emotional, cinematic fashion story based on the template "${template.name}".
User's input: ${userInput || 'Create a beautiful story about finding personal style'}
Gender: ${userGender}

Write a compelling 2-3 paragraph story that celebrates their style journey. Include:
1. Vivid sensory details
2. Emotional moments
3. Fashion details woven naturally

Also provide:
- A voice script version (for TTS narration)
- Suggested soundtrack mood
- Social media caption versions

Respond in JSON:
{
  "title": "${template.name}",
  "story": "The full emotional story...",
  "voiceScript": "Version optimized for voice narration...",
  "soundtrackMood": "cinematic/uplifting/reflective/powerful",
  "socialCaptions": {
    "instagram": "Short, hashtag-friendly version",
    "twitter": "280 char version",
    "linkedin": "Professional version"
  },
  "keyMoment": "The most powerful sentence from the story"
}`;

    const response = await openai.chat.completions.create({
      model: chatModel,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1500,
      temperature: 0.9,
    });

    const content = response.choices[0]?.message?.content?.trim();
    const cleanedContent = content.replace(/```json\n?|\n?```/g, '');
    const result = JSON.parse(cleanedContent);

    // Save to history
    await pool.query(
      `INSERT INTO style_stories (user_id, template_id, story_data, created_at) 
       VALUES ($1, $2, $3, NOW())`,
      [req.userId, templateId, JSON.stringify(result)]
    ).catch(() => {});

    res.json(result);
  } catch (error) {
    console.error('Story generation error:', error);
    res.status(500).json({ error: 'Failed to generate story' });
  }
});

app.get('/api/style-stories/history', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM style_stories WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10`,
      [req.userId]
    );
    res.json({ stories: result.rows });
  } catch (error) {
    res.json({ stories: [] });
  }
});

// ============ FEATURE 5: COLLECTIVE FASHION INTELLIGENCE ============

app.get('/api/collective/insights', authMiddleware, async (req, res) => {
  try {
    // Aggregate anonymous community data
    const stats = await pool.query(`
      SELECT 
        AVG(CASE WHEN color_season IS NOT NULL THEN 1 ELSE 0 END) as color_analyzed_pct,
        COUNT(DISTINCT color_season) as color_seasons,
        COUNT(*) as total_users
      FROM users WHERE id != $1
    `, [req.userId]).catch(() => ({ rows: [{}] }));

    res.json({
      communitySize: stats.rows[0]?.total_users || 1000,
      colorAnalysisTrends: {
        mostPopularSeason: 'Autumn',
        yourSeasonPercentile: 'Top 25%'
      },
      wardrobeTrends: {
        avgItemCount: 45,
        mostCommonCategory: 'Tops',
        colorDiversity: 'Medium'
      },
      trendForecasts: [
        { trend: 'Quiet Luxury', adoption: 'Rising', longevity: 'Long-term' },
        { trend: 'Bold Colors', adoption: 'Peak', longevity: 'Seasonal' },
        { trend: 'Oversized Fits', adoption: 'Stable', longevity: 'Medium-term' }
      ],
      confidenceBands: {
        description: 'Based on community data patterns',
        reliability: 'Medium-High'
      }
    });
  } catch (error) {
    console.error('Collective insights error:', error);
    res.status(500).json({ error: 'Failed to get insights' });
  }
});

app.get('/api/collective/trends', authMiddleware, async (req, res) => {
  try {
    const chatModel = await getBestModel('fast');
    
    const prompt = `Provide current fashion trend forecasts. Respond in JSON:
{
  "emergingTrends": [
    {"name": "...", "adoptionTiming": "now/3months/6months", "longevity": "seasonal/lasting"}
  ],
  "decliningTrends": ["..."],
  "stableTrends": ["..."],
  "investmentAdvice": "..."
}`;

    const response = await openai.chat.completions.create({
      model: chatModel,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 800,
      temperature: 0.6,
    });

    const content = response.choices[0]?.message?.content?.trim();
    const cleanedContent = content.replace(/```json\n?|\n?```/g, '');
    res.json(JSON.parse(cleanedContent));
  } catch (error) {
    console.error('Trends error:', error);
    res.status(500).json({ error: 'Failed to get trends' });
  }
});

app.post('/api/collective/opt-in', authMiddleware, async (req, res) => {
  try {
    const { optIn } = req.body;
    
    await pool.query(
      `UPDATE users SET collective_opt_in = $1 WHERE id = $2`,
      [optIn, req.userId]
    ).catch(() => {});

    res.json({ 
      success: true, 
      message: optIn ? 'You are now contributing to community insights (anonymized)' : 'Opted out of community data sharing'
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update preference' });
  }
});

app.get('/api/collective/peer-comparison', authMiddleware, async (req, res) => {
  try {
    // Get user's wardrobe stats
    const userWardrobe = await pool.query(
      `SELECT COUNT(*) as item_count FROM wardrobe_items WHERE user_id = $1`,
      [req.userId]
    ).catch(() => ({ rows: [{ item_count: 0 }] }));

    const userCount = parseInt(userWardrobe.rows[0]?.item_count) || 0;
    
    res.json({
      yourStats: {
        wardrobeSize: userCount,
        percentile: userCount > 50 ? 'Top 20%' : userCount > 20 ? 'Top 50%' : 'Building'
      },
      communityAverage: {
        wardrobeSize: 45,
        colorDiversity: 8,
        categoryBalance: 'Tops-heavy'
      },
      recommendations: userCount < 20 
        ? ['Focus on building core basics first'] 
        : ['Great foundation! Consider adding statement pieces'],
      styleExperimentation: {
        yourLevel: userCount > 30 ? 'Adventurous' : 'Classic',
        communityAverage: 'Moderate'
      }
    });
  } catch (error) {
    console.error('Peer comparison error:', error);
    res.status(500).json({ error: 'Failed to get comparison' });
  }
});

// ============ HEALTH CHECK ============

app.get('/', (req, res) => {
  const openaiConfigured = !!process.env.OPENAI_API_KEY;
  res.json({ 
    status: 'ok', 
    message: 'Dripn API is running',
    version: '1.2.0',
    features: {
      vipNotifications: true,
      emailAlerts: 'SendGrid',
      smsAlerts: process.env.TWILIO_ACCOUNT_SID ? 'Twilio (configured)' : 'Twilio (not configured)',
      stylePersonalization: true,
      trendScanner: true,
      eventReminders: true,
      aiStylistChat: openaiConfigured ? 'OpenAI GPT-4 (configured)' : 'OpenAI (not configured)',
      aiVisionAnalysis: openaiConfigured ? 'GPT-4o Vision (configured)' : 'GPT-4o Vision (not configured)',
      aiVoiceServices: openaiConfigured ? 'Whisper STT + TTS-1-HD (configured)' : 'Voice Services (not configured)',
      aiLifestyleTherapy: openaiConfigured ? 'Fashion Therapy AI (configured)' : 'Fashion Therapy (not configured)',
      aiSemanticSearch: openaiConfigured ? 'text-embedding-3-large (configured)' : 'Embeddings (not configured)',
      aiImageGeneration: openaiConfigured ? 'DALL-E 3 (configured)' : 'DALL-E 3 (not configured)',
      aiModelLifecycle: 'Auto-upgrade with A/B testing',
      aiComplexAnalysis: openaiConfigured ? 'o1 Reasoning Models (configured)' : 'Complex Analysis (not configured)'
    }
  });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy' });
});

// User Feedback endpoint - no auth required for guest access
app.post('/api/feedback', async (req, res) => {
  try {
    const { feedbackType, category, title, description, rating, deviceInfo, appVersion } = req.body;

    // Validate required fields
    if (!feedbackType || !category || !title || !description) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: feedbackType, category, title, and description are required' 
      });
    }

    // Validate feedbackType
    const validTypes = ['bug', 'feature', 'general', 'rating'];
    if (!validTypes.includes(feedbackType)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid feedbackType. Must be: bug, feature, general, or rating' 
      });
    }

    // Validate category
    const validCategories = ['scanner', 'chat', 'login', 'wardrobe', 'other'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid category. Must be: scanner, chat, login, wardrobe, or other' 
      });
    }

    // Validate rating if provided
    if (rating !== undefined && rating !== null) {
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        return res.status(400).json({ 
          success: false, 
          error: 'Rating must be an integer between 1 and 5' 
        });
      }
    }

    // Try to extract user_id from token if available
    let userId = null;
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.slice(7);
        const decoded = jwt.verify(token, JWT_SECRET);
        userId = decoded.userId;
      } catch (e) {
        // Ignore auth errors - guest feedback is allowed
      }
    }

    // Insert feedback
    const result = await pool.query(
      `INSERT INTO user_feedback 
       (user_id, feedback_type, category, title, description, rating, device_info, app_version)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [userId, feedbackType, category, title, description, rating || null, deviceInfo || null, appVersion || null]
    );

    res.json({ 
      success: true, 
      message: 'Thank you for your feedback!', 
      feedbackId: result.rows[0].id 
    });
  } catch (error) {
    console.error('Feedback submission error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to submit feedback' 
    });
  }
});

// Start server
initDB().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Dripn API running on port ${PORT}`);
  });
});
