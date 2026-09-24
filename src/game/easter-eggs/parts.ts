import {
	type BufferGeometry,
	Group,
	type Material,
	Mesh,
	MeshStandardMaterial,
	type MeshStandardMaterialParameters,
	type Object3D,
} from 'three';

/**
 * Creates a standard material.
 * @param color - Base colour.
 * @param parameters - Any other material options.
 * @returns The material.
 */
export const standard = (
	color: string,
	parameters: MeshStandardMaterialParameters = {},
): MeshStandardMaterial =>
	new MeshStandardMaterial({ color, roughness: 0.85, ...parameters });

/**
 * Adds a shadow-casting mesh to a parent at a position.
 * @param parent - What to add the mesh to.
 * @param geometry - The mesh's geometry.
 * @param material - The mesh's material.
 * @param position - Local x, y and z.
 * @returns The mesh.
 */
export const part = (
	parent: Object3D,
	geometry: BufferGeometry,
	material: Material,
	position: [number, number, number],
): Mesh => {
	const mesh = new Mesh(geometry, material);
	mesh.position.set(...position);
	mesh.castShadow = true;
	mesh.receiveShadow = true;
	parent.add(mesh);
	return mesh;
};

/**
 * Adds an empty group (a joint) to a parent at a position.
 * @param parent - What to add the joint to.
 * @param position - Local x, y and z.
 * @returns The joint.
 */
export const joint = (
	parent: Object3D,
	position: [number, number, number],
): Group => {
	const group = new Group();
	group.position.set(...position);
	parent.add(group);
	return group;
};

/**
 * Frees every geometry, material and texture under an object.
 * @param object - The object to dispose.
 */
export const disposeObject = (object: Object3D): void => {
	object.traverse((child) => {
		if (!(child instanceof Mesh)) {
			return;
		}
		(child.geometry as BufferGeometry).dispose();
		const material = child.material as Material | Material[];
		const materials = Array.isArray(material) ? material : [material];
		for (const m of materials) {
			if (m instanceof MeshStandardMaterial) {
				m.map?.dispose();
			}
			m.dispose();
		}
	});
};
