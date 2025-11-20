/**
 * ═══════════════════════════════════════════════════════════════════════
 *                    AI 对话系统 - Vue 3 前端应用
 * ═══════════════════════════════════════════════════════════════════════
 * 
 * 功能职责：
 *   • 状态管理：管理会话、消息、加载状态等应用数据
 *   • 用户交互：处理消息发送、会话切换、删除等操作
 *   • API 调用：与后端通信，获取和修改数据
 *   • UI 更新：通过 Vue 响应式系统自动更新界面
 * 
 * 核心数据流：
 *   用户输入 → API 调用 → 后端处理 → 返回数据 → 更新 UI → 重新渲染
 */

import {
  loadSessions as apiLoadSessions,        // 获取所有会话列表
  createSession as apiCreateSession,      // 创建新会话
  getMessages,                            // 获取会话消息
  sendMessage as apiSendMessage,          // 发送消息
  rollback,                               // 回滚消息
  deleteMessage as apiDeleteMessage,      // 删除消息
  deleteSession as apiDeleteSession       // 删除会话
} from './api.js';

const { ref, watch, computed, onMounted } = Vue;

/**
 * setupApp() - 主应用初始化函数
 * 
 * 返回所有响应式状态和方法供 Vue 组件使用
 */
export function setupApp() {
  
  // ═══ 第一部分：响应式状态定义 ═══════════════════════════════════
  
  const apiBase = ref('http://127.0.0.1:8000/api');     // 后端 API 基础 URL
  const sessions = ref([]);                             // 所有会话列表
  const currentSessionId = ref(null);                   // 当前选中的会话 ID
  const messages = ref([]);                             // 当前会话的消息列表
  const newMessage = ref('');                           // 输入框中的新消息
  const loading = ref(false);                           // 是否正在加载（发送消息中）
  const error = ref('');                                // 错误消息
  const messagesScroller = ref(null);                   // 消息滚动容器引用
  
  // 主题配置
  const themeOptions = ref(
    (window.CHAT_THEMES && Array.isArray(window.CHAT_THEMES) && window.CHAT_THEMES.length)
      ? window.CHAT_THEMES
      : [{ key: 'default', label: '默认主题' }]
  );
  const currentTheme = ref(themeOptions.value[0]?.key || 'default');

  
  // ═══ 第二部分：侦听器（数据变化时自动执行） ════════════════════
  
  // 当主题变化时，更新 body 的 class
  watch(currentTheme, (val) => {
    const cls = document.body.classList;
    // 移除旧主题 class
    cls.forEach((c) => {
      if (c.startsWith('theme-')) cls.remove(c);
    });
    // 添加新主题 class
    cls.add('theme-' + val);
  }, { immediate: true });  // 立即执行一次

  
  // ═══ 第三部分：工具函数 ═════════════════════════════════════════
  
  /**
   * 设置错误消息（自动 5 秒后消失）
   */
  function setError(msg) {
    error.value = msg || '';
    if (msg) {
      setTimeout(() => {
        error.value = '';
      }, 5000);
    }
  }

  /**
   * 将 ISO 时间戳转换为本地时间字符串（HH:MM 格式）
   */
  function formatTime(isoString) {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  }

  /**
   * 滚动消息容器到底部
   */
  function scrollToBottom() {
    const el = messagesScroller.value;
    if (!el) return;
    // 使用 requestAnimationFrame 优化性能
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }

  
  // ═══ 第四部分：API 调用函数 ════════════════════════════════════
  
  /**
   * 【会话加载】获取所有会话列表
   * 
   * 流程：
   *   1. 清空错误信息
   *   2. 调用 API 获取会话列表
   *   3. 如果没有选中会话，自动选中第一个
   *   4. 加载第一个会话的消息
   */
  async function loadSessionsList() {
    setError('');
    try {
      const data = await apiLoadSessions(apiBase.value);
      sessions.value = Array.isArray(data) ? data : [];
      
      // 如果有会话且还未选中任何会话，选中第一个
      if (sessions.value.length && !currentSessionId.value) {
        currentSessionId.value = sessions.value[0].id;
        await loadMessagesList();
      }
    } catch (e) {
      setError('加载会话列表失败：' + e.message);
    }
  }

  /**
   * 【会话切换】选择要查看的会话
   */
  async function selectSession(id) {
    if (!id || id === currentSessionId.value) return;  // 如果已经是当前会话，不切换
    currentSessionId.value = id;
    await loadMessagesList();
  }

  /**
   * 【创建会话】创建新的空会话
   * 
   * 流程：
   *   1. 设置加载状态
   *   2. 调用 API 创建新会话
   *   3. 清空当前消息列表
   *   4. 重新加载会话列表
   */
  async function createNewSession() {
    setError('');
    loading.value = true;
    try {
      await apiCreateSession(apiBase.value);
      messages.value = [];
      await loadSessionsList();
    } catch (e) {
      setError('新建会话失败：' + e.message);
    } finally {
      loading.value = false;
    }
  }

  /**
   * 【消息加载】加载当前会话的所有消息
   */
  async function loadMessagesList() {
    if (!currentSessionId.value) return;
    setError('');
    loading.value = true;
    try {
      const data = await getMessages(apiBase.value, currentSessionId.value);
      messages.value = Array.isArray(data) ? data : [];
      scrollToBottom();  // 滚动到最新消息
    } catch (e) {
      setError('加载消息失败：' + e.message);
    } finally {
      loading.value = false;
    }
  }

  /**
   * 【发送消息】用户发送消息并获取 AI 回复
   * 
   * 核心流程：
   *   1. ✓ 验证：会话存在，消息非空
   *   2. ✓ 立即显示：将用户消息立即添加到本地显示
   *   3. ✓ 清空输入：清空输入框，滚动到底部
   *   4. ✓ 调用 API：发送消息到后端
   *   5. ✓ 更新列表：用后端返回的完整消息列表更新本地
   *   6. ✓ 淡出效果：5 秒后给 AI 回复添加淡出动画
   *   7. ✓ 刷新会话：更新会话列表（更新时间戳等）
   * 
   * 错误处理：发送失败时移除本地添加的用户消息
   */
  async function sendMsg() {
    if (!currentSessionId.value) {
      setError('请先选择或创建会话');
      return;
    }
    const text = newMessage.value.trim();
    if (!text || !currentSessionId.value) return;
    
    setError('');
    loading.value = true;
    
    // ───── 步骤 1: 立即显示用户消息 ─────
    const userMsg = {
      role: 'user',
      content: text,
      created_at: new Date().toISOString()
    };
    messages.value.push(userMsg);
    newMessage.value = '';  // 清空输入框
    scrollToBottom();
    
    try {
      // ───── 步骤 2: 调用后端 API ─────
      const data = await apiSendMessage(apiBase.value, currentSessionId.value, text);
      
      // ───── 步骤 3: 更新消息列表 ─────
      if (Array.isArray(data)) {
        messages.value = data;
      } else if (data && data.messages) {
        messages.value = data.messages;
      }
      
      scrollToBottom();
      
      // ───── 步骤 4: 添加淡出效果 ─────
      // 给最后的 AI 回复消息添加淡出动画
      setTimeout(() => {
        if (messagesScroller.value) {
          const bubbles = messagesScroller.value.querySelectorAll('.bubble.assistant');
          if (bubbles.length > 0) {
            const lastBubble = bubbles[bubbles.length - 1];
            // 5 秒后开始淡出，淡出过程持续 2 秒
            setTimeout(() => {
              lastBubble.classList.add('message-fade-out');
            }, 5000);
          }
        }
      }, 500);
      
      // ───── 步骤 5: 刷新会话列表 ─────
      await loadSessionsList();
    } catch (e) {
      // 错误处理：移除已添加的用户消息
      messages.value.pop();
      setError('发送消息失败：' + e.message);
    } finally {
      loading.value = false;
    }
  }

  /**
   * 【回滚消息】删除指定消息之后的所有消息，恢复到之前的对话状态
   */
  async function rollbackTo(index) {
    if (!currentSessionId.value) return;
    setError('');
    loading.value = true;
    try {
      const data = await rollback(apiBase.value, currentSessionId.value, index);
      
      // 更新消息列表
      if (Array.isArray(data)) {
        messages.value = data;
      } else if (data && data.messages) {
        messages.value = data.messages;
      }
      
      scrollToBottom();
      await loadSessionsList();  // 刷新会话信息
    } catch (e) {
      setError('回滚失败：' + e.message);
    } finally {
      loading.value = false;
    }
  }

  /**
   * 【删除消息】删除指定索引的消息
   */
  async function deleteMsg(index) {
    if (!currentSessionId.value) return;
    
    // 用户确认
    if (!confirm(`确定要删除第 ${index + 1} 条消息吗？`)) return;

    setError('');
    loading.value = true;
    try {
      const data = await apiDeleteMessage(apiBase.value, currentSessionId.value, index);
      
      // 更新消息列表
      if (Array.isArray(data)) {
        messages.value = data;
      } else if (data && data.messages) {
        messages.value = data.messages;
      }
      
      scrollToBottom();
      await loadSessionsList();  // 刷新会话信息
    } catch (e) {
      setError('删除消息失败：' + e.message);
    } finally {
      loading.value = false;
    }
  }

  /**
   * 【删除会话】删除整个会话及其所有消息
   */
  async function deleteSess(sessionId) {
    // 用户确认
    if (!confirm(`确定要删除会话 "${sessionId}" 吗？此操作不可撤销。`)) return;

    setError('');
    loading.value = true;
    try {
      await apiDeleteSession(apiBase.value, sessionId);
      await loadSessionsList();
      
      // 如果删除的是当前会话，切换到其他会话
      if (currentSessionId.value === sessionId) {
        if (sessions.value.length > 0) {
          currentSessionId.value = sessions.value[0].id;
          await loadMessagesList();
        } else {
          currentSessionId.value = null;
          messages.value = [];
        }
      }
    } catch (e) {
      setError('删除会话失败：' + e.message);
    } finally {
      loading.value = false;
    }
  }

  
  // ═══ 第五部分：键盘事件处理 ════════════════════════════════════
  
  /**
   * 处理输入框的 Enter 键
   * 
   * 行为：
   *   • Enter 键：发送消息
   *   • Ctrl+Enter：在消息中插入换行
   */
  function handleEnterKey(event) {
    if (event.ctrlKey || event.metaKey) {
      // Ctrl+Enter 或 Cmd+Enter：插入换行
      const t = event.target;
      const start = t.selectionStart;
      const end = t.selectionEnd;
      const value = t.value;
      t.value = value.slice(0, start) + '\n' + value.slice(end);
      t.selectionStart = t.selectionEnd = start + 1;
      newMessage.value = t.value;
    } else {
      // Enter 键：发送消息
      sendMsg();
    }
  }

  
  // ═══ 第六部分：计算属性（派生状态） ═══════════════════════════
  
  /**
   * 计算属性：是否可以发送消息
   * 
   * 条件：
   *   • 不在加载状态（loading = false）
   *   • 输入框有非空内容
   */
  const canSend = computed(() => !loading.value && !!newMessage.value.trim());
  
  /**
   * 计算属性：当前会话的标题
   * 
   * 显示逻辑：
   *   • 如果未选中会话：显示 "未选择会话"
   *   • 如果有会话名称：显示会话名称
   *   • 否则：显示 "会话 {id}"
   */
  const currentSessionTitle = computed(() => {
    if (!currentSessionId.value) return '未选择会话';
    const s = sessions.value.find(x => x.id === currentSessionId.value);
    return s ? (s.name || '会话 ' + s.id) : '会话 ' + currentSessionId.value;
  });

  
  // ═══ 第七部分：生命周期钩子 ════════════════════════════════════
  
  /**
   * 【挂载时调用】组件第一次渲染到 DOM 后执行
   * 
   * 功能：初始化应用，加载会话列表
   */
  onMounted(() => {
    loadSessionsList();
  });

  
  // ═══ 第八部分：导出状态和方法 ════════════════════════════════
  
  // 返回所有状态和方法供模板使用
  return {
    apiBase,
    sessions,
    currentSessionId,
    messages,
    newMessage,
    loading,
    error,
    messagesScroller,
    themeOptions,
    currentTheme,
    formatTime,
    loadSessionsList,
    selectSession,
    createNewSession,
    loadMessagesList,
    sendMsg,
    rollbackTo,
    deleteMsg,
    deleteSession: deleteSess,
    handleEnterKey,
    canSend,
    currentSessionTitle
  };
}
