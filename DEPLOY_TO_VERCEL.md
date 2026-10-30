# 🚀 Deploy to Vercel - Step by Step Guide

This guide will help you deploy your Background Remover app to Vercel in 10 minutes.

## ✅ Prerequisites

- GitHub account (free at github.com)
- Vercel account (free at vercel.com)
- Your Gemini API key: `sk-Q__STd0fACvfAngbVrfzKg`

---

## 📋 Step 1: Create GitHub Repository

### Option A: Using GitHub Web Interface (Easiest)

1. **Go to GitHub.com and sign in** (or create free account)
2. **Click "+" → "New repository"**
3. **Repository settings:**
   - Name: `background-remover` (or your choice)
   - Description: `Background Remover Pro - Remove product image backgrounds with Gemini AI`
   - Public (anyone can see) or Private (only you)
   - Check: "Add a README file"
   - Click **"Create repository"**

4. **Upload files to GitHub:**
   - Click **"Add file" → "Upload files"**
   - Drag and drop the `Davinic_New` folder contents
   - Or select files from your computer:
     - `src/` folder
     - `server/` folder
     - `public/` folder
     - `package.json`
     - `vite.config.js`
     - `index.html`
     - `vercel.json`
     - `.gitignore`
   - Message: `Initial commit - Background Remover app`
   - Click **"Commit changes"**

---

## 🔗 Step 2: Connect to Vercel

1. **Go to Vercel.com** and sign up (free)
2. **Sign in with GitHub**
3. Click **"Import Project"**
4. **Select your repository** (background-remover)
5. **Vercel detects your project automatically:**
   - Framework: React (auto-detected ✓)
   - Build Command: `npm run build` (auto-filled ✓)
   - Output Directory: `dist` (auto-filled ✓)

6. **Click "Deploy"**

⏳ *Wait 2-3 minutes for build to complete*

---

## 🔐 Step 3: Add Secrets (API Key)

1. **In Vercel dashboard, go to your project**
2. **Click "Settings" → "Environment Variables"**
3. **Add environment variable:**
   - Name: `GEMINI_API_KEY`
   - Value: `sk-Q__STd0fACvfAngbVrfzKg`
   - Environments: Select all (Production, Preview, Development)
   - Click **"Save"**

4. **Redeploy with new secrets:**
   - Go to "Deployments"
   - Click the three dots (...) on latest deployment
   - Select "Redeploy"
   - Confirm "Redeploy"

⏳ *Wait 2-3 minutes*

---

## ✨ Step 4: Your App is Live!

Once deployment completes:

### **Your app URL:**
```
https://background-remover.vercel.app
```
(or whatever name you chose)

### **Test it:**
1. Open the URL in your browser
2. Upload an image
3. Click "Remove Background"
4. Toggle "🤖 Gemini AI Enhancement" to test AI
5. Download result

---

## 🎯 Features Live on Vercel

✅ Background removal works  
✅ Gemini AI enhancement enabled  
✅ Batch processing available  
✅ Download images  
✅ Professional catalog-style output  

---

## 🔄 Automatic Deployments

**Every time you push to GitHub:**
1. Vercel automatically detects changes
2. Rebuilds the app
3. Deploys to your URL
4. App goes live in 2-3 minutes

**To update the app:**
```bash
# In GitHub web interface:
# 1. Edit files or upload new versions
# 2. Commit changes
# 3. Vercel auto-deploys
```

---

## 📊 Monitor Your App

**Vercel Dashboard shows:**
- ✅ Deployment status
- 📊 Performance metrics
- 📈 Usage analytics
- 🔍 Error logs
- ⚙️ Environment variables

---

## 🆘 Troubleshooting

### **"Build failed" error**
- Check that all dependencies are in `package.json`
- Check `.gitignore` - should not exclude essential files
- Click "Redeploy" to try again

### **"Cannot find module" error**
- Run `npm install` locally to update `package-lock.json`
- Push the updated lock file to GitHub
- Redeploy on Vercel

### **Gemini API not working**
- Verify `GEMINI_API_KEY` is set in Environment Variables
- Check it's set for all environments (Production, Preview, Development)
- Click "Redeploy"

### **"Port already in use" error**
- Vercel automatically handles ports - this error shouldn't occur
- If it does, clear deployment cache and redeploy

### **Static files not loading**
- Ensure `dist` folder is created by build
- Check `public/` folder files are referenced correctly
- Verify `vite.config.js` is correct

---

## 💾 Backup & Updates

### **Keep your code safe:**
1. Create backups regularly
2. Use GitHub as your main source
3. Never commit secrets to GitHub

### **Update the app:**
1. Edit files locally
2. Push to GitHub
3. Vercel auto-deploys
4. Check deployment in Vercel dashboard

---

## 📱 Custom Domain (Optional)

To use your own domain instead of `vercel.app`:

1. **In Vercel dashboard:**
   - Go to Settings → Domains
   - Add your custom domain
   - Follow DNS configuration instructions
   - Your domain: `myapp.example.com`

---

## 🎉 Success!

Your Background Remover app is now:
- ✅ Live on the internet
- ✅ Accessible from anywhere
- ✅ Running Gemini AI enhancement
- ✅ Backed by GitHub
- ✅ Auto-deploying on changes

**Share your app URL with anyone!**

---

## 📞 Need Help?

- **Vercel Docs:** vercel.com/docs
- **GitHub Help:** github.com/support
- **Check deployment logs:** Vercel Dashboard → Deployments → Click deployment → View logs

---

## 🚀 Next Steps

1. Follow the steps above
2. Share the Vercel URL with your team
3. Monitor usage in Vercel dashboard
4. Update API key if needed
5. Scale up as needed

**Enjoy your live app!** 🎨✨
