/*
 * 轻量通知工具：统一悬浮/行内提示；示例：
 * notify.toast('保存成功');
 * notify.toast('请求失败', { variant: 'error', duration: 4000 });
 * notify.inline(hintEl, '请选择设备', { variant: 'warn' });
 */
(function () {
  const STYLE_ID = 'notify-style';
  const CONTAINER_ID = 'notify-container';
  const INLINE_CLASS = 'notify-inline';

  /* 确保通知样式已注入（仅注入一次） */
  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    // 内联样式：避免依赖外部 CSS，同时保证 Toast 层级与过渡效果
    style.textContent = `
      #${CONTAINER_ID} { position: fixed; top: 16px; right: 16px; z-index: 2000; display: flex; flex-direction: column; gap: 8px; pointer-events: none; }
      #${CONTAINER_ID} .notify-toast { min-width: 200px; max-width: 360px; padding: 12px 14px; border-radius: 6px; background: #1f2937; color: #f9fafb; box-shadow: 0 6px 24px rgba(0,0,0,0.15); opacity: 0; transform: translateY(-6px); transition: opacity 120ms ease, transform 120ms ease; font-size: 14px; line-height: 1.4; pointer-events: auto; }
      #${CONTAINER_ID} .notify-toast.show { opacity: 1; transform: translateY(0); }
      #${CONTAINER_ID} .notify-toast.info { background: #1f2937; }
      #${CONTAINER_ID} .notify-toast.success { background: #065f46; }
      #${CONTAINER_ID} .notify-toast.error { background: #7f1d1d; }
      #${CONTAINER_ID} .notify-toast.warn { background: #92400e; }
      .${INLINE_CLASS} { padding: 8px 10px; border-radius: 4px; font-size: 13px; line-height: 1.4; background: #f3f4f6; color: #111827; margin-top: 6px; }
      .${INLINE_CLASS}.success { background: #ecfdf3; color: #065f46; }
      .${INLINE_CLASS}.error { background: #fef2f2; color: #7f1d1d; }
      .${INLINE_CLASS}.warn { background: #fffbeb; color: #92400e; }
    `;
    document.head.appendChild(style);
  }

  /* 确保 toast 容器存在，若无则创建 */
  function ensureContainer() {
    let box = document.getElementById(CONTAINER_ID);
    if (!box) {
      box = document.createElement('div');
      box.id = CONTAINER_ID;
      document.body.appendChild(box);
    }
    return box;
  }

  /* 悬浮提示（右上角 Toast） */
  function toast(message, options = {}) {
    ensureStyle();
    const container = ensureContainer();
    // variant: info/success/error/warn；duration: 展示时长 ms
    const { variant = 'info', duration = 3000 } = options;
    const item = document.createElement('div');
    item.className = `notify-toast ${variant}`;
    item.textContent = message || '';
    container.appendChild(item);
    // 强制 reflow 以触发过渡动画
    void item.offsetWidth;
    item.classList.add('show');
    const timer = setTimeout(() => dismiss(item), duration);
    item.addEventListener('click', () => {
      clearTimeout(timer);
      dismiss(item);
    });
    return item;
  }

  /* 移除单条 toast（可由点击或超时触发） */
  function dismiss(node) {
    if (!node) return;
    node.classList.remove('show');
    setTimeout(() => node.remove(), 160);
  }

  /* 行内提示：插入到指定容器内部 */
  function inline(targetEl, message, options = {}) {
    if (!targetEl) return null;
    ensureStyle();
    const { variant = 'info' } = options;
    // 复用同一个提示节点，避免重复插入
    let existing = targetEl.querySelector(`.${INLINE_CLASS}`);
    if (!existing) {
      existing = document.createElement('div');
      existing.className = INLINE_CLASS;
      targetEl.appendChild(existing);
    }
    existing.textContent = message || '';
    existing.className = `${INLINE_CLASS} ${variant}`;
    return existing;
  }

  window.notify = { toast, inline, dismiss };
})();
