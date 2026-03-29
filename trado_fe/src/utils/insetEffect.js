// Inset Effect 工具函數
// 創建一個容器來放置效果元素
const createHolder = (node) => {
  // 確保節點有 position: relative
  const computedStyle = window.getComputedStyle(node);
  if (computedStyle.position === 'static') {
    node.style.position = 'relative';
  }
  
  // 確保節點有 overflow: hidden
  if (computedStyle.overflow === 'visible') {
    node.style.overflow = 'hidden';
  }
  
  // 創建 holder 元素
  const holder = document.createElement('div');
  holder.style.position = 'absolute';
  holder.style.top = '0';
  holder.style.left = '0';
  holder.style.width = '100%';
  holder.style.height = '100%';
  holder.style.pointerEvents = 'none';
  holder.style.zIndex = '1';
  holder.className = 'inset-effect-holder';
  
  node.appendChild(holder);
  return holder;
};

// 創建波紋點
const createDot = (holder, color, left, top) => {
  const dot = document.createElement('div');
  dot.style.position = 'absolute';
  dot.style.left = `${left}px`;
  dot.style.top = `${top}px`;
  dot.style.width = '0';
  dot.style.height = '0';
  dot.style.borderRadius = '50%';
  dot.style.backgroundColor = color;
  dot.style.transform = 'translate(-50%, -50%)';
  dot.style.transition = 'width 0.6s ease-out, height 0.6s ease-out, opacity 0.6s ease-out';
  dot.style.pointerEvents = 'none';
  dot.className = 'inset-effect-dot';
  
  holder.appendChild(dot);
  return dot;
};

// Inset Effect
export const showInsetEffect = (node, { event, component }) => {
  if (component !== 'Button') {
    return;
  }
  
  // 跳過禁用和載入中的按鈕
  if (node.disabled || node.classList.contains('ant-btn-loading')) {
    return;
  }
  
  const holder = createHolder(node);
  const rect = holder.getBoundingClientRect();
  const left = event.clientX - rect.left;
  const top = event.clientY - rect.top;
  
  // 根據按鈕類型選擇顏色
  let color = 'rgba(255, 255, 255, 0.65)';
  if (node.classList.contains('ant-btn-primary')) {
    color = 'rgba(255, 255, 255, 0.4)';
  } else if (node.classList.contains('ant-btn-text') || node.classList.contains('ant-btn-link')) {
    color = 'rgba(0, 0, 0, 0.1)';
  }
  
  const dot = createDot(holder, color, left, top);
  
  // 動畫效果
  requestAnimationFrame(() => {
    dot.ontransitionend = () => {
      holder.remove();
    };
    dot.style.width = '200px';
    dot.style.height = '200px';
    dot.style.opacity = '0';
  });
};
