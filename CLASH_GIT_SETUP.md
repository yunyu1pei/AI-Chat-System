# Clash 配置 Git 代理完整指南

## 📋 前置要求

1. ✅ 已安装 Clash（Clash for Windows 或 Clash Meta）
2. ✅ Clash 正在运行中
3. ✅ 已安装 Git

---

## 🔧 配置步骤

### 第一步：确认 Clash 配置

打开 Clash 应用，记下以下信息：

```
Settings / 设置
├─ Port: 7890           (HTTP 代理端口)
├─ Socks Port: 7891     (SOCKS5 代理端口)
└─ 允许局域网连接: ✓    (如果本机访问)
```

> **注意：** 不同版本 Clash 端口可能不同，一般默认是 `7890` (HTTP) 或 `7891` (SOCKS5)

---

## 🌐 方式 A：使用 HTTP 代理（推荐）

### PowerShell 配置

```powershell
# ===== 设置 Git 全局代理 =====

# 1. 设置 HTTP 代理
git config --global http.proxy http://127.0.0.1:7890

# 2. 设置 HTTPS 代理
git config --global https.proxy http://127.0.0.1:7890

# 3. 查看配置
git config --global --list | findstr proxy

# ===== 验证配置 =====
# 输出应该显示：
# http.proxy=http://127.0.0.1:7890
# https.proxy=http://127.0.0.1:7890
```

### 取消代理

```powershell
# 取消 HTTP 代理
git config --global --unset http.proxy

# 取消 HTTPS 代理
git config --global --unset https.proxy

# 验证已取消
git config --global --list | findstr proxy
# （应该没有输出）
```

---

## 🔒 方式 B：使用 SOCKS5 代理

### PowerShell 配置

```powershell
# ===== 设置 SOCKS5 代理 =====

# 1. 设置 HTTP over SOCKS5
git config --global http.proxy socks5://127.0.0.1:7891

# 2. 设置 HTTPS over SOCKS5
git config --global https.proxy socks5://127.0.0.1:7891

# 3. 查看配置
git config --global --list | findstr proxy
```

---

## 🎯 方式 C：只为特定域名设置代理

适合只代理 GitHub 等特定网站：

```powershell
# ===== 只为 GitHub 配置代理 =====

# GitHub HTTP
git config --global http.https://github.com.proxy http://127.0.0.1:7890

# GitHub HTTPS
git config --global https.https://github.com.proxy http://127.0.0.1:7890

# GitLab HTTP
git config --global http.https://gitlab.com.proxy http://127.0.0.1:7890

# GitLab HTTPS
git config --global https.https://gitlab.com.proxy http://127.0.0.1:7890

# ===== 查看所有代理配置 =====
git config --global --list | findstr proxy
```

---

## 📝 配置文件方式

### 直接编辑 Git 配置文件

#### 位置
- **Windows**: `C:\Users\你的用户名\.gitconfig`
- **Mac/Linux**: `~/.gitconfig`

#### 编辑方式

```powershell
# 用记事本打开
notepad $env:USERPROFILE\.gitconfig

# 或者用 VS Code 打开
code $env:USERPROFILE\.gitconfig
```

#### 内容示例

```ini
[user]
    name = Your Name
    email = your-email@example.com

[http]
    proxy = http://127.0.0.1:7890

[https]
    proxy = http://127.0.0.1:7890

# 只为 GitHub 代理
[http "https://github.com"]
    proxy = http://127.0.0.1:7890

[https "https://github.com"]
    proxy = http://127.0.0.1:7890
```

---

## ✅ 测试代理是否生效

### 方法 1：测试 GitHub 连接

```powershell
# 测试 git 连接
git ls-remote https://github.com/yunyu1pei/AI-Chat-System.git

# 如果成功，会返回仓库的分支和 commit 信息
# 如果失败，会显示连接错误
```

### 方法 2：查看 Git 配置

```powershell
# 查看所有全局配置
git config --global --list

# 查看特定项
git config --global http.proxy

# 查看系统配置
git config --system --list

# 查看本地仓库配置
cd "c:\Users\21222\Desktop\2304010519王培宇"
git config --local --list
```

### 方法 3：实际 Git 操作

```powershell
# 尝试 clone 一个仓库
git clone https://github.com/yunyu1pei/AI-Chat-System.git test-clone

# 或者 push/pull 时观察速度
git push origin main
```

---

## 🚀 实际应用

### 场景 1：推送代码到 GitHub

```powershell
# 1. 确保 Clash 在运行

# 2. 配置代理
git config --global http.proxy http://127.0.0.1:7890
git config --global https.proxy http://127.0.0.1:7890

# 3. 进入项目目录
cd "c:\Users\21222\Desktop\2304010519王培宇"

# 4. 添加远程仓库
git remote add origin https://github.com/yunyu1pei/AI-Chat-System.git

# 5. 推送（会通过 Clash 代理）
git push -u origin main
# ↑ 通过代理加速上传
```

### 场景 2：克隆仓库

```powershell
# 使用代理克隆
git clone https://github.com/username/repo.git

# 会通过 Clash 代理下载，速度更快
```

### 场景 3：拉取更新

```powershell
# 进入仓库目录
cd my-repo

# 拉取更新（通过代理）
git pull

# 查看日志
git log --oneline
```

---

## 🔍 调试代理问题

### 问题 1：连接超时

```powershell
# 原因：Clash 未运行或端口不对

# 解决：
# 1. 检查 Clash 是否运行
# 2. 检查端口号是否正确
# 3. 检查防火墙设置

# 临时移除代理测试
git config --global --unset http.proxy
git config --global --unset https.proxy
git push  # 不通过代理测试
```

### 问题 2：代理验证失败

```powershell
# 原因：代理需要认证

# 解决：配置带认证的代理
git config --global http.proxy http://username:password@127.0.0.1:7890

# Clash 一般不需要认证，如果需要检查 Clash 设置
```

### 问题 3：某些网站还是很慢

```powershell
# 原因：代理线路可能拥挤或配置不优

# 解决：
# 1. 检查 Clash 规则是否正确
# 2. 尝试切换不同的代理节点
# 3. 只为 GitHub 设置代理（见方式 C）
```

### 启用 Git 调试

```powershell
# 查看详细的 Git 操作信息
GIT_TRACE=1 git push

# 查看 HTTP 详情
GIT_CURL_VERBOSE=1 git clone https://github.com/user/repo.git

# 查看 SSH 调试
GIT_SSH_COMMAND="ssh -v" git pull
```

---

## ⚙️ 高级配置

### 分离场景配置

有时你想在公司网络用代理，在家用直连：

#### 方法 1：条件配置

```ini
# ~/.gitconfig

[user]
    name = Your Name
    email = your-email@example.com

# 全局配置（通常是直连）
[http]
    proxy = ""

# GitHub 特殊配置（代理）
[http "https://github.com"]
    proxy = http://127.0.0.1:7890
```

#### 方法 2：根据仓库位置

```bash
# Windows PowerShell
$PROFILE_PATH = "c:\Users\21222\Desktop\2304010519王培宇"

cd $PROFILE_PATH

# 只为这个仓库设置代理
git config --local http.proxy http://127.0.0.1:7890

# 查看本地配置
git config --local --list
```

### 认证配置（如果需要）

```powershell
# 保存 GitHub 认证信息
git config --global credential.helper wincred

# 或使用 Token
git config --global user.name "Your Name"
git config --global user.email "your-email@example.com"

# 首次 push 时会提示输入 Token
git push origin main
# Username: your-username
# Password: ghp_xxxxxxxxxxxxxxxxxxxxxxxx（Personal Access Token）
```

---

## 📊 配置优先级（从高到低）

```
本地配置 (--local)
    ↓ 覆盖
系统配置 (--global)
    ↓ 覆盖
全局配置 (--system)
```

**查看所有配置：**
```powershell
# 本地配置
git config --local --list

# 全局配置
git config --global --list

# 系统配置
git config --system --list

# 所有配置
git config --list
```

---

## 🎯 快速参考

### 启用代理

```powershell
# HTTP 代理
git config --global http.proxy http://127.0.0.1:7890
git config --global https.proxy http://127.0.0.1:7890

# 验证
git config --global --list | findstr proxy
```

### 禁用代理

```powershell
# 移除 HTTP 代理
git config --global --unset http.proxy
git config --global --unset https.proxy

# 验证
git config --global --list | findstr proxy
```

### 仅代理 GitHub

```powershell
git config --global http.https://github.com.proxy http://127.0.0.1:7890
git config --global https.https://github.com.proxy http://127.0.0.1:7890
```

### 测试连接

```powershell
git ls-remote https://github.com/yunyu1pei/AI-Chat-System.git
```

---

## 🔗 常见端口

| 代理类型 | 端口 | 说明 |
|---------|------|------|
| **HTTP** | 7890 | Clash for Windows 默认 |
| **SOCKS5** | 7891 | Clash SOCKS5 代理 |
| **HTTP** | 1080 | V2Ray、Shadowsocks 等 |
| **SOCKS5** | 1080 | V2Ray、Shadowsocks 等 |

> 根据你的代理工具具体配置调整

---

## 💡 建议

1. **优先使用 HTTP 代理** - 比 SOCKS5 更稳定
2. **只为特定域名代理** - 提高整体速度
3. **定期验证代理** - 确保配置仍然有效
4. **备份 .gitconfig** - 方便恢复

---

## ✨ 完整工作流程

```powershell
# 1. 启动 Clash

# 2. 配置 Git 代理
git config --global http.proxy http://127.0.0.1:7890
git config --global https.proxy http://127.0.0.1:7890

# 3. 进入项目
cd "c:\Users\21222\Desktop\2304010519王培宇"

# 4. 配置远程仓库
git remote add origin https://github.com/yunyu1pei/AI-Chat-System.git

# 5. 推送代码
git push -u origin main
# ↑ 通过 Clash 代理上传，速度快！

# 6. 日常更新
git pull
git push
```

---

**现在你已经可以通过 Clash 代理加速 Git 操作了！** 🚀

如有问题，检查 Clash 是否运行，确认端口号正确即可。
