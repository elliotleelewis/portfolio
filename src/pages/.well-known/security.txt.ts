// How to tell me about a security problem with the site, in the standard
// place (RFC 9116). It has to say when it expires, so it's written on each
// build, to expire a while after: every deploy pushes the date on.
import type { APIRoute } from 'astro';

// How long it's good for after a build. The RFC suggests under a year.
const daysValid = 180;

// eslint-disable-next-line @typescript-eslint/naming-convention -- Astro's name for it.
export const GET: APIRoute = ({ site }) => {
	const expires = new Date(Date.now() + daysValid * 24 * 60 * 60 * 1000);
	const lines = [
		// GitHub's private vulnerability reporting, so a report isn't public.
		'Contact: https://github.com/elliotleelewis/portfolio/security/advisories/new',
		'Contact: https://www.linkedin.com/in/elliotleelewis',
		`Expires: ${expires.toISOString()}`,
		`Canonical: ${new URL('/.well-known/security.txt', site).href}`,
		'Preferred-Languages: en',
	];
	return new Response(`${lines.join('\n')}\n`, {
		headers: { 'Content-Type': 'text/plain; charset=utf-8' },
	});
};
