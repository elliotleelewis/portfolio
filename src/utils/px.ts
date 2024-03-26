export const px = (px: number): string => {
	if (Number.isNaN(Number(px))) {
		return '0px';
	}
	return `${String(px)}px`;
};
