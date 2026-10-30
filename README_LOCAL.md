# 🎨 Background Remover Pro - Local Setup

A professional product image background removal tool with Gemini AI enhancement, running locally with the same architecture as the VibeHost app.

## Features

✨ **Core Features:**
- Background removal from product images
- Gemini AI enhancement for professional catalog-style output
- 1400×1400px output with 100px white padding
- Real-time batch processing
- Multiple format support (PNG, JPEG, WebP, etc.)
- Identical UI to the hosted version

## Quick Start

### 1. **Install Prerequisites**

- **Node.js 18+**: Download from https://nodejs.org/
- **npm**: Comes with Node.js automatically

### 2. **Launch the App**

**Option A - Simple (Recommended):**
- Double-click **"Background Remover Pro"** on your desktop

**Option B - Manual:**
- Navigate to `C:\Users\KrishnaKishoreSabbi\Documents\Davinic_New`
- Double-click **`run.bat`**

### 3. **First Launch**

On first run, the app will:
1. Install all dependencies (2-5 minutes)
2. Build the frontend
3. Start the backend server
4. Automatically open in your browser at `http://localhost:8080`

## How to Use

### Basic Workflow

1. **Select Mode** (Top tabs):
   - **Single**: Upload one image at a time
   - **Local**: Batch upload multiple images
   - **Excel**: Load images from an Excel file (with URLs)

2. **Upload Image**:
   - Drag and drop or click to select
   - Support for: PNG, JPG, WebP, BMP, GIF

3. **Configure Settings** (Left sidebar):
   - **Background**: White, transparent, or color
   - **Format**: PNG or JPEG
   - **Size**: 1400px (default for catalog use)
   - **Padding**: 100px white border
   - **Enhancement**: Sharpen, contrast, saturation
   - **🤖 Gemini AI**: Toggle for AI enhancement (if enabled)

4. **Process**:
   - Click "Re-run (apply settings)" to process
   - View before/after comparison

5. **Download**:
   - Click download button on any processed image
   - Choose PNG (transparent) or JPEG

### Advanced Settings

**Gemini AI Enhancement:**
- Toggle **"🤖 Gemini AI Enhancement"** in sidebar
- Processing: ~10-30 seconds per image
- Output: 1400×1400px with guaranteed specifications
- Preserves text sharpness and removes shadows

**Batch Processing:**
- Upload multiple images in "Local" mode
- Toggle "🤖 Gemini AI Enhancement" to apply to all
- Click "Enhance All" to process everything
- Download results individually or as combo pack

## Configuration

### API Key

The Gemini API key is configured in `secrets.json`:

```json
[
  {
    "GEMINI_API_KEY": "sk-Q__STd0fACvfAngbVrfzKg"
  }
]
```

**Already configured!** ✅ No additional setup needed.

### Environment

If you need to modify settings, check:
- `.env.local` - Environment variables
- `secrets.json` - API credentials
- `vite.config.js` - Frontend build config
- `package.json` - Dependencies and scripts

## Project Structure

```
Davinic_New/
├── index.html              # Entry point
├── package.json            # Dependencies & scripts
├── vite.config.js          # Frontend build config
├── secrets.json            # API key storage
├── run.bat                 # Launcher script
├── run-dev.bat             # Development launcher (hot reload)
│
├── src/                    # React frontend
│   ├── App.jsx             # Main component
│   ├── main.jsx            # React entry point
│   ├── index.css           # Styles
│   └── components/         # UI components
│
├── server/                 # Node.js backend
│   ├── index.js            # Express app
│   ├── logger.js           # Logging
│   ├── secrets.js          # Secret management
│   └── routes/
│       ├── proxy.js        # API proxies & Gemini
│       └── health.js       # Health check
│
├── public/                 # Static assets
│   ├── app.js              # Core processing logic
│   └── vendor/             # External libraries
│
└── dist/                   # Built frontend (created on build)
```

## Development Mode

For development with hot reload:

```bash
# In the app folder, double-click: run-dev.bat
# OR manually:
npm run dev
```

This will:
- Start frontend dev server at `http://localhost:8080`
- Start backend at `http://localhost:3001`
- Auto-reload on file changes

## Common Issues & Solutions

### "Node.js is not installed"
- Install from https://nodejs.org/
- Restart your computer
- Try again

### Dependencies won't install
- Delete `node_modules` folder
- Close any open terminals
- Double-click `run.bat` again

### Port 8080 already in use
- Close other applications using port 8080
- Or modify `vite.config.js` to use a different port

### "Gemini enhancement failed: SSL certificate error"
- ✅ This is fixed! The app now ignores self-signed certificate errors
- If still occurring, ensure you're using the latest version

### Backend not connecting
- Check if backend started successfully
- Look for "server started" message in terminal
- Ensure firewall allows localhost connections

### Images won't upload
- Check file format (PNG, JPG, WebP, etc.)
- Ensure file size < 200MB
- Try a different image

### Enhancement is slow
- First image: 15-30 seconds (normal)
- Subsequent images: 10-20 seconds
- Large images take longer

## API & Backend

### REST Endpoints

**Health Check:**
```
GET /api/health
```

**Background Removal (HuggingFace):**
```
GET /api/hf/<model-path>
```

**Image Proxy:**
```
GET /api/img?url=<image-url>
```

**Gemini AI Enhancement:**
```
POST /api/ai-enhance
Headers: x-user-email: <email>
Body: { image: "<base64>", mime: "image/png" }
```

### Server Logs

The backend logs important events:
- Successful API calls
- Errors with full details
- Performance metrics
- User actions (when enabled)

Check browser console (F12) for frontend logs.

## System Requirements

- **OS**: Windows 10 or 11
- **RAM**: 2GB minimum (4GB recommended for batch processing)
- **Disk Space**: 1GB for dependencies
- **Node.js**: 18.0 or higher
- **Internet**: Required for Gemini API calls

## Performance Tips

1. **First Run**: Takes longer as all dependencies download (~2-5 minutes)
2. **Subsequent Runs**: Instant startup (just npm start)
3. **Batch Processing**: Process 5-10 images per batch for stability
4. **Large Images**: Resize to < 2000px width for faster processing
5. **Close Background Apps**: Free up RAM for faster processing

## Troubleshooting Commands

Open terminal in app folder and run:

```bash
# Clear all dependencies and reinstall
rmdir /s /q node_modules
npm install

# Clear build cache
rmdir /s /q dist
npm run build

# Check Node.js version
node --version

# Check npm version
npm --version

# Run directly without build
npm run start
```

## Security & Privacy

🔒 **Important:**
- API key stored locally only (not transmitted except to Gemini API)
- Images only sent to Gemini when enhancement enabled
- All processing on your machine (except Gemini API)
- Network isolation: only `localhost` connections

## Support & Troubleshooting

**Before asking for help:**
1. Check browser console (F12 → Console tab)
2. Check backend terminal for error messages
3. Ensure Node.js and npm are correctly installed
4. Try restarting the app
5. Delete `node_modules` and reinstall

**Common error codes:**
- `503`: API key not configured
- `502`: Gemini API unreachable
- `400`: Invalid image format
- `413`: Image too large

## License

© 2026 Davinic. All rights reserved.

---

**Need help?** Check the GEMINI_SETUP.md and IMPLEMENTATION_SUMMARY.md files in the app folder for detailed technical information.

**Enjoy removing backgrounds and enhancing your product images!** 🎨✨
