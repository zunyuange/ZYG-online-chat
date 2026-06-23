/**
 * 浏览器端音频通知 —— 使用 Web Audio API 生成通知提示音
 * 无需外部音频文件，所有浏览器均支持
 * 
 * 关键：AudioContext 必须在用户首次交互后创建并保持存活，
 * 否则浏览器自动播放策略会阻止后续的音频输出。
 */

let audioContext: AudioContext | null = null;
let soundEnabled: boolean = true;

const STORAGE_KEY = 'chat_sound_enabled';

/** 
 * ★ 全局音频解锁：必须在用户首次交互（click/touch）时调用一次 
 * 之后 AudioContext 保持存活，SSE/轮询收到消息时可直接播放
 */
function tryUnlockAudio(): void {
  if (audioContext && audioContext.state !== 'suspended') return;
  try {
    if (!audioContext) {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }
    // 创建一个空缓冲区并播放，彻底激活 AudioContext
    const buf = audioContext.createBuffer(1, 1, 22050);
    const src = audioContext.createBufferSource();
    src.buffer = buf;
    src.connect(audioContext.destination);
    src.start(0);
    src.stop(audioContext.currentTime + 0.001);
    console.log('[NotificationSound] AudioContext unlocked, state:', audioContext.state);
  } catch (e) {
    console.warn('[NotificationSound] Audio unlock failed:', e);
  }
}

/** 初始化（需在用户交互后调用以符合浏览器自动播放策略） */
export function initSound(): void {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved !== null) {
    soundEnabled = saved === 'true';
  }
  // ★ 立即尝试解锁音频上下文
  tryUnlockAudio();
}

/** 获取/设置提示音开关 */
export function isSoundEnabled(): boolean {
  return soundEnabled;
}

export function setSoundEnabled(enabled: boolean): void {
  soundEnabled = enabled;
  localStorage.setItem(STORAGE_KEY, String(enabled));
}

function getAudioContext(): AudioContext {
  if (audioContext) {
    // 已有上下文：检查是否需要恢复
    if (audioContext.state === 'suspended') {
      audioContext.resume().catch(() => {});
    }
    return audioContext;
  }

  // ★ 优先复用 index.html 中预创建的共享 AudioContext（已解锁）
  const win = window as any;
  const ctx = (win.__shared_audio_ctx?.state !== 'closed')
    ? win.__shared_audio_ctx as AudioContext
    : new (window.AudioContext || (window as any).webkitAudioContext)();

  // 确保已解锁
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
  audioContext = ctx;
  return ctx;
}

/** ★ 暴露解锁方法，供 index.html 全局事件调用 */
export { tryUnlockAudio };

/**
 * 播放新消息提示音（清脆的 "叮咚" 双音效果）
 * 兼容 Chrome / Firefox / Edge / Safari / Opera
 */
export function playNotificationSound(): void {
  if (!soundEnabled) return;

  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // 第一声：高音 "叮" (880Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, now);
    gain1.gain.setValueAtTime(0.15, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.15);

    // 第二声：低音 "咚" (660Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(660, now + 0.1);
    gain2.gain.setValueAtTime(0, now + 0.1);
    gain2.gain.linearRampToValueAtTime(0.12, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.1);
    osc2.stop(now + 0.35);
  } catch {
    // 静默失败，不影响主流程
  }
}

/**
 * 播放提示音（简短单音，用于消息已读等轻通知）
 */
export function playTipSound(): void {
  if (!soundEnabled) return;

  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, now);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.08);
  } catch {
    // 静默失败
  }
}
