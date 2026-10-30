# Gemini AI Image Enhancement Setup

## Overview

The Gemini AI Enhancement feature processes product images with the following guarantees:

- **Output dimensions**: Exactly 1400×1400 pixels
- **Padding**: 100 pixels of solid white (#FFFFFF) on all sides
- **Content area**: 1200×1200 pixels in the center
- **Processing**: Strict enhancement of the input image—no packaging substitutions or AI-generated alternatives
- **Background**: Solid white, no gradients or variations
- **Quality**: Preserves all text, logos, and product features exactly as they appear

## Configuration

### 1. Set Your Gemini API Key

The app reads your API key from the environment variable `GEMINI_API_KEY`. Do NOT commit this to version control.

#### For Local Development:

Create a `.env.local` file in the project root:

```bash
GEMINI_API_KEY=sk-K9jC93baj_qUKZKOWfM92A
```

Then start your server (the key will be loaded automatically).

#### For VibeHost Deployment:

Add the secret via the VibeHost dashboard or CLI:

```bash
# Using VibeHost CLI (if available)
vibehost secrets add GEMINI_API_KEY "sk-K9jC93baj_qUKZKOWfM92A"
```

Or manage it through the VibeHost UI under App Settings → Secrets.

#### For Docker/Container Deployment:

Pass the environment variable when starting:

```bash
docker run -e GEMINI_API_KEY="sk-..." your-image
```

Or add it to your `docker-compose.yml`:

```yaml
environment:
  - GEMINI_API_KEY=sk-...
```

### 2. Verify Setup

Test the endpoint before using in production. The app will log a warning if `GEMINI_API_KEY` is not configured.

When you toggle "🤖 Gemini AI Enhancement" ON and process an image:
- You'll see the status change to "Enhancing with Gemini AI…"
- The enhanced image will be generated with the spec above
- If there's an error, it falls back to local processing and shows the error message

## Usage

1. **Upload or load an image** in the main interface
2. **Toggle "🤖 Gemini AI Enhancement"** in the Enhance section of the left sidebar
3. **Click "Auto remove backgrounds"** or "Re-run (apply settings)"
4. The image will be processed through Gemini with your exact specs
5. Download the result

## API Costs

Each enhanced image makes one call to Gemini 1.5 Flash. Costs are per-request based on Google's pricing. Monitor your usage in the [Google Cloud Console](https://console.cloud.google.com).

## Prompt Details

The system uses a strict prompt that forbids:
- ❌ Different packaging/product substitution
- ❌ AI-generated alternatives
- ❌ Guessing or interpretation beyond the input image

It enforces:
- ✅ Exact output dimensions (1400×1400)
- ✅ Exact padding (100px white on all sides)
- ✅ Identical product as input
- ✅ Enhanced clarity and sharpness
- ✅ Preserved text and logos
- ✅ Solid white background

## Troubleshooting

### "API enhancement not configured on server"

The `GEMINI_API_KEY` environment variable is not set.

**Fix**: Add the API key to your environment (see Configuration above).

### "Gemini enhancement failed: …"

The API request had an error. Possible causes:

- Invalid API key
- Network connectivity issue
- Rate limiting (too many requests)
- Image format or size issues

**Fix**: Check your API key, try again, or contact support.

### Enhancement not triggering

Make sure:
1. ✅ The toggle is ON (checkbox is checked)
2. ✅ You clicked "Auto remove backgrounds" or "Re-run (apply settings)"
3. ✅ The server restarted after adding the API key
4. ✅ Check browser console for errors (F12 → Console tab)

## Security Notes

- **Never commit API keys** to git. Use `.env` files or environment variables.
- **`.env.local` should be in `.gitignore`** to prevent accidental commits.
- The API key is only used by the backend—it never reaches the browser.
- Each request is authenticated server-side.

## Performance

- First request may take 15–30 seconds (model warm-up)
- Subsequent requests typically 10–20 seconds
- Processing happens asynchronously; UI shows progress

## Fallback Behavior

If Gemini enhancement fails, the app automatically:
1. Logs the error
2. Falls back to local enhancement (sharpen, contrast, etc.)
3. Displays a helpful error message
4. Allows you to download the local-processed version

---

**Questions?** Check the browser console (F12) for detailed error logs.
