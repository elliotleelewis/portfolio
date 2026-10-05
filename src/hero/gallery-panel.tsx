import { useAtomValue } from 'jotai';
import { type FC, useEffect, useRef } from 'react';

import { m } from '../paraglide/messages';

import { GALLERY_ATOM, SCENE_ATOM } from './atoms';
import { Button } from './button';
import { Card } from './card';
import { useController } from './context';
import { hitsMessage } from './easter-egg-hits';

/**
 * The carousel controls for the easter egg gallery: a caption, arrows, a dot
 * for each egg, and a way back into the game.
 * @returns The panel.
 */
export const GalleryPanel: FC = () => {
	const controller = useController();
	const scene = useAtomValue(SCENE_ATOM);
	const { index, caption, count, hits } = useAtomValue(GALLERY_ATOM);
	const smashes = hits[index] ?? 0;
	const next = useRef<HTMLButtonElement>(null);

	useEffect(() => {
		if (scene === 'gallery') {
			next.current?.focus();
		}
	}, [scene]);

	return (
		<div
			id="hero-gallery"
			className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 px-4 pb-6 opacity-0 transition-opacity duration-500 group-data-[mode=gallery]:group-data-[state=playing]:pointer-events-auto group-data-[mode=gallery]:group-data-[state=playing]:opacity-100"
			role="region"
			aria-label={m.gallery_label()}
			aria-roledescription={m.gallery_carousel()}
		>
			<div className="flex w-full max-w-md items-center gap-2">
				<Button
					id="hero-gallery-prev"
					aria-label={m.gallery_previous()}
					variant="glass"
					className="size-11 shrink-0 rounded-full text-xl font-bold shadow-lg"
					onClick={() => {
						controller.previousEgg();
					}}
				>
					{/* Pointing back along the row, whichever way the page reads. */}
					<span className="inline-block rtl:-scale-x-100">←</span>
				</Button>
				<Card
					className="flex-1 px-4 py-3 text-center"
					aria-live="polite"
				>
					<p id="hero-gallery-caption" className="text-lg font-bold">
						{caption}
					</p>
					<p id="hero-gallery-hint" className="text-sm text-muted">
						{smashes > 0
							? hitsMessage(smashes)
							: m.gallery_find_out()}
					</p>
				</Card>
				<Button
					id="hero-gallery-next"
					ref={next}
					aria-label={m.gallery_next()}
					variant="glass"
					className="size-11 shrink-0 rounded-full text-xl font-bold shadow-lg"
					onClick={() => {
						controller.nextEgg();
					}}
				>
					<span className="inline-block rtl:-scale-x-100">→</span>
				</Button>
			</div>
			<div id="hero-gallery-dots" className="flex">
				{Array.from({ length: count }, (_value, i) => (
					<button
						key={i}
						type="button"
						aria-label={
							(hits[i] ?? 0) > 0
								? m.gallery_egg({ number: i + 1 })
								: m.gallery_egg_unfound({ number: i + 1 })
						}
						aria-current={i === index}
						data-active={i === index ? '' : undefined}
						// Bigger than the dot, so it's easy to tap.
						className="group flex h-6 min-w-6 cursor-pointer items-center justify-center px-1"
						onClick={() => {
							controller.selectEgg(i);
						}}
					>
						<span className="size-2.5 rounded-full bg-surface/60 shadow-sm transition-all group-data-active:w-6 group-data-active:bg-surface" />
					</button>
				))}
			</div>
			<Button
				id="hero-gallery-again"
				variant="primary"
				className="rounded-full px-5 py-2.5 shadow-lg"
				onClick={() => {
					controller.rollAgain();
				}}
			>
				{m.hero_roll_again()}
			</Button>
		</div>
	);
};
