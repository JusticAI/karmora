#!/bin/bash
# Karmora deploy script
set -e

echo "🚀 Karmora 部署到 Vercel"
echo "=================="

# 确保登录
echo "1. Checking Vercel login..."
npx vercel whoami 2>/dev/null || {
    echo "Please run: npx vercel login"
    echo "Then re-run this script."
    exit 1
}

# 添加环境变量
echo "2. Setting up Supabase credentials..."
npx vercel env add SUPABASE_URL <<< "https://hglgjtmasverfapdnwsh.supabase.co"
npx vercel env add SUPABASE_SERVICE_KEY <<< "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhnbGdqdG1hc3ZlcmZhcGRud3NoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzUzMjcxMiwiZXhwIjoyMDkzMTA4NzEyfQ.1HDPjlDAJxvzxTP8ewgqV7gePy9BB4huyjbKbaD6-5M"
npx vercel env add ADMIN_PASSWORD <<< "karmora-admin-2026"

# 部署
echo "3. Deploying..."
npx vercel --prod

echo ""
echo "✅ 部署完成！"
echo "   前端: https://karmora.vercel.app"
echo "   Admin: https://karmora.vercel.app/admin"
echo "   API: https://karmora.vercel.app/api/apply"
