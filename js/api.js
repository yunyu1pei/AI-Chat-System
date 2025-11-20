/**
 * ═══════════════════════════════════════════════════════════════════════
 *              API 调用层 - 与后端 FastAPI 通信
 * ═══════════════════════════════════════════════════════════════════════
 * 
 * 职责：
 *   • 封装所有 HTTP 请求逻辑
 *   • 处理 JSON 序列化和反序列化
 *   • 统一的错误处理
 *   • 提供简洁的接口供应用层调用
 * 
 * 设计原则：
 *   • 单一职责：每个函数对应一个 API 端点
 *   • 易测试：无副作用的纯函数
 *   • 可复用：可在不同的前端框架中使用
 * 
 * API 端点映射：
 *   ┌─────────────────────────────────────────────────┐
 *   │  函数名              │ HTTP 方法 │ 端点                │
 *   ├─────────────────────────────────────────────────┤
 *   │  loadSessions        │ GET      │ /api/sessions      │
 *   │  createSession       │ POST     │ /api/sessions      │
 *   │  getMessages         │ GET      │ /api/sessions/.../messages │
 *   │  sendMessage         │ POST     │ /api/sessions/.../messages │
 *   │  rollback            │ POST     │ /api/sessions/.../rollback │
 *   │  deleteMessage       │ DELETE   │ /api/sessions/.../messages/... │
 *   │  deleteSession       │ DELETE   │ /api/sessions/...  │
 *   └─────────────────────────────────────────────────┘
 */


/**
 * 【核心函数】通用 API 请求包装器
 * 
 * 职责：
 *   1. 构建完整的请求 URL
 *   2. 设置 HTTP 请求头
 *   3. 发送异步 HTTP 请求
 *   4. 检查响应状态
 *   5. 解析响应内容（JSON 或纯文本）
 *   6. 统一的错误处理
 * 
 * 参数：
 *   apiBase: 后端 API 基础 URL (例如 http://127.0.0.1:8000/api)
 *   path: 相对路径 (例如 /sessions)
 *   options: 额外的请求选项 (method, body, headers 等)
 * 
 * 返回：
 *   解析后的响应数据（通常是 JSON 对象或数组）
 * 
 * 错误处理：
 *   如果响应状态码不是 2xx，抛出包含状态码的错误
 */
export async function apiFetch(apiBase, path, options = {}) {
  // ───── 步骤 1: 构建完整 URL ─────
  // 移除 apiBase 末尾的斜杠（如果有），然后拼接路径
  const url = apiBase.replace(/\/$/, '') + path;
  
  // ───── 步骤 2: 合并请求选项 ─────
  const opt = Object.assign({
    headers: { 'Content-Type': 'application/json' }  // 默认请求头
  }, options || {});
  
  // ───── 步骤 3: 序列化请求体 ─────
  // 如果 body 是对象，转换为 JSON 字符串
  if (opt.body && typeof opt.body !== 'string') {
    opt.body = JSON.stringify(opt.body);
  }
  
  // ───── 步骤 4: 发送 HTTP 请求 ─────
  const res = await fetch(url, opt);
  
  // ───── 步骤 5: 检查响应状态 ─────
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  
  // ───── 步骤 6: 解析响应内容 ─────
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return res.json();  // 解析 JSON
  }
  return res.text();    // 返回纯文本
}


/**
 * 【会话管理】获取所有会话列表
 * 
 * HTTP: GET /api/sessions
 * 
 * 响应格式:
 *   [
 *     {
 *       "id": "abc12345",
 *       "name": "用户第一条消息的内容...",
 *       "message_count": 3,
 *       "updated_at": "2025-11-20T10:30:00"
 *     },
 *     ...
 *   ]
 * 
 * 用途：
 *   • 页面加载时初始化会话列表
 *   • 切换会话后刷新会话列表
 *   • 添加/删除消息后更新消息计数
 */
export async function loadSessions(apiBase) {
  return apiFetch(apiBase, '/sessions', { method: 'GET' });
}


/**
 * 【会话管理】创建新会话
 * 
 * HTTP: POST /api/sessions
 * 
 * 响应格式:
 *   {
 *     "id": "abc12345",
 *     "name": "会话 abc12345",
 *     "message_count": 0,
 *     "updated_at": "2025-11-20T10:30:00"
 *   }
 * 
 * 用途：
 *   • 用户点击"新建会话"按钮时调用
 *   • 创建空会话供用户开始新对话
 */
export async function createSession(apiBase) {
  return apiFetch(apiBase, '/sessions', { method: 'POST' });
}


/**
 * 【消息管理】获取会话中的所有消息
 * 
 * HTTP: GET /api/sessions/{sessionId}/messages
 * 
 * 参数：
 *   sessionId: 会话 ID
 * 
 * 响应格式:
 *   [
 *     {
 *       "id": 0,
 *       "role": "user",
 *       "content": "用户的问题",
 *       "created_at": "2025-11-20T10:30:00"
 *     },
 *     {
 *       "id": 1,
 *       "role": "assistant",
 *       "content": "AI 的回复",
 *       "created_at": "2025-11-20T10:30:05"
 *     },
 *     ...
 *   ]
 * 
 * 用途：
 *   • 用户切换会话时加载消息
 *   • 操作后刷新消息列表
 */
export async function getMessages(apiBase, sessionId) {
  return apiFetch(apiBase, `/sessions/${encodeURIComponent(sessionId)}/messages`, {
    method: 'GET'
  });
}


/**
 * 【消息操作】发送消息并获取 AI 回复
 * 
 * HTTP: POST /api/sessions/{sessionId}/messages
 * 
 * 请求体:
 *   {
 *     "content": "用户输入的问题文本"
 *   }
 * 
 * 响应格式:
 *   返回会话中的所有消息（与 getMessages 相同）
 * 
 * 流程（在后端进行）:
 *   1. 将用户消息添加到会话历史
 *   2. 调用 DeepSeek AI API 获取回复
 *   3. 将 AI 回复添加到会话历史
 *   4. 返回完整的消息列表
 * 
 * 用途：
 *   • 用户输入问题后调用
 *   • 获取 AI 的回复
 */
export async function sendMessage(apiBase, sessionId, content) {
  return apiFetch(apiBase, `/sessions/${encodeURIComponent(sessionId)}/messages`, {
    method: 'POST',
    body: { content }
  });
}


/**
 * 【消息操作】回滚消息（恢复到之前的对话状态）
 * 
 * HTTP: POST /api/sessions/{sessionId}/rollback
 * 
 * 请求体:
 *   {
 *     "to_index": 2
 *   }
 * 
 * 响应格式:
 *   返回会话中的所有消息（在回滚后的状态）
 * 
 * 功能说明:
 *   删除指定索引及之后的所有消息，保留之前的消息
 * 
 *   例子：假设有 5 条消息
 *   点击第 2 条消息的"回滚到此处之前"
 *   → 结果：保留消息 0, 1 → 删除消息 2, 3, 4
 * 
 * 用途：
 *   • 用户不满意某条 AI 回复，想重新开始对话
 *   • 测试不同的问题方向
 */
export async function rollback(apiBase, sessionId, toIndex) {
  return apiFetch(apiBase, `/sessions/${encodeURIComponent(sessionId)}/rollback`, {
    method: 'POST',
    body: { to_index: toIndex }
  });
}


/**
 * 【消息操作】删除单条消息
 * 
 * HTTP: DELETE /api/sessions/{sessionId}/messages/{msgIndex}
 * 
 * 参数：
 *   msgIndex: 要删除的消息在数组中的索引
 * 
 * 响应格式:
 *   返回会话中的所有消息（在删除后的状态）
 * 
 * 功能说明:
 *   从会话中删除指定索引的消息
 * 
 * 用途：
 *   • 用户想删除某条错误或无关的消息
 */
export async function deleteMessage(apiBase, sessionId, msgIndex) {
  return apiFetch(apiBase, `/sessions/${encodeURIComponent(sessionId)}/messages/${msgIndex}`, {
    method: 'DELETE'
  });
}


/**
 * 【会话管理】删除会话
 * 
 * HTTP: DELETE /api/sessions/{sessionId}
 * 
 * 响应格式:
 *   {
 *     "message": "Session abc12345 deleted"
 *   }
 * 
 * 功能说明:
 *   从存储中删除整个会话及其所有消息
 *   此操作不可撤销
 * 
 * 用途：
 *   • 用户点击会话旁的"删除"按钮
 */
export async function deleteSession(apiBase, sessionId) {
  return apiFetch(apiBase, `/sessions/${encodeURIComponent(sessionId)}`, {
    method: 'DELETE'
  });
}
