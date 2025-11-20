"""
═══════════════════════════════════════════════════════════════════════
                     AI 对话系统 - FastAPI 后端
═══════════════════════════════════════════════════════════════════════

功能概述:
  • 多会话支持：每个用户可以创建多个独立的对话会话
  • 消息管理：支持发送、删除、回滚操作
  • 数据持久化：所有会话和消息保存到 JSON 文件
  • DeepSeek 集成：调用 DeepSeek API 获取 AI 回复
  • CORS 支持：允许跨域请求，便于本地开发

架构设计:
  ┌─────────────────────────────────────────┐
  │         Vue 3 前端 (index.html)         │ ← 用户界面
  ├─────────────────────────────────────────┤
  │  HTTP 请求 (JSON API)                  │
  ├─────────────────────────────────────────┤
  │    FastAPI 后端 (main.py)              │ ← 业务逻辑
  │    • 会话管理 (/api/sessions)           │
  │    • 消息处理 (/api/messages)           │
  │    • AI 调用 (DeepSeek)                │
  ├─────────────────────────────────────────┤
  │ 数据存储 (sessions.json)               │ ← 数据持久化
  └─────────────────────────────────────────┘

启动方式:
  pip install fastapi uvicorn[standard] httpx
  uvicorn main:app --reload --port 8000
"""

from __future__ import annotations

import asyncio
import json
import os
from datetime import datetime, timezone
from typing import Dict, List, Any
from uuid import uuid4

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel


# ═════════════════════════════════════════════════════════════════
# 第一部分：数据模型定义
# ═════════════════════════════════════════════════════════════════

class SendMessageIn(BaseModel):
    """用户发送消息的请求体"""
    content: str


class RollbackIn(BaseModel):
    """回滚消息的请求体"""
    to_index: int


# ═════════════════════════════════════════════════════════════════
# 第二部分：全局存储与持久化
# ═════════════════════════════════════════════════════════════════

def now_iso() -> str:
    """获取当前 UTC 时间的 ISO 8601 格式字符串"""
    return datetime.now(timezone.utc).isoformat()


# 全局会话存储 (内存中的字典)
# 结构: { "session_id": { "id": str, "name": str, "messages": [...], "created_at": str, "updated_at": str }, ... }
SESSIONS: Dict[str, Dict[str, Any]] = {}

# 持久化文件配置
PERSISTENCE_FILE = os.getenv("PERSISTENCE_FILE", "sessions.json")
# 异步锁：防止并发写入时数据损坏
persistence_lock = asyncio.Lock()


async def load_sessions_from_file() -> None:
    """
    【启动时调用】从 JSON 文件加载所有会话到内存
    
    流程:
      1. 检查 sessions.json 是否存在
      2. 读取文件内容并解析 JSON
      3. 将数据加载到全局 SESSIONS 字典
      4. 如果出错不会中断应用启动
    """
    global SESSIONS
    try:
        if not os.path.exists(PERSISTENCE_FILE):
            return  # 文件不存在则使用空字典
        
        with open(PERSISTENCE_FILE, "r", encoding="utf-8") as fh:
            data = json.load(fh)
        
        if isinstance(data, dict):
            SESSIONS.clear()
            for k, v in data.items():
                SESSIONS[k] = v
    except Exception:
        # 加载失败时保持空会话状态，继续运行
        return


async def persist_sessions_to_file() -> None:
    """
    【主动调用】将内存中的所有会话保存到 JSON 文件
    
    特点:
      • 使用异步锁确保同一时刻只有一个写操作
      • 先写入临时文件，再原子替换原文件（防止损坏）
      • 写入失败不会中断 API 响应
    
    保存时机:
      • 创建新会话后
      • 发送消息后
      • 删除消息后
      • 回滚消息后
    """
    tmp_path = PERSISTENCE_FILE + ".tmp"
    async with persistence_lock:
        try:
            with open(tmp_path, "w", encoding="utf-8") as fh:
                json.dump(SESSIONS, fh, ensure_ascii=False, indent=2)
            os.replace(tmp_path, PERSISTENCE_FILE)
        except Exception:
            # 清理临时文件
            if os.path.exists(tmp_path):
                try:
                    os.remove(tmp_path)
                except Exception:
                    pass
            return


# ═════════════════════════════════════════════════════════════════
# 第三部分：DeepSeek AI 集成
# ═════════════════════════════════════════════════════════════════

# DeepSeek API 配置（从环境变量读取，可覆盖默认值）
DEEPSEEK_API_URL = os.getenv(
    "DEEPSEEK_API_URL",
    "https://api.deepseek.com/chat/completions",
)
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "sk-5697227eab4e4271ae2f6d67b07e66e3")
DEEPSEEK_MODEL = os.getenv("DEEPSEEK_MODEL", "deepseek-chat")


async def call_deepseek(messages: List[Dict[str, str]]) -> str:
    """
    【关键函数】调用 DeepSeek AI 获取回复
    
    工作流程:
      1. 构建请求头（包含 API 密钥认证）
      2. 构建请求体（包含完整的对话历史）
      3. 发送 HTTP POST 请求到 DeepSeek API
      4. 解析响应并提取 AI 的回复文本
    
    参数:
      messages: 完整的对话历史
        [
          {"role": "user", "content": "用户问题"},
          {"role": "assistant", "content": "AI回复"},
          ...
        ]
    
    返回:
      AI 的文本回复内容
    
    Demo 模式:
      如果 DEEPSEEK_API_URL 为空，使用 Demo 模式简单回显用户最后一条消息
    """
    
    # 如果未配置真实 API，使用 Demo 回复
    if not DEEPSEEK_API_URL:
        last_user = ""
        for m in reversed(messages):
            if m.get("role") == "user":
                last_user = m.get("content", "")
                break
        return f"(DEMO回复) 你刚才说：{last_user}"

    # 构建请求头：包含内容类型和认证令牌
    headers = {"Content-Type": "application/json"}
    if DEEPSEEK_API_KEY:
        headers["Authorization"] = f"Bearer {DEEPSEEK_API_KEY}"

    # 构建请求体
    payload = {
        "model": DEEPSEEK_MODEL,
        "messages": messages,
        "stream": False,  # 不使用流式响应
    }

    # 发送异步 HTTP 请求
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(DEEPSEEK_API_URL, json=payload, headers=headers)
        resp.raise_for_status()  # 检查 HTTP 状态码
        data = resp.json()

    # 从响应中提取 AI 回复（OpenAI 兼容格式）
    try:
        return data["choices"][0]["message"]["content"]
    except Exception as exc:
        # 如果解析失败，返回原始响应便于调试
        return f"[DeepSeek 原始响应]\n{data!r}\n(解析失败: {exc})"


# ═════════════════════════════════════════════════════════════════
# 第四部分：FastAPI 应用初始化
# ═════════════════════════════════════════════════════════════════

app = FastAPI(title="AI Chat Backend", version="0.1.0")

# 配置 CORS 中间件：允许所有跨域请求（开发环境）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def _load_on_startup() -> None:
    """【应用启动事件】加载持久化的会话数据"""
    await load_sessions_from_file()


# ═════════════════════════════════════════════════════════════════
# 第五部分：辅助函数
# ═════════════════════════════════════════════════════════════════

def get_session_or_404(session_id: str) -> Dict[str, Any]:
    """
    获取会话或返回 404 错误
    
    用途: 避免在多个路由中重复检查会话存在性
    """
    session = SESSIONS.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


def ensure_session_name(session: Dict[str, Any]) -> str:
    """
    确保会话有名称（如果没有则自动生成）
    
    命名规则:
      1. 如果有用户消息，使用第一条用户消息的前 20 个字符
      2. 如果没有用户消息，使用默认名称 "会话 {id}"
    """
    name = session.get("name")
    if not name:
        user_msgs = [m for m in session["messages"] if m.get("role") == "user"]
        if user_msgs:
            text = user_msgs[0].get("content", "").strip().replace("\n", " ")
            if len(text) > 20:
                text = text[:20] + "..."
            name = text or f"会话 {session['id']}"
        else:
            name = f"会话 {session['id']}"
        session["name"] = name
    return name


# ═════════════════════════════════════════════════════════════════
# 第六部分：会话管理 API
# ═════════════════════════════════════════════════════════════════

@app.get("/api/sessions")
async def list_sessions() -> List[Dict[str, Any]]:
    """
    【GET /api/sessions】获取所有会话列表
    
    返回格式:
      [
        {
          "id": "会话 ID",
          "name": "会话名称",
          "message_count": 消息数量,
          "updated_at": "最后更新时间"
        },
        ...
      ]
    
    排序: 按最后更新时间倒序排列（最新的排在前面）
    """
    result: List[Dict[str, Any]] = []
    
    # 遍历所有会话，收集汇总信息
    for sess in SESSIONS.values():
        name = ensure_session_name(sess)
        result.append({
            "id": sess["id"],
            "name": name,
            "message_count": len(sess["messages"]),
            "updated_at": sess["updated_at"],
        })
    
    # 按更新时间倒序排列
    result.sort(key=lambda s: s["updated_at"], reverse=True)
    return result


@app.post("/api/sessions")
async def create_session() -> Dict[str, Any]:
    """
    【POST /api/sessions】创建新会话
    
    流程:
      1. 生成唯一的 8 位 16 进制会话 ID
      2. 创建空会话对象
      3. 添加到全局存储
      4. 保存到文件
    
    返回: 新创建的会话信息
    """
    # 生成会话 ID 和时间戳
    sid = uuid4().hex[:8]
    ts = now_iso()
    
    # 初始化会话对象
    session = {
        "id": sid,
        "name": "",
        "messages": [],
        "created_at": ts,
        "updated_at": ts,
    }
    
    # 添加到全局存储
    SESSIONS[sid] = session

    # 自动生成会话名称
    ensure_session_name(session)
    
    # 保存到文件
    try:
        await persist_sessions_to_file()
    except Exception:
        pass

    return {
        "id": session["id"],
        "name": session["name"],
        "message_count": 0,
        "updated_at": session["updated_at"],
    }


# ═════════════════════════════════════════════════════════════════
# 第七部分：消息管理 API
# ═════════════════════════════════════════════════════════════════

@app.get("/api/sessions/{session_id}/messages")
async def get_messages(session_id: str) -> List[Dict[str, Any]]:
    """
    【GET /api/sessions/{session_id}/messages】获取会话中的所有消息
    
    返回格式:
      [
        {
          "id": 消息索引(0-based),
          "role": "user" | "assistant",
          "content": "消息文本",
          "created_at": "创建时间"
        },
        ...
      ]
    """
    sess = get_session_or_404(session_id)
    out: List[Dict[str, Any]] = []
    
    # 逐条消息封装返回
    for idx, msg in enumerate(sess["messages"]):
        out.append({
            "id": idx,  # 消息在数组中的位置作为 ID
            "role": msg.get("role"),
            "content": msg.get("content"),
            "created_at": msg.get("created_at"),
        })
    
    return out


@app.post("/api/sessions/{session_id}/messages")
async def send_message(session_id: str, body: SendMessageIn) -> List[Dict[str, Any]]:
    """
    【POST /api/sessions/{session_id}/messages】发送消息并获取 AI 回复
    
    核心流程:
      1. ✓ 验证会话存在，提取用户消息内容
      2. ✓ 将用户消息添加到会话历史
      3. ✓ 调用 DeepSeek API 获取 AI 回复
      4. ✓ 将 AI 回复添加到会话历史
      5. ✓ 更新会话时间戳
      6. ✓ 保存到文件
      7. ✓ 返回完整消息列表
    
    返回: 会话中的所有消息（包括刚发送的）
    """
    # 验证会话存在
    sess = get_session_or_404(session_id)
    
    # 验证消息内容非空
    content = body.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="content is empty")

    # ───── 步骤 1: 添加用户消息 ─────
    ts = now_iso()
    user_msg = {"role": "user", "content": content, "created_at": ts}
    sess["messages"].append(user_msg)

    # ───── 步骤 2: 构建对话历史 ─────
    # 从会话中提取 role 和 content，用于 AI 理解上下文
    history = [
        {"role": m["role"], "content": m["content"]}
        for m in sess["messages"]
    ]
    
    # ───── 步骤 3: 调用 DeepSeek AI ─────
    try:
        assistant_text = await call_deepseek(history)
    except Exception as exc:
        # 如果 AI 调用失败，返回错误（用户消息已保存）
        raise HTTPException(status_code=500, detail=f"DeepSeek 调用失败: {exc}")

    # ───── 步骤 4: 添加 AI 回复 ─────
    assistant_msg = {
        "role": "assistant",
        "content": assistant_text,
        "created_at": now_iso(),
    }
    sess["messages"].append(assistant_msg)
    
    # ───── 步骤 5: 更新会话 ─────
    sess["updated_at"] = now_iso()

    # ───── 步骤 6: 保存数据 ─────
    try:
        await persist_sessions_to_file()
    except Exception:
        pass

    # ───── 步骤 7: 返回结果 ─────
    return await get_messages(session_id)


# ═════════════════════════════════════════════════════════════════
# 第八部分：会话管理操作 API
# ═════════════════════════════════════════════════════════════════

@app.post("/api/sessions/{session_id}/rollback")
async def rollback(session_id: str, body: RollbackIn) -> List[Dict[str, Any]]:
    """
    【POST /api/sessions/{session_id}/rollback】回滚会话到指定消息位置
    
    功能: 删除指定索引及之后的所有消息
    
    参数:
      to_index: 目标消息索引（保留索引 0 到 to_index-1 的消息）
    
    例子:
      假设有 5 条消息 (索引 0-4)
      回滚到索引 2 → 保留消息 0, 1 → 删除消息 2, 3, 4
    
    返回: 回滚后的消息列表
    """
    sess = get_session_or_404(session_id)
    total = len(sess["messages"])
    idx = body.to_index

    # 验证索引范围
    if idx < 0 or idx > total:
        raise HTTPException(status_code=400, detail=f"to_index must be between 0 and {total}")

    # 保留索引 0 到 idx-1 的消息，删除其后的所有消息
    sess["messages"] = sess["messages"][:idx]
    sess["updated_at"] = now_iso()

    # 保存更改
    try:
        await persist_sessions_to_file()
    except Exception:
        pass

    return await get_messages(session_id)


@app.delete("/api/sessions/{session_id}")
async def delete_session(session_id: str) -> Dict[str, str]:
    """
    【DELETE /api/sessions/{session_id}】删除整个会话
    
    功能: 从存储中删除指定会话及其所有消息
    
    返回: 删除确认消息
    """
    # 验证会话存在
    if session_id not in SESSIONS:
        raise HTTPException(status_code=404, detail="Session not found")

    # 删除会话
    del SESSIONS[session_id]

    # 保存更改
    try:
        await persist_sessions_to_file()
    except Exception:
        pass

    return {"message": f"Session {session_id} deleted"}


@app.delete("/api/sessions/{session_id}/messages/{msg_index}")
async def delete_message(session_id: str, msg_index: int) -> List[Dict[str, Any]]:
    """
    【DELETE /api/sessions/{session_id}/messages/{msg_index}】删除单条消息
    
    功能: 从会话中删除指定索引的消息
    
    参数:
      msg_index: 要删除的消息索引
    
    返回: 删除后的消息列表
    """
    sess = get_session_or_404(session_id)
    total = len(sess["messages"])

    # 验证索引范围
    if msg_index < 0 or msg_index >= total:
        raise HTTPException(status_code=400, detail=f"Message index must be between 0 and {total - 1}")

    # 删除指定索引的消息
    sess["messages"].pop(msg_index)
    sess["updated_at"] = now_iso()

    # 保存更改
    try:
        await persist_sessions_to_file()
    except Exception:
        pass

    return await get_messages(session_id)


# ═════════════════════════════════════════════════════════════════
# 第九部分：静态文件服务
# ═════════════════════════════════════════════════════════════════

# 挂载 CSS 文件夹
app.mount("/css", StaticFiles(directory="css"), name="css")

# 挂载 JS 文件夹
app.mount("/js", StaticFiles(directory="js"), name="js")

# 直接服务 themes.js 文件
@app.get("/themes.js")
async def get_themes():
    """提供主题配置文件"""
    return FileResponse("themes.js", media_type="application/javascript")

# 直接服务背景图片
@app.get("/background.png")
async def get_background():
    """提供背景图片"""
    return FileResponse("background.png", media_type="image/png")

# 提供主 HTML 文件
@app.get("/")
@app.get("/index.html")
async def root():
    """提供主页面"""
    return FileResponse("index.html")


# ═════════════════════════════════════════════════════════════════
# 应用入口
# ═════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
