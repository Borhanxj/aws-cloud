(function () {
  const messageList = document.querySelector("[data-message-list]");
  const composer = document.querySelector("[data-composer]");

  if (!messageList || !composer) {
    return;
  }

  const channelId = messageList.dataset.channelId;
  const currentUserId = Number(messageList.dataset.currentUserId);
  const messageCount = document.querySelector("[data-message-count]");
  const fileInput = composer.querySelector('input[type="file"]');
  const preview = composer.querySelector("[data-attachment-preview]");
  const sendButton = composer.querySelector('button[type="submit"]');
  let previewUrl = null;
  let refreshInFlight = false;

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function getInitials(name) {
    const parts = String(name || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    if (parts.length === 0) {
      return "CC";
    }

    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }

    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  function formatDateTime(value) {
    return new Intl.DateTimeFormat("en", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(value));
  }

  function formatFileSize(bytes) {
    const size = Number(bytes || 0);

    if (size < 1024) {
      return `${size} B`;
    }

    if (size < 1024 * 1024) {
      return `${(size / 1024).toFixed(1)} KB`;
    }

    return `${(size / 1024 / 1024).toFixed(1)} MB`;
  }

  function isNearBottom() {
    return messageList.scrollHeight - messageList.scrollTop - messageList.clientHeight < 120;
  }

  function scrollToBottom() {
    messageList.scrollTop = messageList.scrollHeight;
  }

  function showError(message) {
    const existing = document.querySelector("[data-client-error]");

    if (existing) {
      existing.remove();
    }

    const element = document.createElement("div");
    element.className = "flash error";
    element.dataset.clientError = "true";
    element.textContent = message;
    document.body.appendChild(element);
    window.setTimeout(() => element.remove(), 3500);
  }

  function renderAttachment(message) {
    if (!message.attachment_id) {
      return "";
    }

    const url = escapeHtml(message.attachment_url);
    const fileName = escapeHtml(message.file_name);

    if (message.content_type && message.content_type.startsWith("image/")) {
      return `
        <a class="image-attachment" href="${url}" target="_blank">
          <img src="${url}" alt="${fileName}">
        </a>
      `;
    }

    return `
      <a class="file-attachment" href="${url}" target="_blank">
        <span>File</span>
        <strong>${fileName}</strong>
        <small>${formatFileSize(message.file_size)}</small>
      </a>
    `;
  }

  function renderMessageTools(message) {
    if (Number(message.user_id) !== currentUserId) {
      return "";
    }

    return `
      <details class="message-tools">
        <summary>Manage</summary>
        <form action="/messages/${message.id}/edit" method="POST">
          <input type="hidden" name="channel_id" value="${channelId}">
          <textarea name="content" required>${escapeHtml(message.content)}</textarea>
          <button class="button secondary" type="submit">Save</button>
        </form>
        <form action="/messages/${message.id}/delete" method="POST">
          <input type="hidden" name="channel_id" value="${channelId}">
          <button class="button danger" type="submit">Delete</button>
        </form>
      </details>
    `;
  }

  function renderMessages(messages) {
    if (messages.length === 0) {
      messageList.innerHTML = `
        <div class="empty-chat">
          <div class="brand-mark">#</div>
          <h3>No messages yet</h3>
          <p>Start the conversation.</p>
        </div>
      `;
      return;
    }

    messageList.innerHTML = messages
      .map((message) => {
        const displayName = message.display_name || message.username;
        const edited = message.updated_at ? "<span>edited</span>" : "";
        const content = message.content
          ? `<p class="message-text">${escapeHtml(message.content)}</p>`
          : "";

        return `
          <article class="message">
            <div class="avatar" style="background:${escapeHtml(message.avatar_color)}">
              ${escapeHtml(getInitials(displayName))}
            </div>
            <div class="message-body">
              <div class="message-head">
                <strong>${escapeHtml(displayName)}</strong>
                <span>${formatDateTime(message.created_at)}</span>
                ${edited}
              </div>
              ${content}
              ${renderAttachment(message)}
              ${renderMessageTools(message)}
            </div>
          </article>
        `;
      })
      .join("");
  }

  async function refreshMessages(options = {}) {
    if (refreshInFlight) {
      return;
    }

    refreshInFlight = true;
    const shouldScroll = options.forceScroll || isNearBottom();

    try {
      const response = await fetch(`/channels/${channelId}/messages.json`, {
        headers: {
          Accept: "application/json"
        },
        credentials: "same-origin"
      });

      if (!response.ok) {
        throw new Error("Could not refresh messages.");
      }

      const data = await response.json();
      renderMessages(data.messages);

      if (messageCount) {
        messageCount.textContent = data.count;
      }

      if (shouldScroll) {
        scrollToBottom();
      }
    } catch (error) {
      console.error(error);
    } finally {
      refreshInFlight = false;
    }
  }

  function clearPreview() {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      previewUrl = null;
    }

    if (fileInput) {
      fileInput.value = "";
    }

    preview.hidden = true;
    preview.innerHTML = "";
  }

  function updatePreview() {
    const file = fileInput.files[0];

    if (!file) {
      clearPreview();
      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      previewUrl = null;
    }

    const imageUrl = file.type.startsWith("image/") ? URL.createObjectURL(file) : null;
    const imagePreview = imageUrl
      ? `<img src="${imageUrl}" alt="">`
      : '<div class="file-preview-icon">File</div>';

    previewUrl = imageUrl;

    preview.innerHTML = `
      <div class="preview-media">${imagePreview}</div>
      <div class="preview-meta">
        <strong>${escapeHtml(file.name)}</strong>
        <span>${formatFileSize(file.size)}</span>
      </div>
      <button class="icon-button" type="button" data-remove-attachment title="Remove attachment">Remove</button>
    `;
    preview.hidden = false;
  }

  fileInput?.addEventListener("change", updatePreview);

  preview?.addEventListener("click", (event) => {
    if (event.target.closest("[data-remove-attachment]")) {
      clearPreview();
    }
  });

  composer.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(composer);
    const content = String(formData.get("content") || "").trim();
    const file = fileInput?.files?.[0];

    if (!content && !file) {
      showError("Write a message or attach a file.");
      return;
    }

    sendButton.disabled = true;
    const originalText = sendButton.textContent;
    sendButton.textContent = "Sending";

    try {
      const response = await fetch(composer.action, {
        method: "POST",
        body: formData,
        headers: {
          Accept: "application/json",
          "X-Requested-With": "fetch"
        },
        credentials: "same-origin"
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Could not send message.");
      }

      composer.reset();
      clearPreview();
      await refreshMessages({ forceScroll: true });
    } catch (error) {
      showError(error.message);
    } finally {
      sendButton.disabled = false;
      sendButton.textContent = originalText;
    }
  });

  scrollToBottom();
  window.setInterval(() => {
    if (!document.hidden) {
      refreshMessages();
    }
  }, 2500);
})();
