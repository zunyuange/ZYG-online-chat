/**
 * 浏览器端音频通知 —— 使用 Web Audio API 生成通知提示音
 * 无需外部音频文件，所有浏览器均支持
 * 
 * ★ 浏览器兼容：Chrome / Firefox / Edge / Safari / Opera / Samsung Internet
 * 
 * 关键设计：
 *   - AudioContext 在用户首次交互后创建并全局复用，避免被浏览器自动播放策略阻止
 *   - resume() 返回 Promise，必须 await 确保上下文真正恢复
 *   - Safari 需要在用户手势上下文中创建 AudioContext
 *   - 定期检测 AudioContext 状态并自动恢复（浏览器可能后台挂起）
 */

let audioContext: AudioContext | null = null;
let soundEnabled: boolean = true;
let initAttempted: boolean = false;

// ★ 提示音冷却（防止 3 秒轮询导致反复响铃）
let lastSoundTime: number = 0;
const SOUND_COOLDOWN_MS = 3000; // 同一来源 3 秒内最多响一次

const STORAGE_KEY = 'chat_sound_enabled';

/** 检测 AudioContext 构造函数（跨浏览器兼容） */
function getAudioContextConstructor(): typeof AudioContext | null {
  // Safari 旧版使用 webkitAudioContext 前缀
  const win = window as unknown as Record<string, unknown>;
  return (win.AudioContext || win.webkitAudioContext || null) as typeof AudioContext | null;
}

/** 
 * ★ 全局音频解锁：必须在用户首次交互时调用一次（同步创建 + resume）
 * 之后 AudioContext 保持存活，SSE/轮询收到消息时可直接播放
 */
async function tryUnlockAudio(): Promise<void> {
  if (initAttempted) return;
  initAttempted = true;

  try {
    const Ctor = getAudioContextConstructor();
    if (!Ctor) {
      console.warn('[Sound] AudioContext not supported in this browser');
      return;
    }

    // 优先复用 index.html 全局解锁的上下文
    const win = window as unknown as Record<string, unknown>;
    const sharedCtx = win.__shared_audio_ctx as AudioContext | undefined;
    if (sharedCtx && sharedCtx.state !== 'closed') {
      audioContext = sharedCtx;
    } else {
      audioContext = new Ctor();
    }

    // ★ 使用局部引用避免 TypeScript null 检查问题
    const ctx = audioContext;
    if (!ctx) return;

    // ★ 关键：必须 await resume()，否则 Safari/Firefox 可能仍处于 suspended
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    // 播放一个极短的静音缓冲区，彻底激活 AudioContext
    const buf = ctx.createBuffer(1, 1, ctx.sampleRate);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start(0);
    src.stop(ctx.currentTime + 0.001);

    console.log('[Sound] AudioContext unlocked, state:', ctx.state, 'sampleRate:', ctx.sampleRate);
  } catch (e) {
    console.warn('[Sound] Audio unlock failed:', e);
    initAttempted = false; // 允许重试
  }
}

/** 
 * 初始化（需在用户交互后调用）
 * ★ 改为 async，确保 resume() 完成
 */
export async function initSound(): Promise<void> {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved !== null) {
    soundEnabled = saved === 'true';
  }
  await tryUnlockAudio();
  // 即使首次失败，也设置 initAttempted=false 允许后续 getAudioContext 重试
  if (!audioContext) {
    initAttempted = false;
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

/**
 * ★ 获取或创建 AudioContext（每次播放前调用）
 * 处理浏览器中途挂起 Context 的情况（如标签页长期后台）
 */
function getAudioContext(): AudioContext | null {
  // 优先复用已存在的
  if (audioContext && audioContext.state !== 'closed') {
    if (audioContext.state === 'suspended') {
      // 尝试恢复（不 await，因为 play 函数会处理失败情况）
      audioContext.resume().catch(() => {
        console.warn('[Sound] Failed to resume suspended AudioContext');
      });
    }
    return audioContext;
  }

  // 尝试复用 index.html 中预创建的上下文
  const globalCtx = (window as unknown as Record<string, unknown>).__shared_audio_ctx as AudioContext | undefined;
  if (globalCtx && globalCtx.state !== 'closed') {
    audioContext = globalCtx;
    if (globalCtx.state === 'suspended') {
      globalCtx.resume().catch(() => {});
    }
    return globalCtx;
  }

  // 最后尝试新建
  try {
    const Ctor = getAudioContextConstructor();
    if (!Ctor) return null;

    audioContext = new Ctor();
    if (audioContext.state === 'suspended') {
      audioContext.resume().catch(() => {});
    }
    return audioContext;
  } catch {
    return null;
  }
}

/** ★ 暴露解锁方法，供外部调用 */
export { tryUnlockAudio };

/**
 * 播放新消息提示音（清脆的 "叮咚" 双音效果）
 * ★ 兼容 Chrome / Firefox / Edge / Safari / Opera / Samsung Internet
 * 
 * 设计要点：
 *   - 不使用 exponentialRampToValueAtTime(0.001) 避免 Safari 的奇怪行为
 *   - gain 值控制在 0.08-0.15 范围内，避免不同浏览器的音量差异过大
 *   - 播放完成后自动清理 oscillator 节点
 */
export function playNotificationSound(): void {
  if (!soundEnabled) return;

  // ★ 提示音冷却检查：防止短时间内重复响铃
  const now = Date.now();
  if (now - lastSoundTime < SOUND_COOLDOWN_MS) {
    return;
  }
  lastSoundTime = now;

  try {
    const ctx = getAudioContext();
    if (!ctx) {
      console.warn('[Sound] No AudioContext available, skipping sound');
      return;
    }

    // ★ 二次确认：如果 AudioContext 仍处于 suspended，尝试最后一次 resume
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
      // 如果是 suspended 状态，仍尝试播放（某些浏览器会排队等待 resume）
    }

    const now = ctx.currentTime;

    // 第一声：高音 "叮" (880Hz, 150ms)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, now);
    gain1.gain.setValueAtTime(0.12, now);
    gain1.gain.setValueAtTime(0.12, now + 0.05);
    gain1.gain.linearRampToValueAtTime(0.001, now + 0.15);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.15);
    // ★ 清理：播放完成后断开连接
    osc1.onended = () => {
      osc1.disconnect();
      gain1.disconnect();
    };

    // 第二声：低音 "咚" (660Hz, 250ms，略有延迟形成双音)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(660, now + 0.12);
    gain2.gain.setValueAtTime(0, now + 0.12);
    gain2.gain.linearRampToValueAtTime(0.10, now + 0.18);
    gain2.gain.linearRampToValueAtTime(0.001, now + 0.38);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.38);
    osc2.onended = () => {
      osc2.disconnect();
      gain2.disconnect();
    };
  } catch (e) {
    // ★ 如果播放失败，标记 AudioContext 为无效，下次重建
    console.warn('[Sound] Playback failed, will recreate AudioContext next time:', e);
    audioContext = null;
    initAttempted = false;
  }
}

/**
 * 播放提示音（简短单音，用于消息已读等轻通知）
 */
export function playTipSound(): void {
  if (!soundEnabled) return;

  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, now);
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.linearRampToValueAtTime(0.001, now + 0.08);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.08);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  } catch {
    // 静默失败
  }
}
