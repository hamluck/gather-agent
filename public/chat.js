(function () {
  const SESSION_KEY = "gather-agent-session";
  const API_BASE = "";

  const nicknameModal = document.getElementById("nickname-modal");
  const chatContainer = document.getElementById("chat-container");
  const nicknameInput = document.getElementById("nickname-input");
  const nicknameSubmit = document.getElementById("nickname-submit");
  const messageInput = document.getElementById("message-input");
  const sendBtn = document.getElementById("send-btn");
  const messagesDiv = document.getElementById("chat-messages");
  const userName = document.getElementById("user-name");

  let session = null;
  let sending = false;

  function loadSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return null;
  }

  function saveSession(s) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
  }

  function appendMessage(role, text) {
    const div = document.createElement("div");
    div.className = "msg " + role;
    div.textContent = text;
    messagesDiv.appendChild(div);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
    return div;
  }

  function showLoading() {
    return appendMessage("loading", "...");
  }

  function removeLoading(el) {
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  async function apiCall(method, path, body) {
    const headers = { "Content-Type": "application/json" };
    if (session) headers["X-Session-Id"] = session.sessionId;

    const res = await fetch(API_BASE + path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await res.json();
    if (res.status === 401 && session) {
      clearSession();
      session = null;
      chatContainer.classList.add("hidden");
      nicknameModal.classList.remove("hidden");
      while (messagesDiv.firstChild) messagesDiv.removeChild(messagesDiv.firstChild);
      throw new Error("세션이 만료되었습니다. 닉네임을 다시 등록해주세요.");
    }
    if (!res.ok) throw new Error(data.error || "요청 실패");
    return data;
  }

  async function register(nickname) {
    const data = await apiCall("POST", "/api/session/register", {
      nickname,
      sessionId: crypto.randomUUID(),
    });
    session = data;
    saveSession(session);
    return session;
  }

  async function loadHistory() {
    try {
      const data = await apiCall("GET", "/api/chat/history");
      if (data.history && data.history.length > 0) {
        for (const msg of data.history) {
          appendMessage(msg.role, msg.content);
        }
      }
      if (data.reminders && data.reminders.length > 0) {
        for (const reminder of data.reminders) {
          appendMessage("system", reminder);
        }
      }
    } catch {}
  }

  async function sendMessage() {
    const text = messageInput.value.trim();
    if (!text || sending) return;

    if (text === "/reset-session") {
      clearSession();
      session = null;
      chatContainer.classList.add("hidden");
      nicknameModal.classList.remove("hidden");
      while (messagesDiv.firstChild) messagesDiv.removeChild(messagesDiv.firstChild);
      return;
    }

    sending = true;
    sendBtn.disabled = true;
    messageInput.value = "";

    appendMessage("user", text);
    const loader = showLoading();

    try {
      const data = await apiCall("POST", "/api/chat", { message: text });
      removeLoading(loader);
      appendMessage("assistant", data.reply);
    } catch (err) {
      removeLoading(loader);
      appendMessage("system", err.message);
    }

    sending = false;
    sendBtn.disabled = false;
    messageInput.focus();
  }

  nicknameSubmit.addEventListener("click", async () => {
    const nickname = nicknameInput.value.trim();
    if (!nickname) return;
    try {
      nicknameSubmit.disabled = true;
      await register(nickname);
      nicknameModal.classList.add("hidden");
      chatContainer.classList.remove("hidden");
      userName.textContent = session.nickname;
      appendMessage("system", session.nickname + "님, 환영합니다! 무엇을 도와드릴까요?");
    } catch (err) {
      alert(err.message);
    } finally {
      nicknameSubmit.disabled = false;
    }
  });

  nicknameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") nicknameSubmit.click();
  });

  sendBtn.addEventListener("click", sendMessage);
  messageInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendMessage();
  });

  // Init
  session = loadSession();
  if (session && session.sessionId) {
    nicknameModal.classList.add("hidden");
    chatContainer.classList.remove("hidden");
    userName.textContent = session.nickname;
    loadHistory();
  }
})();
