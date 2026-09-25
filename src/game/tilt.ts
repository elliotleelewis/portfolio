// Degrees either side of the resting angle that do nothing, and past which
// the tilt is at full strength.
const deadZone = 4;
const fullTilt = 18;
// How many readings to average for the resting angle.
const calibrationReadings = 8;

interface OrientationPermission {
	requestPermission?: () => Promise<'granted' | 'denied'>;
}

export interface Tilt {
	// Treat however the phone is held right now as neutral.
	recalibrate: () => void;
	stop: () => void;
}

/**
 * Whether this looks like a phone or tablet that can report its tilt.
 * @returns True for touch devices with an orientation sensor API.
 */
export const hasTilt = (): boolean =>
	'DeviceOrientationEvent' in globalThis &&
	globalThis.matchMedia('(pointer: coarse)').matches;

/**
 * Asks for permission to read the phone's tilt, which iOS insists on. Call
 * straight from a tap, before any other `await`, or iOS will refuse.
 * @returns Whether the tilt can be read.
 */
export const canUseTilt = async (): Promise<boolean> => {
	if (!hasTilt()) {
		return false;
	}
	const sensor = DeviceOrientationEvent as unknown as OrientationPermission;
	if (!sensor.requestPermission) {
		return true;
	}
	try {
		return (await sensor.requestPermission()) === 'granted';
	} catch {
		return false;
	}
};

/**
 * How far the top of the phone leans back towards me, in degrees: 0 lying
 * flat, 90 held upright, whichever way round the screen is.
 * @param event - An orientation reading.
 * @returns The pitch, or undefined if the sensor gave nothing.
 */
const pitchOf = (event: DeviceOrientationEvent): number | undefined => {
	const { beta, gamma } = event;
	if (beta === null || gamma === null) {
		return undefined;
	}
	const angle = globalThis.screen.orientation.angle;
	if (angle === 90 || angle === 270) {
		return Math.abs(gamma);
	}
	return angle === 180 ? -beta : beta;
};

/**
 * Follows the phone's tilt: leaning the top away from me reads towards +1
 * (faster), towards me towards -1 (slower), relative to how it was held
 * when it started.
 * @param onChange - Called with each new value, from -1 to 1.
 * @returns Controls to recalibrate or stop listening.
 */
export const followTilt = (onChange: (value: number) => void): Tilt => {
	let readings: number[] = [];
	let neutral: number | undefined;

	const onOrientation = (event: DeviceOrientationEvent): void => {
		const pitch = pitchOf(event);
		if (pitch === undefined) {
			return;
		}
		if (neutral === undefined) {
			readings.push(pitch);
			if (readings.length >= calibrationReadings) {
				neutral = readings.reduce((a, b) => a + b, 0) / readings.length;
			}
			return;
		}
		const lean = neutral - pitch;
		const strength = Math.min(
			1,
			Math.max(0, Math.abs(lean) - deadZone) / (fullTilt - deadZone),
		);
		onChange(Math.sign(lean) * strength);
	};

	globalThis.addEventListener('deviceorientation', onOrientation);
	return {
		recalibrate: () => {
			readings = [];
			neutral = undefined;
			onChange(0);
		},
		stop: () => {
			globalThis.removeEventListener('deviceorientation', onOrientation);
			onChange(0);
		},
	};
};
