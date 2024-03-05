export const px = (px: number): string => {
	if (Number.isNaN(Number(px))) {
		return '0px';
	}
	return `${Number(px)}px`;
};
