import { getDb } from '../../shared/db';

export type ActivityType = 'lottery';
export type ActivityStatus = 'draft' | 'active' | 'ended';

export interface Activity {
  id: number;
  businessId: number;
  title: string;
  description?: string;
  type: ActivityType;
  startTime: Date;
  endTime: Date;
  maxParticipants: number;
  participantsCount: number;
  dailyLimit: number;
  status: ActivityStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface ActivityPrize {
  id: number;
  activityId: number;
  name: string;
  imageUrl?: string;
  quantity: number;
  remainingQuantity: number;
  probability: number;
  sortOrder: number;
  isEmpty: boolean;
  isCard: boolean;
  createdAt: Date;
}

export interface CardCode {
  id: number;
  prizeId: number;
  code: string;
  status: 'unused' | 'used';
  usedAt?: Date;
  usedBy?: string;
  winnerId?: number;
  createdAt: Date;
}

export interface ActivityWinner {
  id: number;
  activityId: number;
  prizeId?: number;
  visitorId: string;
  visitorName?: string;
  phone?: string;
  email?: string;
  sessionId?: string;
  isClaimed: boolean;
  claimedAt?: Date;
  cardCode?: string;
  createdAt: Date;
  prize?: ActivityPrize;
}

export interface CreateActivityInput {
  title: string;
  description?: string;
  type?: ActivityType;
  startTime: number;
  endTime: number;
  maxParticipants?: number;
  dailyLimit?: number;
}

export interface CreatePrizeInput {
  activityId: number;
  name: string;
  imageUrl?: string;
  quantity: number;
  probability: number;
  sortOrder?: number;
  isEmpty?: boolean;
  isCard?: boolean;
}

export interface BatchCreateCardCodeInput {
  prizeId: number;
  codes: string[];
}

interface ActivityRow {
  id: number;
  business_id: number;
  title: string;
  description: string | null;
  type: string;
  start_time: number;
  end_time: number;
  max_participants: number;
  participants_count: number;
  daily_limit: number;
  status: string;
  created_at: number;
  updated_at: number;
}

interface PrizeRow {
  id: number;
  activity_id: number;
  name: string;
  image_url: string | null;
  quantity: number;
  remaining_quantity: number;
  probability: number;
  sort_order: number;
  is_empty: number;
  is_card: number;
  created_at: number;
}

interface WinnerRow {
  id: number;
  activity_id: number;
  prize_id: number | null;
  visitor_id: string;
  visitor_name: string | null;
  phone: string | null;
  email: string | null;
  session_id: string | null;
  is_claimed: number;
  claimed_at: number | null;
  card_code: string | null;
  created_at: number;
}

function rowToActivity(row: ActivityRow): Activity {
  return {
    id: row.id,
    businessId: row.business_id,
    title: row.title,
    description: row.description || undefined,
    type: row.type as ActivityType,
    startTime: new Date(row.start_time),
    endTime: new Date(row.end_time),
    maxParticipants: row.max_participants,
    participantsCount: row.participants_count,
    dailyLimit: row.daily_limit,
    status: row.status as ActivityStatus,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function rowToPrize(row: PrizeRow): ActivityPrize {
  return {
    id: row.id,
    activityId: row.activity_id,
    name: row.name,
    imageUrl: row.image_url || undefined,
    quantity: row.quantity,
    remainingQuantity: row.remaining_quantity,
    probability: row.probability,
    sortOrder: row.sort_order,
    isEmpty: row.is_empty === 1,
    isCard: row.is_card === 1,
    createdAt: new Date(row.created_at),
  };
}

function rowToWinner(row: WinnerRow): ActivityWinner {
  return {
    id: row.id,
    activityId: row.activity_id,
    prizeId: row.prize_id || undefined,
    visitorId: row.visitor_id,
    visitorName: row.visitor_name || undefined,
    phone: row.phone || undefined,
    email: row.email || undefined,
    sessionId: row.session_id || undefined,
    isClaimed: row.is_claimed === 1,
    claimedAt: row.claimed_at ? new Date(row.claimed_at) : undefined,
    cardCode: row.card_code || undefined,
    createdAt: new Date(row.created_at),
  };
}

export async function createActivity(
  businessId: number,
  input: CreateActivityInput
): Promise<Activity> {
  const db = getDb();
  const now = Date.now();

  const result = await db.run(
    `INSERT INTO activities (business_id, title, description, type, start_time, end_time, 
       max_participants, daily_limit, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      businessId,
      input.title,
      input.description || null,
      input.type || 'lottery',
      input.startTime,
      input.endTime,
      input.maxParticipants || 0,
      input.dailyLimit || 0,
      'draft',
      now,
      now,
    ]
  );

  const activity = await getActivity(result.lastInsertRowid);
  if (!activity) throw new Error('Failed to create activity');
  return activity;
}

export async function getActivity(id: number): Promise<Activity | null> {
  const db = getDb();
  const row = await db.get<ActivityRow>('SELECT * FROM activities WHERE id = ?', [id]);
  return row ? rowToActivity(row) : null;
}

export async function listActivities(
  businessId: number,
  status?: ActivityStatus
): Promise<Activity[]> {
  const db = getDb();
  let query = 'SELECT * FROM activities WHERE business_id = ?';
  const params: unknown[] = [businessId];

  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }

  query += ' ORDER BY created_at DESC';
  const rows = await db.all<ActivityRow>(query, params);
  return rows.map(rowToActivity);
}

export async function updateActivity(
  id: number,
  businessId: number,
  input: Partial<CreateActivityInput> & { status?: ActivityStatus }
): Promise<Activity | null> {
  const db = getDb();
  const now = Date.now();

  const updates: string[] = [];
  const params: unknown[] = [];

  if (input.title !== undefined) {
    updates.push('title = ?');
    params.push(input.title);
  }
  if (input.description !== undefined) {
    updates.push('description = ?');
    params.push(input.description);
  }
  if (input.type !== undefined) {
    updates.push('type = ?');
    params.push(input.type);
  }
  if (input.startTime !== undefined) {
    updates.push('start_time = ?');
    params.push(input.startTime);
  }
  if (input.endTime !== undefined) {
    updates.push('end_time = ?');
    params.push(input.endTime);
  }
  if (input.maxParticipants !== undefined) {
    updates.push('max_participants = ?');
    params.push(input.maxParticipants);
  }
  if (input.dailyLimit !== undefined) {
    updates.push('daily_limit = ?');
    params.push(input.dailyLimit);
  }
  if (input.status !== undefined) {
    updates.push('status = ?');
    params.push(input.status);
  }

  if (updates.length === 0) return getActivity(id);

  updates.push('updated_at = ?');
  params.push(now);
  params.push(id);
  params.push(businessId);

  await db.run(
    `UPDATE activities SET ${updates.join(', ')} WHERE id = ? AND business_id = ?`,
    params
  );

  return getActivity(id);
}

export async function deleteActivity(id: number, businessId: number): Promise<boolean> {
  const db = getDb();
  
  await db.run('DELETE FROM activity_winners WHERE activity_id = ?', [id]);
  await db.run('DELETE FROM activity_prizes WHERE activity_id = ?', [id]);
  
  const result = await db.run('DELETE FROM activities WHERE id = ? AND business_id = ?', [id, businessId]);
  return result.changes > 0;
}

export async function createPrize(input: CreatePrizeInput): Promise<ActivityPrize> {
  const db = getDb();
  const now = Date.now();

  const result = await db.run(
    `INSERT INTO activity_prizes (activity_id, name, image_url, quantity, remaining_quantity, 
       probability, sort_order, is_empty, is_card, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.activityId,
      input.name,
      input.imageUrl || null,
      input.quantity,
      input.quantity,
      input.probability,
      input.sortOrder || 0,
      input.isEmpty ? 1 : 0,
      input.isCard ? 1 : 0,
      now,
    ]
  );

  const prize = await getPrize(result.lastInsertRowid);
  if (!prize) throw new Error('Failed to create prize');
  return prize;
}

export async function getPrize(id: number): Promise<ActivityPrize | null> {
  const db = getDb();
  const row = await db.get<PrizeRow>('SELECT * FROM activity_prizes WHERE id = ?', [id]);
  return row ? rowToPrize(row) : null;
}

export async function listPrizes(activityId: number): Promise<ActivityPrize[]> {
  const db = getDb();
  const rows = await db.all<PrizeRow>(
    'SELECT * FROM activity_prizes WHERE activity_id = ? ORDER BY sort_order ASC',
    [activityId]
  );
  return rows.map(rowToPrize);
}

export async function updatePrize(
  id: number,
  input: Partial<Omit<CreatePrizeInput, 'activityId'>>
): Promise<ActivityPrize | null> {
  const db = getDb();

  const updates: string[] = [];
  const params: unknown[] = [];

  if (input.name !== undefined) {
    updates.push('name = ?');
    params.push(input.name);
  }
  if (input.imageUrl !== undefined) {
    updates.push('image_url = ?');
    params.push(input.imageUrl);
  }
  if (input.quantity !== undefined) {
    updates.push('quantity = ?');
    params.push(input.quantity);
  }
  if (input.probability !== undefined) {
    updates.push('probability = ?');
    params.push(input.probability);
  }
  if (input.sortOrder !== undefined) {
    updates.push('sort_order = ?');
    params.push(input.sortOrder);
  }
  if (input.isEmpty !== undefined) {
    updates.push('is_empty = ?');
    params.push(input.isEmpty ? 1 : 0);
  }
  if (input.isCard !== undefined) {
    updates.push('is_card = ?');
    params.push(input.isCard ? 1 : 0);
  }

  if (updates.length === 0) return getPrize(id);

  params.push(id);

  await db.run(`UPDATE activity_prizes SET ${updates.join(', ')} WHERE id = ?`, params);
  return getPrize(id);
}

export async function deletePrize(id: number): Promise<boolean> {
  const db = getDb();
  const result = await db.run('DELETE FROM activity_prizes WHERE id = ?', [id]);
  return result.changes > 0;
}

export async function drawLottery(
  activityId: number,
  visitorId: string,
  visitorName?: string,
  phone?: string,
  email?: string,
  sessionId?: string
): Promise<ActivityWinner | null> {
  const db = getDb();
  const now = Date.now();

  const activity = await getActivity(activityId);
  if (!activity) {
    throw new Error('活动不存在');
  }

  if (activity.status !== 'active') {
    throw new Error('活动未开启');
  }

  if (now < activity.startTime.getTime()) {
    throw new Error('活动尚未开始');
  }

  if (now > activity.endTime.getTime()) {
    throw new Error('活动已结束');
  }

  if (activity.maxParticipants > 0 && activity.participantsCount >= activity.maxParticipants) {
    throw new Error('参与人数已达上限');
  }

  if (activity.dailyLimit > 0) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const todayCount = await db.get<{ count: number }>(
      'SELECT COUNT(*) as count FROM activity_winners WHERE activity_id = ? AND created_at >= ? AND created_at < ?',
      [activityId, todayStart.getTime(), todayEnd.getTime()]
    );

    if (todayCount.count >= activity.dailyLimit) {
      throw new Error('今日抽奖次数已用完');
    }
  }

  const prizes = await listPrizes(activityId);
  
  if (prizes.length === 0) {
    throw new Error('活动暂无奖品');
  }

  const availablePrizes = prizes.filter((p) => !p.isEmpty && p.remainingQuantity > 0);
  
  if (availablePrizes.length === 0) {
    const emptyPrize = prizes.find((p) => p.isEmpty);
    if (emptyPrize) {
      const winner = await recordWinner(activityId, emptyPrize.id, visitorId, visitorName, phone, email, sessionId);
      await updateActivity(activityId, activity.businessId, { maxParticipants: activity.maxParticipants, dailyLimit: activity.dailyLimit });
      return winner;
    }
    throw new Error('奖品已全部抽完');
  }

  let totalProbability = availablePrizes.reduce((sum, p) => sum + p.probability, 0);
  
  if (totalProbability <= 0) {
    const emptyPrize = prizes.find((p) => p.isEmpty);
    if (emptyPrize) {
      const winner = await recordWinner(activityId, emptyPrize.id, visitorId, visitorName, phone, email, sessionId);
      return winner;
    }
    throw new Error('奖品已全部抽完');
  }

  let random = Math.random() * totalProbability;
  let selectedPrize: ActivityPrize | null = null;

  for (const prize of availablePrizes) {
    random -= prize.probability;
    if (random <= 0) {
      selectedPrize = prize;
      break;
    }
  }

  if (!selectedPrize) {
    selectedPrize = availablePrizes[availablePrizes.length - 1];
  }

  await db.run(
    'UPDATE activity_prizes SET remaining_quantity = remaining_quantity - 1 WHERE id = ?',
    [selectedPrize.id]
  );

  const winner = await recordWinner(activityId, selectedPrize.id, visitorId, visitorName, phone, email, sessionId);

  // 如果是卡密奖品，自动发放卡密
  if (selectedPrize.isCard) {
    const cardCode = await getUnusedCardCode(selectedPrize.id);
    if (cardCode) {
      // 更新卡密状态并关联中奖记录
      await useCardCode(cardCode.id, winner.id, visitorId);
      // 更新中奖记录的卡密字段
      await db.run(
        'UPDATE activity_winners SET card_code = ? WHERE id = ?',
        [cardCode.code, winner.id]
      );
      // 重新获取更新后的中奖记录
      const updatedWinner = await getWinner(winner.id);
      if (updatedWinner) {
        updatedWinner.cardCode = cardCode.code;
        return updatedWinner;
      }
    }
  }
  
  await db.run(
    'UPDATE activities SET participants_count = participants_count + 1 WHERE id = ?',
    [activityId]
  );

  return winner;
}

async function recordWinner(
  activityId: number,
  prizeId: number,
  visitorId: string,
  visitorName?: string,
  phone?: string,
  email?: string,
  sessionId?: string
): Promise<ActivityWinner> {
  const db = getDb();
  const now = Date.now();

  const result = await db.run(
    `INSERT INTO activity_winners (activity_id, prize_id, visitor_id, visitor_name, phone, 
       email, session_id, is_claimed, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [activityId, prizeId, visitorId, visitorName || null, phone || null, email || null, sessionId || null, 0, now]
  );

  const winner = await getWinner(result.lastInsertRowid);
  if (!winner) throw new Error('Failed to record winner');
  
  const prize = await getPrize(prizeId);
  if (prize) {
    winner.prize = prize;
  }
  
  return winner;
}

export async function getWinner(id: number): Promise<ActivityWinner | null> {
  const db = getDb();
  const row = await db.get<WinnerRow>('SELECT * FROM activity_winners WHERE id = ?', [id]);
  return row ? rowToWinner(row) : null;
}

export async function listWinners(
  activityId: number,
  visitorId?: string
): Promise<ActivityWinner[]> {
  const db = getDb();
  let query = 'SELECT * FROM activity_winners WHERE activity_id = ?';
  const params: unknown[] = [activityId];

  if (visitorId) {
    query += ' AND visitor_id = ?';
    params.push(visitorId);
  }

  query += ' ORDER BY created_at DESC';
  const rows = await db.all<WinnerRow>(query, params);
  
  const winners = rows.map(rowToWinner);
  
  for (const winner of winners) {
    if (winner.prizeId) {
      winner.prize = await getPrize(winner.prizeId);
    }
  }
  
  return winners;
}

export async function claimPrize(id: number): Promise<ActivityWinner | null> {
  const db = getDb();
  const now = Date.now();

  const result = await db.run(
    'UPDATE activity_winners SET is_claimed = 1, claimed_at = ? WHERE id = ? AND is_claimed = 0',
    [now, id]
  );

  if (result.changes === 0) {
    return null;
  }

  return getWinner(id);
}

export async function canParticipate(
  activityId: number,
  visitorId: string
): Promise<{ canParticipate: boolean; message?: string }> {
  const db = getDb();
  const now = Date.now();

  const activity = await getActivity(activityId);
  if (!activity) {
    return { canParticipate: false, message: '活动不存在' };
  }

  if (activity.status !== 'active') {
    return { canParticipate: false, message: '活动未开启' };
  }

  if (now < activity.startTime.getTime()) {
    return { canParticipate: false, message: '活动尚未开始' };
  }

  if (now > activity.endTime.getTime()) {
    return { canParticipate: false, message: '活动已结束' };
  }

  if (activity.maxParticipants > 0 && activity.participantsCount >= activity.maxParticipants) {
    return { canParticipate: false, message: '参与人数已达上限' };
  }

  if (activity.dailyLimit > 0) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const todayCount = await db.get<{ count: number }>(
      'SELECT COUNT(*) as count FROM activity_winners WHERE activity_id = ? AND visitor_id = ? AND created_at >= ? AND created_at < ?',
      [activityId, visitorId, todayStart.getTime(), todayEnd.getTime()]
    );

    if (todayCount.count >= activity.dailyLimit) {
      return { canParticipate: false, message: '今日抽奖次数已用完' };
    }
  }

  return { canParticipate: true };
}

// ========== Card Code Functions (卡密管理) ==========

interface CardCodeRow {
  id: number;
  prize_id: number;
  code: string;
  status: string;
  used_at: number | null;
  used_by: string | null;
  winner_id: number | null;
  created_at: number;
}

function rowToCardCode(row: CardCodeRow): CardCode {
  return {
    id: row.id,
    prizeId: row.prize_id,
    code: row.code,
    status: row.status as 'unused' | 'used',
    usedAt: row.used_at ? new Date(row.used_at) : undefined,
    usedBy: row.used_by || undefined,
    winnerId: row.winner_id || undefined,
    createdAt: new Date(row.created_at),
  };
}

export async function createCardCode(prizeId: number, code: string): Promise<CardCode> {
  const db = getDb();
  const now = Date.now();

  const result = await db.run(
    'INSERT INTO card_codes (prize_id, code, status, created_at) VALUES (?, ?, ?, ?)',
    [prizeId, code, 'unused', now]
  );

  const cardCode = await db.get<CardCodeRow>('SELECT * FROM card_codes WHERE id = ?', [result.lastInsertRowid]);
  if (!cardCode) throw new Error('Failed to create card code');

  return rowToCardCode(cardCode);
}

export async function batchCreateCardCodes(input: BatchCreateCardCodeInput): Promise<CardCode[]> {
  const db = getDb();
  const now = Date.now();
  const cardCodes: CardCode[] = [];

  for (const code of input.codes) {
    const result = await db.run(
      'INSERT INTO card_codes (prize_id, code, status, created_at) VALUES (?, ?, ?, ?)',
      [input.prizeId, code, 'unused', now]
    );

    const cardCode = await db.get<CardCodeRow>('SELECT * FROM card_codes WHERE id = ?', [result.lastInsertRowid]);
    if (cardCode) {
      cardCodes.push(rowToCardCode(cardCode));
    }
  }

  return cardCodes;
}

export async function listCardCodes(prizeId: number, status?: string): Promise<CardCode[]> {
  const db = getDb();
  let query = 'SELECT * FROM card_codes WHERE prize_id = ?';
  const params: unknown[] = [prizeId];

  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }

  query += ' ORDER BY created_at DESC';
  const rows = await db.all<CardCodeRow>(query, params);

  return rows.map(rowToCardCode);
}

export async function getUnusedCardCode(prizeId: number): Promise<CardCode | null> {
  const db = getDb();

  // Randomly select an unused card code
  const cardCode = await db.get<CardCodeRow>(
    'SELECT * FROM card_codes WHERE prize_id = ? AND status = ? ORDER BY RANDOM() LIMIT 1',
    [prizeId, 'unused']
  );

  return cardCode ? rowToCardCode(cardCode) : null;
}

export async function useCardCode(
  cardCodeId: number,
  winnerId: number,
  visitorId: string
): Promise<CardCode | null> {
  const db = getDb();
  const now = Date.now();

  const result = await db.run(
    'UPDATE card_codes SET status = ?, used_at = ?, used_by = ?, winner_id = ? WHERE id = ? AND status = ?',
    ['used', now, visitorId, winnerId, cardCodeId, 'unused']
  );

  if (result.changes === 0) {
    return null;
  }

  const cardCode = await db.get<CardCodeRow>('SELECT * FROM card_codes WHERE id = ?', [cardCodeId]);
  return cardCode ? rowToCardCode(cardCode) : null;
}

export async function getCardCodeCount(prizeId: number): Promise<{ total: number; unused: number; used: number }> {
  const db = getDb();

  const total = await db.get<{ count: number }>(
    'SELECT COUNT(*) as count FROM card_codes WHERE prize_id = ?',
    [prizeId]
  );

  const unused = await db.get<{ count: number }>(
    'SELECT COUNT(*) as count FROM card_codes WHERE prize_id = ? AND status = ?',
    [prizeId, 'unused']
  );

  const used = await db.get<{ count: number }>(
    'SELECT COUNT(*) as count FROM card_codes WHERE prize_id = ? AND status = ?',
    [prizeId, 'used']
  );

  return {
    total: total?.count || 0,
    unused: unused?.count || 0,
    used: used?.count || 0,
  };
}

export async function deleteCardCodes(prizeId: number): Promise<void> {
  const db = getDb();
  await db.run('DELETE FROM card_codes WHERE prize_id = ?', [prizeId]);
}