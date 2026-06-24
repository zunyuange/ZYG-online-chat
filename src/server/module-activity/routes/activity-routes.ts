import { createRoute, z } from '@hono/zod-openapi';
import { OpenAPIHono } from '@hono/zod-openapi';
import * as activityService from '../services/activity-service';

const ErrorResponseSchema = z.object({
  success: z.boolean(),
  error: z.string(),
});

const ActivitySchema = z.object({
  id: z.number().int().positive(),
  businessId: z.number().int(),
  title: z.string(),
  description: z.string().optional(),
  type: z.enum(['lottery']),
  startTime: z.date(),
  endTime: z.date(),
  maxParticipants: z.number().int(),
  participantsCount: z.number().int(),
  dailyLimit: z.number().int(),
  status: z.enum(['draft', 'active', 'ended']),
  createdAt: z.date(),
  updatedAt: z.date(),
});

const PrizeSchema = z.object({
  id: z.number().int().positive(),
  activityId: z.number().int(),
  name: z.string(),
  imageUrl: z.string().optional(),
  quantity: z.number().int().nonnegative(),
  remainingQuantity: z.number().int().nonnegative(),
  probability: z.number().nonnegative(),
  sortOrder: z.number().int(),
  isEmpty: z.boolean(),
  isCard: z.boolean(),
  createdAt: z.date(),
});

const CardCodeSchema = z.object({
  id: z.number().int().positive(),
  prizeId: z.number().int(),
  code: z.string(),
  status: z.enum(['unused', 'used']),
  usedAt: z.date().optional(),
  usedBy: z.string().optional(),
  winnerId: z.number().int().optional(),
  createdAt: z.date(),
});

const WinnerSchema = z.object({
  id: z.number().int().positive(),
  activityId: z.number().int(),
  prizeId: z.number().int().optional(),
  visitorId: z.string(),
  visitorName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  sessionId: z.string().optional(),
  isClaimed: z.boolean(),
  claimedAt: z.date().optional(),
  cardCode: z.string().optional(),
  createdAt: z.date(),
  prize: PrizeSchema.optional(),
});

const CreateActivitySchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  type: z.enum(['lottery']).optional(),
  startTime: z.number().int(),
  endTime: z.number().int(),
  maxParticipants: z.number().int().nonnegative().optional(),
  dailyLimit: z.number().int().nonnegative().optional(),
});

const UpdateActivitySchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  type: z.enum(['lottery']).optional(),
  startTime: z.number().int().optional(),
  endTime: z.number().int().optional(),
  maxParticipants: z.number().int().nonnegative().optional(),
  dailyLimit: z.number().int().nonnegative().optional(),
  status: z.enum(['draft', 'active', 'ended']).optional(),
});

const CreatePrizeSchema = z.object({
  activityId: z.number().int().positive(),
  name: z.string().min(1).max(100),
  imageUrl: z.string().optional(),
  quantity: z.number().int().positive(),
  probability: z.number().nonnegative(),
  sortOrder: z.number().int().optional(),
  isEmpty: z.boolean().optional(),
  isCard: z.boolean().optional(),
});

const UpdatePrizeSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  imageUrl: z.string().optional(),
  quantity: z.number().int().positive().optional(),
  probability: z.number().nonnegative().optional(),
  sortOrder: z.number().int().optional(),
  isEmpty: z.boolean().optional(),
  isCard: z.boolean().optional(),
});

const BatchCreateCardCodesSchema = z.object({
  prizeId: z.number().int().positive(),
  codes: z.array(z.string().min(1)).min(1),
});

const DrawLotterySchema = z.object({
  activityId: z.number().int().positive(),
  visitorId: z.string(),
  visitorName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  sessionId: z.string().optional(),
});

const listActivitiesRoute = createRoute({
  method: 'get',
  path: '/activities',
  tags: ['activities'],
  request: {
    query: z.object({
      status: z.enum(['draft', 'active', 'ended']).optional(),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.array(ActivitySchema),
          }),
        },
      },
      description: 'List activities',
    },
  },
});

const getActivityRoute = createRoute({
  method: 'get',
  path: '/activities/{id}',
  tags: ['activities'],
  request: {
    params: z.object({
      id: z.string(),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: ActivitySchema,
          }),
        },
      },
      description: 'Get activity by ID',
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Activity not found',
    },
  },
});

const createActivityRoute = createRoute({
  method: 'post',
  path: '/activities',
  tags: ['activities'],
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreateActivitySchema,
        },
      },
    },
  },
  responses: {
    201: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: ActivitySchema,
          }),
        },
      },
      description: 'Create activity',
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Invalid input',
    },
  },
});

const updateActivityRoute = createRoute({
  method: 'put',
  path: '/activities/{id}',
  tags: ['activities'],
  request: {
    params: z.object({
      id: z.string(),
    }),
    body: {
      content: {
        'application/json': {
          schema: UpdateActivitySchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: ActivitySchema,
          }),
        },
      },
      description: 'Update activity',
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Activity not found',
    },
  },
});

const deleteActivityRoute = createRoute({
  method: 'delete',
  path: '/activities/{id}',
  tags: ['activities'],
  request: {
    params: z.object({
      id: z.string(),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.object({ id: z.number() }),
          }),
        },
      },
      description: 'Delete activity',
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Activity not found',
    },
  },
});

const listPrizesRoute = createRoute({
  method: 'get',
  path: '/activities/{id}/prizes',
  tags: ['prizes'],
  request: {
    params: z.object({
      id: z.string(),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.array(PrizeSchema),
          }),
        },
      },
      description: 'List prizes for activity',
    },
  },
});

const createPrizeRoute = createRoute({
  method: 'post',
  path: '/prizes',
  tags: ['prizes'],
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreatePrizeSchema,
        },
      },
    },
  },
  responses: {
    201: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: PrizeSchema,
          }),
        },
      },
      description: 'Create prize',
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Invalid input',
    },
  },
});

const updatePrizeRoute = createRoute({
  method: 'put',
  path: '/prizes/{id}',
  tags: ['prizes'],
  request: {
    params: z.object({
      id: z.string(),
    }),
    body: {
      content: {
        'application/json': {
          schema: UpdatePrizeSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: PrizeSchema,
          }),
        },
      },
      description: 'Update prize',
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Prize not found',
    },
  },
});

const deletePrizeRoute = createRoute({
  method: 'delete',
  path: '/prizes/{id}',
  tags: ['prizes'],
  request: {
    params: z.object({
      id: z.string(),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.object({ id: z.number() }),
          }),
        },
      },
      description: 'Delete prize',
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Prize not found',
    },
  },
});

const drawLotteryRoute = createRoute({
  method: 'post',
  path: '/activities/{id}/draw',
  tags: ['lottery'],
  request: {
    params: z.object({
      id: z.string(),
    }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            visitorId: z.string(),
            visitorName: z.string().optional(),
            phone: z.string().optional(),
            email: z.string().optional(),
            sessionId: z.string().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: WinnerSchema,
          }),
        },
      },
      description: 'Draw lottery',
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Cannot participate',
    },
  },
});

const listWinnersRoute = createRoute({
  method: 'get',
  path: '/activities/{id}/winners',
  tags: ['winners'],
  request: {
    params: z.object({
      id: z.string(),
    }),
    query: z.object({
      visitorId: z.string().optional(),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.array(WinnerSchema),
          }),
        },
      },
      description: 'List winners',
    },
  },
});

const listCardCodesRoute = createRoute({
  method: 'get',
  path: '/prizes/{id}/codes',
  tags: ['card-codes'],
  request: {
    params: z.object({
      id: z.string(),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.array(CardCodeSchema),
          }),
        },
      },
      description: 'List card codes for prize',
    },
  },
});

const batchCreateCardCodesRoute = createRoute({
  method: 'post',
  path: '/card-codes/batch',
  tags: ['card-codes'],
  request: {
    body: {
      content: {
        'application/json': {
          schema: BatchCreateCardCodesSchema,
        },
      },
    },
  },
  responses: {
    201: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.array(CardCodeSchema),
          }),
        },
      },
      description: 'Batch create card codes',
    },
  },
});

const getCardCodeCountRoute = createRoute({
  method: 'get',
  path: '/prizes/{id}/codes/count',
  tags: ['card-codes'],
  request: {
    params: z.object({
      id: z.string(),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.object({
              total: z.number(),
              unused: z.number(),
              used: z.number(),
            }),
          }),
        },
      },
      description: 'Get card code count',
    },
  },
});

const claimPrizeRoute = createRoute({
  method: 'post',
  path: '/winners/{id}/claim',
  tags: ['winners'],
  request: {
    params: z.object({
      id: z.string(),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: WinnerSchema,
          }),
        },
      },
      description: 'Claim prize',
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Already claimed',
    },
  },
});

const canParticipateRoute = createRoute({
  method: 'get',
  path: '/activities/{id}/can-participate',
  tags: ['lottery'],
  request: {
    params: z.object({
      id: z.string(),
    }),
    query: z.object({
      visitorId: z.string(),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.object({
              canParticipate: z.boolean(),
              message: z.string().optional(),
            }),
          }),
        },
      },
      description: 'Check if can participate',
    },
  },
});

export const activityRoutes = new OpenAPIHono()
  .openapi(listActivitiesRoute, async (c) => {
    const businessId = c.get('businessId') || 1;
    const status = c.req.query('status') as activityService.ActivityStatus | undefined;
    const activities = await activityService.listActivities(businessId, status);
    return c.json({ success: true, data: activities });
  })
  .openapi(getActivityRoute, async (c) => {
    const id = parseInt(c.req.param('id'));
    const activity = await activityService.getActivity(id);
    if (!activity) {
      return c.json({ success: false, error: 'Activity not found' }, 404);
    }
    return c.json({ success: true, data: activity });
  })
  .openapi(createActivityRoute, async (c) => {
    const businessId = c.get('businessId') || 1;
    const data = c.req.valid('json');
    const activity = await activityService.createActivity(businessId, data);
    return c.json({ success: true, data: activity }, 201);
  })
  .openapi(updateActivityRoute, async (c) => {
    const businessId = c.get('businessId') || 1;
    const id = parseInt(c.req.param('id'));
    const data = c.req.valid('json');
    const activity = await activityService.updateActivity(id, businessId, data);
    if (!activity) {
      return c.json({ success: false, error: 'Activity not found' }, 404);
    }
    return c.json({ success: true, data: activity });
  })
  .openapi(deleteActivityRoute, async (c) => {
    const businessId = c.get('businessId') || 1;
    const id = parseInt(c.req.param('id'));
    const result = await activityService.deleteActivity(id, businessId);
    if (!result) {
      return c.json({ success: false, error: 'Activity not found' }, 404);
    }
    return c.json({ success: true, data: { id } });
  })
  .openapi(listPrizesRoute, async (c) => {
    const activityId = parseInt(c.req.param('id'));
    const prizes = await activityService.listPrizes(activityId);
    return c.json({ success: true, data: prizes });
  })
  .openapi(createPrizeRoute, async (c) => {
    const data = c.req.valid('json');
    const prize = await activityService.createPrize(data);
    return c.json({ success: true, data: prize }, 201);
  })
  .openapi(updatePrizeRoute, async (c) => {
    const id = parseInt(c.req.param('id'));
    const data = c.req.valid('json');
    const prize = await activityService.updatePrize(id, data);
    if (!prize) {
      return c.json({ success: false, error: 'Prize not found' }, 404);
    }
    return c.json({ success: true, data: prize });
  })
  .openapi(deletePrizeRoute, async (c) => {
    const id = parseInt(c.req.param('id'));
    const result = await activityService.deletePrize(id);
    if (!result) {
      return c.json({ success: false, error: 'Prize not found' }, 404);
    }
    return c.json({ success: true, data: { id } });
  })
  .openapi(drawLotteryRoute, async (c) => {
    const activityId = parseInt(c.req.param('id'));
    const data = c.req.valid('json');
    try {
      const winner = await activityService.drawLottery(
        activityId,
        data.visitorId,
        data.visitorName,
        data.phone,
        data.email,
        data.sessionId
      );
      return c.json({ success: true, data: winner });
    } catch (error) {
      return c.json({ success: false, error: (error as Error).message }, 400);
    }
  })
  .openapi(listWinnersRoute, async (c) => {
    const activityId = parseInt(c.req.param('id'));
    const visitorId = c.req.query('visitorId');
    const winners = await activityService.listWinners(activityId, visitorId);
    return c.json({ success: true, data: winners });
  })
  .openapi(claimPrizeRoute, async (c) => {
    const id = parseInt(c.req.param('id'));
    const winner = await activityService.claimPrize(id);
    if (!winner) {
      return c.json({ success: false, error: 'Already claimed or not found' }, 400);
    }
    return c.json({ success: true, data: winner });
  })
  .openapi(canParticipateRoute, async (c) => {
    const activityId = parseInt(c.req.param('id'));
    const visitorId = c.req.query('visitorId') || '';
    const result = await activityService.canParticipate(activityId, visitorId);
    return c.json({ success: true, data: result });
  })
  .openapi(listCardCodesRoute, async (c) => {
    const prizeId = parseInt(c.req.param('id'));
    const status = c.req.query('status') as 'unused' | 'used' | undefined;
    const cardCodes = await activityService.listCardCodes(prizeId, status);
    return c.json({ success: true, data: cardCodes });
  })
  .openapi(batchCreateCardCodesRoute, async (c) => {
    const data = c.req.valid('json');
    const cardCodes = await activityService.batchCreateCardCodes(data);
    return c.json({ success: true, data: cardCodes }, 201);
  })
  .openapi(getCardCodeCountRoute, async (c) => {
    const prizeId = parseInt(c.req.param('id'));
    const count = await activityService.getCardCodeCount(prizeId);
    return c.json({ success: true, data: count });
  });