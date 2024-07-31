export const formatPhoneNumber = (phoneNumber: number): string => {
	const cleaned = String(phoneNumber).replaceAll(/\D/g, '');
	const parts = /^(1|)?(\d{3})(\d{3})(\d{4})$/.exec(cleaned);
	if (!parts) {
		return '';
	}
	const countryCode = parts[1] ? `+${parts[1]} ` : '';
	return `${countryCode}(${parts[2]}) ${parts[3]}-${parts[4]}`;
};
