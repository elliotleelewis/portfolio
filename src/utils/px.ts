export const px = (px: number): string => {
	if (Number.isNaN(px)) {
		return '0px';
	}
	return `${String(px)}px`;
};
