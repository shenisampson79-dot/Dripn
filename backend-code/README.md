# Dripn Backend API

Complete backend server for the Dripn fashion app.

## Quick Setup (5 minutes)

### Step 1: Create New Replit
1. Go to [replit.com](https://replit.com) and click "Create Repl"
2. Choose **Node.js** as the template
3. Name it "dripn-backend"

### Step 2: Copy Files
Copy ALL files from this `backend-code` folder into your new Replit:
- `index.js` (main server)
- `package.json` (dependencies)
- `.replit` (run configuration)
- All service files (`*Service.js`)
- `newsletterTemplates.js`

### Step 3: Set Up Database
1. In your new Replit, click the "Database" tab in the left sidebar
2. Click "Create Database" to create a PostgreSQL database
3. The DATABASE_URL will be automatically added to your environment

### Step 4: Add Required Secrets
1. Click the "Secrets" tab (lock icon)
2. Add these secrets:

| Secret Name | Required | Description |
|-------------|----------|-------------|
| OPENAI_API_KEY | Yes | Your OpenAI API key for AI features |
| JWT_SECRET | Yes (production) | Random string for JWT tokens — server refuses to start in production without this |
| STRIPE_SECRET_KEY | Optional | For payment processing (Render: set with STRIPE_WEBHOOK_SECRET and STRIPE_PUBLISHABLE_KEY) |
| STRIPE_PUBLISHABLE_KEY | Optional | For Stripe frontend config endpoint |
| STRIPE_WEBHOOK_SECRET | Optional | For Stripe webhook signature verification |
| APP_URL | Optional | Public backend URL for checkout redirects and video rooms (e.g. https://dripn-server.onrender.com) |
| SENDGRID_API_KEY | Optional | For email notifications |
| REPLICATE_API_TOKEN | Optional | For virtual try-on feature |

### Step 5: Run the Server
1. Click the green "Run" button
2. Your API will be live at your Replit URL (shown in the webview)
3. Test it by visiting `/api/health` - should show `{"status":"healthy"}`

### Step 6: Deploy for Production
1. Click the "Publish" button (or "Deploy" in some views)
2. Choose "Autoscale" deployment
3. Click "Publish" to deploy
4. Copy the production URL (e.g., `https://dripn-backend.replit.app`)

## API Endpoints

### Authentication
- `POST /api/auth/register` - Create new account
- `POST /api/auth/login` - Sign in
- `GET /api/auth/me` - Get current user (requires token)

### Posts
- `GET /api/posts` - Get all posts
- `POST /api/posts` - Create new post (requires token)
- `GET /api/posts/:id` - Get single post
- `POST /api/posts/:id/like` - Like a post
- `POST /api/posts/:id/comments` - Add comment

### AI Advice
- `POST /api/ai/advice` - Get AI fashion advice (requires token)

## Connecting Your Dripn App

After your backend is deployed, update your Dripn mobile app:

1. Go to your Dripn mobile app Replit project
2. Open the "Secrets" tab
3. Update `EXPO_PUBLIC_API_URL` to your new backend URL:
   - Example: `https://dripn-backend.replit.app`
   - Make sure NOT to include a trailing slash
4. Restart your Expo app to pick up the new URL
5. Test login/signup - it should now work from your mobile device!

## Health Check

Test your backend is running by visiting:
- Development: `http://localhost:3000/api/health`
- Production: `https://your-backend-url.replit.app/api/health`

Should return: `{"status":"healthy"}`

## Environment Variables

| Variable | Description | Auto-Set |
|----------|-------------|----------|
| DATABASE_URL | PostgreSQL connection string | Yes (by Replit) |
| PORT | Server port (default: 3000) | Yes |
| JWT_SECRET | JWT signing secret for auth tokens | No (add manually) |
| OPENAI_API_KEY | OpenAI API key for AI features | No (add manually) |
| STRIPE_SECRET_KEY | Stripe secret key for payments | No (optional) |
| SENDGRID_API_KEY | SendGrid key for emails | No (optional) |
| REPLICATE_API_TOKEN | Replicate key for virtual try-on | No (optional) |
