# Dripn Backend API

Complete backend server for the Dripn fashion app.

## Quick Setup (5 minutes)

### Step 1: Create New Replit
1. Go to [replit.com](https://replit.com) and click "Create Repl"
2. Choose **Node.js** as the template
3. Name it "dripn-backend"

### Step 2: Copy Files
Copy all the files from this `backend-code` folder into your new Replit:
- `index.js` (main server)
- `package.json` (dependencies)
- `.replit` (run configuration)

### Step 3: Set Up Database
1. In your new Replit, click the "Database" tab in the left sidebar
2. Click "Create Database" to create a PostgreSQL database
3. The DATABASE_URL will be automatically added to your environment

### Step 4: Add OpenAI Key (Optional)
1. Click the "Secrets" tab (lock icon)
2. Add a secret named `OPENAI_API_KEY`
3. Paste your API key from [platform.openai.com](https://platform.openai.com/api-keys)

### Step 5: Run the Server
1. Click the green "Run" button
2. Your API will be live at your Replit URL (shown in the webview)
3. Copy this URL - you'll need it for your Dripn app!

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

After your backend is running, update your Dripn app:
1. Add your backend URL as an environment variable
2. The app will automatically connect to your backend

## Environment Variables

| Variable | Description |
|----------|-------------|
| DATABASE_URL | Auto-set by Replit PostgreSQL |
| OPENAI_API_KEY | Your OpenAI API key (optional) |
| JWT_SECRET | Auto-generated if not set |
