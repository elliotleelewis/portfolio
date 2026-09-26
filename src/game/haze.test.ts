import { ShaderChunk } from 'three';
import { describe, expect, it } from 'vitest';

import { fadeIntoHaze } from './haze';

describe('fadeIntoHaze', () => {
	it('fades out whatever the haze has swallowed, as well as tinting it', () => {
		fadeIntoHaze();
		const shader = ShaderChunk.fog_fragment;
		expect(shader).toContain(
			'mix( gl_FragColor.rgb, fogColor, fogFactor )',
		);
		expect(shader).toContain('discard');
	});

	it('measures the haze by how far away things are', () => {
		fadeIntoHaze();
		expect(ShaderChunk.fog_vertex).toContain('length( mvPosition.xyz )');
		expect(ShaderChunk.fog_vertex).not.toContain('- mvPosition.z');
	});

	it('only changes the shader once', () => {
		fadeIntoHaze();
		const once = [ShaderChunk.fog_vertex, ShaderChunk.fog_fragment];
		fadeIntoHaze();
		expect([ShaderChunk.fog_vertex, ShaderChunk.fog_fragment]).toEqual(
			once,
		);
	});
});
