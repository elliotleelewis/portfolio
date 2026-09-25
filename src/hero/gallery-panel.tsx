import { useAtomValue } from 'jotai';
import { useEffect, useRef } from 'react';

import { GALLERY_ATOM, SCENE_ATOM } from './atoms';
import { useController } from './context';
import { hitsMessage } from './easter-egg-hits';

/**
 * The carousel controls for the easter egg gallery: a caption, arrows, a dot
 * for each egg, and a way back into the game.
 * @returns The panel.
 */
export const GalleryPanel = () => {
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
			aria-label="Easter egg gallery"
			aria-roledescription="carousel"
		>
			<div className="flex w-full max-w-md items-center gap-2">
				<button
					id="hero-gallery-prev"
					type="button"
					aria-label="Previous easter egg"
					className="size-11 shrink-0 cursor-pointer rounded-full bg-white/85 text-xl font-bold text-slate-900 shadow-lg backdrop-blur-md hover:bg-white focus-visible:ring-4 focus-visible:ring-amber-400/70 focus-visible:outline-none"
					onClick={() => {
						controller.previousEgg();
					}}
				>
					{/* Pointing back along the row, whichever way the page reads. */}
					<span className="inline-block rtl:-scale-x-100">←</span>
				</button>
				<div
					className="flex-1 rounded-2xl bg-white/85 px-4 py-3 text-center text-slate-900 shadow-xl backdrop-blur-md"
					aria-live="polite"
				>
					<p id="hero-gallery-caption" className="text-lg font-bold">
						{caption}
					</p>
					<p
						id="hero-gallery-hint"
						className="text-sm text-slate-600"
					>
						{smashes > 0
							? hitsMessage(smashes)
							: 'Barrel into it on the trail to find out'}
					</p>
				</div>
				<button
					id="hero-gallery-next"
					ref={next}
					type="button"
					aria-label="Next easter egg"
					className="size-11 shrink-0 cursor-pointer rounded-full bg-white/85 text-xl font-bold text-slate-900 shadow-lg backdrop-blur-md hover:bg-white focus-visible:ring-4 focus-visible:ring-amber-400/70 focus-visible:outline-none"
					onClick={() => {
						controller.nextEgg();
					}}
				>
					<span className="inline-block rtl:-scale-x-100">→</span>
				</button>
			</div>
			<div id="hero-gallery-dots" className="flex gap-2">
				{Array.from({ length: count }, (_value, i) => (
					<button
						key={i}
						type="button"
						aria-label={`Easter egg ${String(i + 1)}${
							(hits[i] ?? 0) > 0 ? '' : ', not found yet'
						}`}
						aria-current={i === index}
						data-active={i === index ? '' : undefined}
						className="size-2.5 cursor-pointer rounded-full bg-white/60 shadow-sm transition-all data-active:w-6 data-active:bg-white"
						onClick={() => {
							controller.selectEgg(i);
						}}
					/>
				))}
			</div>
			<button
				id="hero-gallery-again"
				type="button"
				className="cursor-pointer rounded-full bg-slate-900 px-5 py-2.5 font-semibold text-white shadow-lg hover:bg-slate-700 focus-visible:ring-4 focus-visible:ring-amber-400/70 focus-visible:outline-none"
				onClick={() => {
					controller.rollAgain();
				}}
			>
				Roll again
			</button>
		</div>
	);
};
