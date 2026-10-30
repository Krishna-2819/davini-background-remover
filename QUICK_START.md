# Quick Start: Gemini AI Enhancement

## ⚡ 3-Minute Setup

### Step 1: Add API Key
Pick your deployment method:

**Local Dev:**
```bash
# Create .env.local in project root
GEMINI_API_KEY=sk-K9jC93baj_qUKZKOWfM92A
```

**VibeHost:**
- Go to App Settings → Environment Secrets
- Add: `GEMINI_API_KEY = sk-K9jC93baj_qUKZKOWfM92A`
- Redeploy

**Docker:**
```bash
docker run -e GEMINI_API_KEY="sk-..." image-name
```

### Step 2: Restart
- **Local**: Press Ctrl+C, run `npm run dev`
- **VibeHost**: Click "Redeploy" or restart in dashboard
- **Docker**: Restart container

### Step 3: Test
1. Open app at `https://bg-remover.lths.ai` (or `localhost:5173` for dev)
2. Drop a product image
3. **Left sidebar → Enhance section → toggle "🤖 Gemini AI Enhancement" ON**
4. Click "Auto remove backgrounds"
5. Watch status update to "Enhancing with Gemini AI…"
6. Download result (1400×1400px, 100px white padding)

---

## 🎯 What Users See

### Toggle Location
```
┌─ Left Sidebar ─┐
│ ...            │
│ [Enhance]      │
│ ☑ Enhance ...  │
│   Sharpen, etc.│
│                │
│ ☑ 🤖 Gemini... │  ← NEW TOGGLE
│   "When enable" │
│                │
│ ☑ Auto-crop    │
└────────────────┘
```

### Status Messages
- ✓ "Enhancing with Gemini AI…" → Processing
- ✓ "done" → Complete, download available
- ✗ "Gemini enhancement failed, using local…" → Fell back to local processing

---

## 📋 Verification Checklist

After setup, verify:

- [ ] No errors when server starts
- [ ] Toggle appears in UI (🤖 Gemini AI Enhancement)
- [ ] Can enable/disable toggle without errors
- [ ] Browser console (F12) shows no red errors
- [ ] Test image processes and downloads

### Server Logs to Check
```bash
# If running locally: watch for these messages
npm run dev

# Should see:
# ✓ "server started, port 3001"
# When you enhance an image:
# ✓ "POST /api/ai-enhance" (or similar)
# If error: "ai-enhance failed" with details
```

---

## ⚠️ Common Issues & Fixes

| Problem | Solution |
|---------|----------|
| Toggle doesn't show | Hard refresh: Ctrl+Shift+R |
| "Not configured" error | API key not in environment, restart server |
| "Failed" message | Check API key is correct, try again |
| Long wait (30s+) | Normal first time, subsequent runs faster |
| No change to image | Make sure toggle is actually ON (checked) |

---

## 🔒 Security Reminders

⚠️ **CRITICAL**: Do NOT:
- Put API key in index.html or public/app.js
- Commit .env.local to git
- Share API key in messages or screenshots
- Use in URL parameters

✅ **DO**:
- Keep API key in `.env.local` (local) or env secrets (hosting)
- Check `.gitignore` has `.env*` entries
- Verify `server/routes/proxy.js` is only backend reading the key

---

## 📊 Quick Reference

### What Gemini Does
```
Input Image
    ↓
Processes with strict requirements
    ↓
Output: 1400×1400 px
         100 px white padding
         Solid white background
         Enhanced clarity
         Same product (never substituted)
         All logos/text preserved
```

### What Stays the Same
- Background removal logic (HuggingFace model)
- Local enhancement options (still work)
- Download format (PNG/JPEG choice)
- Everything else in the app

---

## 💬 Ask For Help

**Check these first:**
1. Read **IMPLEMENTATION_SUMMARY.md** for full details
2. Read **GEMINI_SETUP.md** for troubleshooting
3. Check browser console (F12 → Console tab)
4. Check server logs for error details

---

## ✨ That's It!

You now have Gemini-powered product image enhancement with:
- Guaranteed 1400×1400 output
- 100px white padding
- Strict enhancement (no guessing)
- One-click toggle in the UI
- Automatic fallback if Gemini fails

**Ready to process images!** 🎨
