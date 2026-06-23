/**
 * 浏览器端音频通知 —— 使用 Web Audio API 生成通知提示音
 * 无需外部音频文件，所有浏览器均支持
 */

let audioContext: AudioContext | null = null;
let soundEnabled: boolean = true;

const STORAGE_KEY = 'chat_sound_enabled';

/** 初始化（需在用户交互后调用以符合浏览器自动播放策略） */
export function initSound(): void {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved !== null) {
    soundEnabled = saved === 'true';
  }
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
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
  return audioContext;
}

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
