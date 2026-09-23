export const px = (px: number): string =>
	Number.isNaN(px) ? '0px' : `${String(px)}px`;
