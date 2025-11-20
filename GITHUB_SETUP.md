# GitHub 上传完整指南

## 📝 第一步：在 GitHub 上创建仓库

### 1.1 进入 GitHub
- 访问 https://github.com
- 登录你的 GitHub 账户（如果没有，先注册）

### 1.2 创建新仓库
1. 点击右上角头像 → **Your repositories**
2. 点击绿色的 **New** 按钮
3. 填写仓库信息：
   - **Repository name**: `AI-Chat-System` （或任意名称）
   - **Description**: `🤖 AI Chat System with FastAPI + Vue 3 - Multi-session dialogue, DeepSeek integration, persistent storage`
   - **Visibility**: 选择 `Public`（公开）或 `Private`（私有）
   - **Initialize this repository**: **不要** 勾选任何选项
4. 点击 **Create repository**

### 1.3 复制仓库地址
创建成功后，你会看到仓库页面。复制页面上显示的 HTTPS 地址：
```
https://github.com/YOUR_USERNAME/AI-Chat-System.git
```

---

## 🔗 第二步：连接本地仓库到 GitHub

在你的项目目录下运行以下命令：

```powershell
cd "c:\Users\21222\Desktop\2304010519王培宇"

# 添加远程仓库
git remote add origin https://github.com/YOUR_USERNAME/AI-Chat-System.git

# 重命名默认分支（如果需要）
git branch -M main

# 推送到 GitHub
git push -u origin main
```

### 注意：
- 将 `YOUR_USERNAME` 替换为你的 GitHub 用户名
- 将 `AI-Chat-System` 替换为你创建的仓库名称

---

## 🔐 第三步：GitHub 身份验证

### 方法 A：使用 Personal Access Token（推荐）

#### 3A.1 生成 Token
1. 进入 https://github.com/settings/tokens
2. 点击 **Generate new token** → **Generate new token (classic)**
3. 填写信息：
   - **Note**: `AI Chat System`
   - **Expiration**: 选择 `90 days` 或 `No expiration`
   - **Select scopes**: 勾选 `repo`（所有仓库权限）
4. 点击 **Generate token**
5. **复制生成的 token**（只会显示一次！）

#### 3A.2 使用 Token 推送
```powershell
# 当要求输入密码时，粘贴你的 Personal Access Token
git push -u origin main
```

### 方法 B：使用 SSH（更安全，但配置复杂）
参考 GitHub 官方文档：https://docs.github.com/en/authentication/connecting-to-github-with-ssh

---

## 📤 第四步：推送到 GitHub

```powershell
cd "c:\Users\21222\Desktop\2304010519王培宇"

# 检查远程仓库配置
git remote -v

# 推送本地仓库到 GitHub
git push -u origin main
```

---

## ✅ 完成后的验证

1. 打开你的 GitHub 仓库页面：`https://github.com/YOUR_USERNAME/AI-Chat-System`
2. 你应该能看到所有文件都已上传
3. README.md 会自动显示为项目首页

---

## 📝 日常工作流程

### 修改文件后更新 GitHub

```powershell
# 1. 查看改动
git status

# 2. 暂存改动
git add .

# 3. 创建提交
git commit -m "描述你的改动"

# 4. 推送到 GitHub
git push
```

### 常用命令

```powershell
# 查看提交历史
git log --oneline

# 查看分支
git branch -a

# 创建新分支
git checkout -b feature/new-feature

# 切换分支
git checkout main

# 拉取最新改动
git pull
```

---

## 🎨 美化你的 GitHub 仓库

### 添加 GitHub Topics
1. 进入仓库设置页面
2. 在 **Topics** 输入框添加标签：
   - `ai-chat`
   - `fastapi`
   - `vue3`
   - `chatbot`
   - `deepseek`

### 添加许可证
1. 进入仓库主页
2. 点击 **Add file** → **Create new file**
3. 文件名：`LICENSE`
4. 选择许可证模板（如 MIT）

---

## 🐛 常见问题

### Q1: 推送时出现 "fatal: could not read Username"
**答**: 使用 Personal Access Token 或配置 SSH 密钥

### Q2: 提交信息格式要求
**答**: 建议使用规范的提交信息：
```
git commit -m "feat: 添加新功能"
git commit -m "fix: 修复 bug"
git commit -m "docs: 更新文档"
git commit -m "style: 代码格式调整"
```

### Q3: 如何删除已提交的文件
```powershell
git rm --cached filename
git commit -m "Remove filename"
git push
```

### Q4: 如何撤销最后一次提交
```powershell
# 保留改动
git reset --soft HEAD~1

# 不保留改动
git reset --hard HEAD~1
```

---

## 🚀 推送后的下一步

1. **分享你的项目**
   - 在社区分享：Reddit、Twitter、微博等
   - 提交到项目列表：Awesome Lists

2. **邀请协作者**
   - Settings → Collaborators → 添加用户

3. **配置 CI/CD**
   - 使用 GitHub Actions 自动化测试和部署

4. **获取反馈**
   - 启用 Issues 接收反馈
   - 启用 Discussions 讨论功能

---

## 📚 相关资源

- [GitHub 官方文档](https://docs.github.com)
- [Git 官方文档](https://git-scm.com/doc)
- [GitHub 快速入门](https://docs.github.com/en/get-started/quickstart)

---

**祝你成功！** 🎉

如有任何问题，查看 GitHub 的官方帮助或在 Stack Overflow 搜索。
