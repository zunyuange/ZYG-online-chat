export const onRequest: PagesFunction = async (context) => {
	const { request } = context;
	const url = new URL(request.url);
	const pathname = url.pathname;
	const isApiRoute = pathname.startsWith('/api/');
	const isUploadRoute = pathname.startsWith('/uploads/');

	if (!isApiRoute && !isUploadRoute) {
		return context.next();
	}

	const corsHeaders = {
		'Access-Control-Allow-Origin': '*',
		'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS, PUT, DELETE',
		'Access-Control-Allow-Headers': 'Content-Type, Authorization',
	};

	if (request.method === 'OPTIONS') {
		return new Response(null, { headers: corsHeaders });
	}

	const isLocalDev = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
	const workerUrl = isLocalDev ? 'http://localhost:8787' : 'https://zyg-online-chat.workers.dev';

	try {
		const forwardUrl = new URL(pathname + url.search, workerUrl);
		const forwardHeaders = new Headers(request.headers);
		forwardHeaders.set('X-Forwarded-Proto', url.protocol.replace(':', ''));
		forwardHeaders.set('X-Forwarded-Host', url.hostname);
		forwardHeaders.set('X-Original-URL', url.origin);

		const response = await fetch(new Request(forwardUrl.toString(), {
			method: request.method,
			headers: forwardHeaders,
			body: request.body,
		}));

		const headers = new Headers(response.headers);
		Object.entries(corsHeaders).forEach(([key, val]) => headers.set(key, val));

		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers,
		});

	} catch (error) {
		console.error('API proxy error:', error);
		return Response.json(
			{
				error: 'Failed to forward API request',
				message: String(error),
			},
			{ status: 502, headers: corsHeaders }
		);
	}
};