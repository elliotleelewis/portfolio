"""Models me in Blender, from a base character, and exports me as
models/me.glb.

Run headless: `pnpm models:me` (Blender 4.2 on the PATH, or BLENDER set to
it). Pass `-- --preview DIR` to also render previews of me into DIR.

I start from Quaternius's Universal Base Characters (CC0, in
models/base/quaternius/): a rigged, game-ready body, with a face and
topology made to deform. This script makes him me: re-posed to the game's
rest pose, slimmed, dressed in a tee, walking trousers and trail shoes made
from his own surface (so they bend just as he does), given my hair, glasses,
grin and backpack, coloured from the game's palette, and shaded.

What the game needs of the model (the skeleton, the `blink` shape key and
materials named for their finishes) is in models/README.md. Blender's axes:
Z is up and I face -Y, so my left (+X) is the game's +X too.
"""

import math
import os
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..')
OUT = os.path.join(ROOT, 'models', 'me.glb')
BASE = os.path.join(ROOT, 'models', 'base', 'quaternius')

# ---------------------------------------------------------------------------
# Colours, as the game's palette would pick them (sRGB hex), and helpers.

COLOURS = {
    'skin': '#efc3a4',
    'hair': '#c9a46c',
    'hair_root': '#9c7a48',
    'shirt': '#868b84',
    'trousers': '#3e434a',
    'shoes': '#5b4a3a',
    'soles': '#2f2925',
    'pack': '#4e5452',
    'pack_trim': '#3a3f3d',
    'eye': '#2a211c',
    'brow': '#9c7a48',
    'mouth': '#6e3432',
    'teeth': '#f7f3e8',
    'lips': '#d99b86',
    'frames': '#b9bcbd',
}


def linear(hex_colour):
    """An sRGB hex colour, in linear RGB, as Blender's colour attributes are."""
    value = hex_colour.lstrip('#')
    channels = [int(value[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return [
        c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
        for c in channels
    ] + [1.0]


def smoothstep(edge0, edge1, x):
    t = max(0.0, min(1.0, (x - edge0) / (edge1 - edge0)))
    return t * t * (3 - 2 * t)


# ---------------------------------------------------------------------------
# Building blocks.

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def link(obj):
    bpy.context.collection.objects.link(obj)
    return obj


def select_only(obj):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def apply_modifiers(obj):
    select_only(obj)
    for modifier in list(obj.modifiers):
        bpy.ops.object.modifier_apply(modifier=modifier.name)


def paint(obj, colour):
    """Colours every vertex of an object one colour (a function of the
    vertex's position, or a hex colour)."""
    mesh = obj.data
    attribute = mesh.color_attributes.get('Col') or mesh.color_attributes.new(
        'Col', 'FLOAT_COLOR', 'POINT'
    )
    matrix = obj.matrix_world
    for i, vertex in enumerate(mesh.vertices):
        value = colour(matrix @ vertex.co) if callable(colour) else colour
        attribute.data[i].color = linear(value) if isinstance(value, str) else value
    mesh.color_attributes.active_color = attribute


def mix(a, b, t):
    """Two hex colours mixed, as a linear colour."""
    la, lb = linear(a), linear(b)
    return [la[i] + (lb[i] - la[i]) * t for i in range(3)] + [1.0]


def surface_of(obj):
    """Finds points on an object's surface, by casting rays at it."""
    tree = BVHTree.FromObject(obj, bpy.context.evaluated_depsgraph_get())
    # The tree is in the object's own space.
    to_local = obj.matrix_world.inverted()
    to_world = obj.matrix_world
    turn = to_world.to_3x3()

    def at(x, z, forward=-1, out=0.0):
        # From in front of it (or behind), straight back (or forward).
        origin = to_local @ Vector((x, forward * 1.0, z))
        direction = to_local.to_3x3() @ Vector((0, -forward, 0))
        hit, normal, _, _ = tree.ray_cast(origin, direction)
        if hit is None:
            raise ValueError(f'Nothing at x={x}, z={z}')
        normal = (turn @ normal).normalized()
        return to_world @ hit + normal * out, normal

    return at


def mesh_object(name, verts, faces=(), edges=()):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, list(edges), list(faces))
    mesh.update()
    return link(bpy.data.objects.new(name, mesh))


def primitive(kind, name, **kwargs):
    getattr(bpy.ops.mesh, f'primitive_{kind}_add')(**kwargs)
    obj = bpy.context.active_object
    obj.name = name
    return obj


def smooth(obj):
    select_only(obj)
    bpy.ops.object.shade_smooth()
    return obj


def bevel(obj, width, segments=2):
    modifier = obj.modifiers.new('bevel', 'BEVEL')
    modifier.width = width
    modifier.segments = segments
    modifier.limit_method = 'ANGLE'
    return obj


def tube(name, points, radii, sides=8, closed=False):
    """A tube along a curve through points, thicker or thinner at each."""
    curve = bpy.data.curves.new(name, 'CURVE')
    curve.dimensions = '3D'
    curve.bevel_depth = 1.0
    curve.bevel_resolution = max(1, sides // 4 - 1)
    curve.resolution_u = 4
    curve.use_fill_caps = True
    spline = curve.splines.new('NURBS')
    spline.points.add(len(points) - 1)
    for point, at, radius in zip(spline.points, points, radii):
        point.co = (*at, 1.0)
        point.radius = radius
    spline.use_endpoint_u = True
    spline.order_u = min(4, len(points))
    spline.use_cyclic_u = closed
    obj = link(bpy.data.objects.new(name, curve))
    select_only(obj)
    bpy.ops.object.convert(target='MESH')
    return bpy.context.active_object



def tuft(base, lean, across, length, width, bend):
    """A lock of hair: a flattened, tapering spike, bent a little."""
    up = lean.normalized()
    side = across.normalized()
    depth = up.cross(side).normalized()
    sides = 6
    verts = []
    for ring, (along, scale) in enumerate(((0.0, 1.0), (0.5, 0.55), (1.0, 0.0))):
        centre = base + up * length * along + depth * bend * along * along
        if scale == 0:
            verts.append(tuple(centre))
            continue
        for k in range(sides):
            angle = 2 * math.pi * k / sides
            verts.append(tuple(
                centre
                + side * math.cos(angle) * width * scale
                + depth * math.sin(angle) * width * 0.5 * scale
            ))
    faces = [tuple(range(sides))[::-1]]
    for k in range(sides):
        n = (k + 1) % sides
        faces.append((k, n, sides + n, sides + k))
        faces.append((sides + k, sides + n, 2 * sides))
    obj = mesh_object('tuft', verts, faces)
    return obj



def bake_shading(obj, strength=0.55):
    scene = bpy.context.scene
    # Only nearby things shade each other: creases, not my whole side.
    scene.world = scene.world or bpy.data.worlds.new('bake')
    scene.world.light_settings.distance = 0.12
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 64
    mesh = obj.data
    colours = mesh.color_attributes['Col']
    shade = mesh.color_attributes.new('AO', 'FLOAT_COLOR', 'POINT')
    mesh.color_attributes.active_color = shade
    for material in mesh.materials:
        material.use_nodes = True
    select_only(obj)
    scene.render.bake.target = 'VERTEX_COLORS'
    bpy.ops.object.bake(type='AO')
    # What's painted on my face keeps its colour: shaded, it'd disappear.
    group = mesh.vertices and obj.vertex_groups.get('unshaded')
    unshaded = {
        v.index for v in mesh.vertices
        if group and any(g.group == group.index for g in v.groups)
    }
    for i in range(len(colours.data)):
        if i in unshaded:
            continue
        ao = shade.data[i].color[0]
        factor = 1 - strength + strength * ao
        c = colours.data[i].color
        colours.data[i].color = (c[0] * factor, c[1] * factor, c[2] * factor, 1.0)
    mesh.color_attributes.remove(shade)
    mesh.color_attributes.active_color = mesh.color_attributes['Col']
    mesh.color_attributes.render_color_index = mesh.color_attributes.active_color_index


def material(name, alpha=1.0, roughness=0.9, metalness=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    bsdf = nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (1, 1, 1, 1)
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = metalness
    bsdf.inputs['Alpha'].default_value = alpha
    # The colours are on the vertices (the game multiplies them in).
    attribute = nodes.new('ShaderNodeVertexColor')
    attribute.layer_name = 'Col'
    mat.node_tree.links.new(attribute.outputs['Color'], bsdf.inputs['Base Color'])
    if alpha < 1:
        mat.surface_render_method = 'BLENDED'
    return mat


def join(objects, name):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    joined = bpy.context.active_object
    joined.name = name
    return joined



# ---------------------------------------------------------------------------
# The base: Quaternius's Superhero male, his eyes, brows and buzzed hair.

def load_base():
    reset()
    bpy.ops.import_scene.gltf(filepath=os.path.join(BASE, 'Superhero_Male_FullBody.gltf'))
    armature = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
    armature.name = 'skeleton'
    body = bpy.data.objects['SuperHero_Male']
    eyes = bpy.data.objects['Eyes']
    brows = bpy.data.objects['Eyebrows']
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(BASE, 'Hair_Buzzed.gltf'))
    imported = set(bpy.data.objects) - before
    hair = next(o for o in imported if o.type == 'MESH' and o.name.startswith('Hair'))
    # The hair comes on a skeleton of its own: put it on mine.
    world = hair.matrix_world.copy()
    hair.parent = armature
    hair.matrix_world = world
    for modifier in hair.modifiers:
        if modifier.type == 'ARMATURE':
            modifier.object = armature
    for obj in list(bpy.data.objects):
        if obj.name.startswith('Icosphere') or (obj in imported and obj is not hair):
            bpy.data.objects.remove(obj)
    return armature, body, eyes, brows, hair


def world_bone(armature, name):
    bone = armature.data.bones[name]
    matrix = armature.matrix_world
    return matrix @ bone.head_local, matrix @ bone.tail_local


def turn_about_forward(armature, angles):
    """Turns bones about my forward axis (Blender's Y), about their heads, in
    pose mode."""
    select_only(armature)
    bpy.ops.object.mode_set(mode='POSE')
    for name, angle in angles.items():
        bone = armature.pose.bones[name]
        head = bone.head.copy()
        bone.matrix = (
            Matrix.Translation(head) @ Matrix.Rotation(angle, 4, 'Y')
            @ Matrix.Translation(-head) @ bone.matrix
        )
        bpy.context.view_layer.update()
    bpy.ops.object.mode_set(mode='OBJECT')


def rest_as_posed(armature, meshes):
    """Makes how I'm posed now my rest pose: my meshes take the pose, then my
    skeleton does."""
    for mesh in meshes:
        select_only(mesh)
        skin = next((m for m in mesh.modifiers if m.type == 'ARMATURE'), None)
        if skin is None:
            continue
        bpy.ops.object.modifier_copy(modifier=skin.name)
        copy = mesh.modifiers[-1]
        bpy.ops.object.modifier_move_to_index(modifier=copy.name, index=0)
        bpy.ops.object.modifier_apply(modifier=copy.name)
    select_only(armature)
    bpy.ops.object.mode_set(mode='POSE')
    bpy.ops.pose.select_all(action='SELECT')
    bpy.ops.pose.armature_apply(selected=False)
    bpy.ops.object.mode_set(mode='OBJECT')


def add_contacts(armature):
    """Where my hands and feet touch the ground mid-cartwheel: my palms and
    soles, as bones that move with them but skin nothing. They're part of the
    game's humanoid skeleton (models/README.md), which is otherwise the
    base's own."""
    select_only(armature)
    bpy.ops.object.mode_set(mode='EDIT')
    bones = armature.data.edit_bones
    for side in ('l', 'r'):
        hand = bones[f'hand_{side}']
        along = (hand.tail - hand.head).normalized()
        palm = bones.new(f'palm_{side}')
        palm.head = hand.head + along * 0.075
        palm.tail = palm.head + along * 0.04
        palm.parent = hand
        palm.use_deform = False
        foot = bones[f'foot_{side}']
        sole = bones.new(f'sole_{side}')
        sole.head = Vector((foot.head.x, foot.head.y - 0.035, 0.02))
        sole.tail = sole.head + Vector((0, -0.08, 0))
        sole.parent = foot
        sole.use_deform = False
    bpy.ops.object.mode_set(mode='OBJECT')


# ---------------------------------------------------------------------------
# Making him me: slimmer than a superhero.

# How far in toward each bone the flesh round it comes.
SLIM = {
    'upperarm_l': 0.8, 'upperarm_r': 0.8,
    'lowerarm_l': 0.86, 'lowerarm_r': 0.86,
    'neck_01': 0.86,
    'spine_02': 0.9, 'spine_03': 0.86,
    'thigh_l': 0.92, 'thigh_r': 0.92,
    'calf_l': 0.94, 'calf_r': 0.94,
}


def closest_on(head, tail, point):
    along = tail - head
    t = max(0.0, min(1.0, (point - head).dot(along) / along.length_squared))
    return head + along * t


def slim(armature, body):
    segments = {name: world_bone(armature, name) for name in SLIM}
    groups = {g.index: g.name for g in body.vertex_groups}
    matrix = body.matrix_world
    inverse = matrix.inverted()
    for vertex in body.data.vertices:
        at = matrix @ vertex.co
        moved = Vector((0, 0, 0))
        total = 0.0
        for g in vertex.groups:
            name = groups[g.group]
            weight = g.weight
            if weight <= 0:
                continue
            if name in SLIM:
                centre = closest_on(*segments[name], at)
                moved += (centre + (at - centre) * SLIM[name]) * weight
            else:
                moved += at * weight
            total += weight
        if total > 0:
            vertex.co = inverse @ (moved / total)


def dominant_bone(obj):
    """The bone that moves each vertex of an object most."""
    groups = {g.index: g.name for g in obj.vertex_groups}
    result = []
    for vertex in obj.data.vertices:
        best = max(vertex.groups, key=lambda g: g.weight, default=None)
        result.append(groups[best.group] if best else None)
    return result


# ---------------------------------------------------------------------------
# Colour.

def texture_pixels(name):
    image = bpy.data.images.load(os.path.join(BASE, name))
    width, height = image.size
    pixels = np.empty(width * height * 4, dtype=np.float32)
    image.pixels.foreach_get(pixels)
    return pixels.reshape(height, width, 4), width, height


def sample(texture, uv):
    pixels, width, height = texture
    x = min(width - 1, max(0, int(uv[0] % 1.0 * width)))
    y = min(height - 1, max(0, int(uv[1] % 1.0 * height)))
    return pixels[y, x, :3]


def vertex_uvs(obj):
    """Each vertex's UV (the first of its corners')."""
    mesh = obj.data
    uv = mesh.uv_layers.active.data
    result = [None] * len(mesh.vertices)
    for loop in mesh.loops:
        if result[loop.vertex_index] is None:
            result[loop.vertex_index] = uv[loop.index].uv.copy()
    return result


def paint_skin(body):
    """My skin, in the game's skin tone, keeping the base's painted detail:
    lips, cheeks and the shading of the face, as lighter and darker than its
    average."""
    texture = texture_pixels('T_Superhero_Male_Light.png')
    uvs = vertex_uvs(body)
    samples = np.array([sample(texture, uv) if uv else (0.6, 0.45, 0.35) for uv in uvs])
    average = samples.mean(axis=0)
    skin = np.array(linear(COLOURS['skin'])[:3])
    attribute = body.data.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
    for i, colour in enumerate(samples):
        detail = np.clip(colour / average, 0.6, 1.4)
        attribute.data[i].color = (*(skin * detail), 1.0)
    body.data.color_attributes.active_color = attribute


def paint_eyes(eyes):
    texture = texture_pixels('T_Eye_Brown.png')
    uvs = vertex_uvs(eyes)
    attribute = eyes.data.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
    for i, uv in enumerate(uvs):
        srgb = sample(texture, uv) if uv else (1, 1, 1)
        attribute.data[i].color = (*[c ** 2.2 for c in srgb], 1.0)
    eyes.data.color_attributes.active_color = attribute


# ---------------------------------------------------------------------------
# Clothes, made from my own surface, so they bend just as I do.

# How much looser than me each piece of clothing hangs, round each bone.
LOOSE = {
    'pelvis': 1.1, 'spine_01': 1.1, 'spine_02': 1.08, 'spine_03': 1.05,
    'upperarm_l': 1.2, 'upperarm_r': 1.2,
    'thigh_l': 1.16, 'thigh_r': 1.16, 'calf_l': 1.24, 'calf_r': 1.24,
}


TORSO = {'pelvis', 'spine_01', 'spine_02', 'spine_03'}
LEGS = {'thigh_l', 'thigh_r'}


def loosen(armature, obj, is_tee=False):
    """Clothes hang off me rather than cling: out from each bone they're on."""
    segments = {name: world_bone(armature, name) for name in LOOSE}
    groups = {g.index: g.name for g in obj.vertex_groups}
    matrix = obj.matrix_world
    inverse = matrix.inverted()
    for vertex in obj.data.vertices:
        at = matrix @ vertex.co
        moved = Vector((0, 0, 0))
        total = 0.0
        for g in vertex.groups:
            name = groups[g.group]
            if g.weight <= 0:
                continue
            if name in LOOSE:
                centre = closest_on(*segments[name], at)
                factor = LOOSE[name]
                if name in TORSO:
                    # Out round my middle, never down past my hem.
                    centre.z = at.z
                if name in LEGS and is_tee:
                    # My tee hangs round my hips as it does round my middle.
                    factor = LOOSE['pelvis']
                    centre.z = at.z
                elif name in LEGS:
                    # Loose down my legs, but snug at my hips, under my tee.
                    factor = 1 + (factor - 1) * smoothstep(0.95, 0.8, at.z)
                moved += (centre + (at - centre) * factor) * g.weight
            else:
                moved += at * g.weight
            total += g.weight
        if total > 0:
            vertex.co = inverse @ (moved / total)


def shell(source, name, keep, cuts, colour):
    """Clothing from my own surface: a copy of the faces `keep` keeps, cut
    clean along planes (each `(point, normal, bones)`: what's past the plane,
    along its normal, goes), smoothed of my muscles, and coloured. It keeps
    my weights, so it bends just as I do."""
    obj = source.copy()
    obj.data = source.data.copy()
    obj.name = name
    link(obj)
    bones = dominant_bone(source)
    matrix = source.matrix_world
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.verts.ensure_lookup_table()
    keepers = {v.index for v in bm.verts if keep(matrix @ v.co, bones[v.index])}
    doomed = [f for f in bm.faces if not all(v.index in keepers for v in f.verts)]
    bmesh.ops.delete(bm, geom=doomed, context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    deform = bm.verts.layers.deform.active
    names = {g.index: g.name for g in obj.vertex_groups}
    for point, normal, only in cuts:
        def leading(v):
            weights = v[deform]
            return names[max(weights.keys(), key=lambda k: weights[k])] if weights else None
        geom = [f for f in bm.faces if only is None or any(leading(v) in only for v in f.verts)]
        geom = geom + list({e for f in geom for e in f.edges}) + list({v for f in geom for v in f.verts})
        bmesh.ops.bisect_plane(
            bm, geom=geom, plane_co=point, plane_no=normal, clear_outer=True,
        )
    # Smoothed, but not at the edges, which stay where they were cut.
    inner = [v for v in bm.verts if not v.is_boundary]
    for _ in range(8):
        bmesh.ops.smooth_vert(bm, verts=inner, factor=0.5,
                              use_axis_x=True, use_axis_y=True, use_axis_z=True)
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.color_attributes.remove(obj.data.color_attributes['Col'])
    paint(obj, colour)
    return obj, keepers


def follow_arms(obj):
    """My sleeves move with my arms, all of them: what my arm moves most, it
    moves alone, so the hem doesn't trail behind as I raise my arm. Nearer
    my shoulder, they still blend into my body."""
    for name in ('upperarm_l', 'upperarm_r'):
        arm = obj.vertex_groups[name].index
        for vertex in obj.data.vertices:
            weight = next((g.weight for g in vertex.groups if g.group == arm), 0.0)
            if weight > 0.6:
                for g in vertex.groups:
                    g.weight = 1.0 if g.group == arm else 0.0


def offset_out(obj, distance):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.normal_update()
    for v in bm.verts:
        v.co += v.normal * distance
    bm.to_mesh(obj.data)
    bm.free()


def build_shoes(armature):
    """Trail shoes: a rounded upper, wider at the toe, on a darker sole, each
    moving with my foot."""
    shoes = []
    for side in ('l', 'r'):
        ankle = world_bone(armature, f'foot_{side}')[0]
        for name, at, size, colour in (
            ('shoe', Vector((ankle.x, ankle.y - 0.045, 0.062)), (0.11, 0.27, 0.1), 'shoes'),
            ('sole', Vector((ankle.x, ankle.y - 0.048, 0.016)), (0.118, 0.282, 0.032), 'soles'),
        ):
            obj = primitive('cube', name, size=1, location=at)
            obj.scale = size
            select_only(obj)
            bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
            if name == 'shoe':
                for vertex in obj.data.vertices:
                    x, y, z = vertex.co
                    toe = smoothstep(0.0, -0.12, y)
                    vertex.co = (x * (1 + 0.1 * toe), y, z - 0.03 * toe * (1 if z > 0 else 0))
            bevel(obj, 0.02 if name == 'shoe' else 0.01, 3)
            apply_modifiers(obj)
            smooth(obj)
            paint(obj, COLOURS[colour])
            rigid(obj, armature, f'foot_{side}')
            shoes.append(obj)
    return shoes


def dress(armature, body):
    """A grey tee with short sleeves, walking trousers and trail shoes."""
    hem = 0.93
    torso = {'pelvis', 'spine_01', 'spine_02', 'spine_03', 'clavicle_l', 'clavicle_r'}
    arms = {'upperarm_l', 'upperarm_r'}

    def tee(at, bone):
        # Down over my hips (moved mostly by my legs) to the hem.
        return (bone in arms and at.z > 1.1) or (bone in torso | LEGS and hem - 0.04 < at.z)

    def trousers(at, bone):
        return bone in {'pelvis', 'thigh_l', 'thigh_r', 'calf_l', 'calf_r'} and 0.1 < at.z < 1.06

    sleeve_cuts = []
    for name in arms:
        shoulder, elbow = world_bone(armature, name)
        along = (elbow - shoulder).normalized()
        sleeve_cuts.append((shoulder + along * 0.17, along, {name}))
    shirt, under_shirt = shell(
        body, 'tee', tee,
        [(Vector((0, 0, hem)), Vector((0, 0, -1)), None)] + sleeve_cuts,
        COLOURS['shirt'],
    )
    legs, under_legs = shell(
        body, 'trousers', trousers,
        [(Vector((0, 0, 0.15)), Vector((0, 0, -1)), None),
         (Vector((0, 0, 1.03)), Vector((0, 0, 1)), None)],
        COLOURS['trousers'],
    )
    loosen(armature, shirt, is_tee=True)
    follow_arms(shirt)
    loosen(armature, legs)
    offset_out(shirt, 0.012)
    offset_out(legs, 0.006)
    # A collar round my neck, where the tee ends.
    neck = world_bone(armature, 'neck_01')[0]
    collar = primitive(
        'torus', 'collar', major_radius=0.066, minor_radius=0.011,
        major_segments=20, minor_segments=5, location=neck + Vector((0, -0.01, -0.012)),
        rotation=(-0.3, 0, 0),
    )
    collar.scale = (1, 0.9, 1)
    select_only(collar)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    smooth(collar)
    paint(collar, COLOURS['shirt'])
    rigid(collar, armature, 'spine_03')
    shoes = build_shoes(armature)

    # The skin under my clothes and shoes is never seen: take it away, so it
    # can't poke through as I bend, and isn't drawn for nothing.
    bones = dominant_bone(body)
    feet = {i for i, b in enumerate(bones) if b in {'foot_l', 'foot_r', 'ball_l', 'ball_r'}}
    feet |= {v.index for v in body.data.vertices if (body.matrix_world @ v.co).z < 0.1}
    hidden = under_shirt | under_legs | feet
    bm = bmesh.new()
    bm.from_mesh(body.data)
    covered = [f for f in bm.faces if all(v.index in hidden for v in f.verts)]
    # Keep the skin right at each edge of my clothes, so there's no gap.
    edge = {v.index for f in bm.faces if f not in covered for v in f.verts}
    covered = [f for f in covered if not any(v.index in edge for v in f.verts)]
    bmesh.ops.delete(bm, geom=covered, context='FACES')
    bm.to_mesh(body.data)
    bm.free()
    return [shirt, legs, collar] + shoes


# ---------------------------------------------------------------------------
# My head: hair, brows, glasses and a grin.

def centres_of(eyes):
    """The middles of my two eyes, from the base's eyes mesh."""
    matrix = eyes.matrix_world
    sides = {1: [], -1: []}
    for vertex in eyes.data.vertices:
        at = matrix @ vertex.co
        sides[1 if at.x > 0 else -1].append(at)
    return {
        side: sum(points, Vector()) / len(points) for side, points in sides.items()
    }


def style_hair(hair):
    """Short sandy hair, darker at the roots, spiked up on top."""
    tree = BVHTree.FromObject(hair, bpy.context.evaluated_depsgraph_get())
    to_world = hair.matrix_world
    to_local = to_world.inverted()
    top = max((to_world @ v.co).z for v in hair.data.vertices)
    points = [to_world @ v.co for v in hair.data.vertices]
    centre = sum(points, Vector()) / len(points)
    centre.z = top - 0.12
    paint(hair, lambda at: mix(
        COLOURS['hair_root'], COLOURS['hair'], smoothstep(-0.02, 0.08, at.z - centre.z),
    ))
    tufts = []
    seed = 11

    def random():
        nonlocal seed
        seed = (seed * 16807) % 2147483647
        return (seed - 1) / 2147483646

    up = Vector((0, 0, 1))
    back = Vector((0, 1, 0))
    for i in range(44):
        ring = i // 11
        reach = 0.085 - ring * 0.022 + random() * 0.012
        angle = (i / 11) * 2 * math.pi + ring * 0.5 + random() * 0.35
        x = centre.x + math.cos(angle) * reach * 0.9
        y = centre.y + math.sin(angle) * reach - 0.005
        origin = to_local @ Vector((x, y, top + 0.2))
        hit, normal, _, _ = tree.ray_cast(origin, to_local.to_3x3() @ Vector((0, 0, -1)))
        if hit is None:
            continue
        base = to_world @ hit - Vector((0, 0, 0.004))
        normal = (to_world.to_3x3() @ normal).normalized()
        lean = (normal * 0.7 + up * 0.6 + back * 0.4).normalized()
        across = up.cross(normal) if abs(normal.z) < 0.95 else Vector((1, 0, 0))
        lock = tuft(
            base, lean, across,
            length=0.028 + random() * 0.022,
            width=0.022 + random() * 0.008,
            bend=0.008,
        )
        smooth(lock)
        paint(lock, lambda at: mix(
            COLOURS['hair_root'], COLOURS['hair'], smoothstep(-0.02, 0.08, at.z - centre.z),
        ))
        tufts.append(lock)
    return tufts


def build_glasses(eye_centres, ear_x):
    """Clear-framed glasses, their arms back over my ears."""
    parts = []
    front = min(c.y for c in eye_centres.values())
    lens_y = front - 0.016
    for side in (1, -1):
        centre = eye_centres[side]
        frame = primitive(
            'torus', 'frame', major_radius=1, minor_radius=0.11,
            major_segments=16, minor_segments=3,
            location=Vector((centre.x + side * 0.003, lens_y, centre.z + 0.002)),
            rotation=(math.pi / 2, 0, side * -0.15),
        )
        frame.scale = (0.025, 0.019, 0.025)
        select_only(frame)
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        smooth(frame)
        parts.append(frame)
        temple = tube(
            'temple',
            [Vector((side * (abs(centre.x) + 0.027), lens_y + 0.006, centre.z + 0.008)),
             Vector((side * (ear_x + 0.006), lens_y + 0.04, centre.z + 0.01)),
             Vector((side * (ear_x + 0.006), centre.y + 0.07, centre.z)),
             Vector((side * (ear_x - 0.004), centre.y + 0.095, centre.z - 0.025))],
            [0.0024] * 4,
            sides=4,
        )
        smooth(temple)
        parts.append(temple)
    gap = abs(eye_centres[1].x) - 0.022
    bridge = tube(
        'bridge',
        [Vector((x, lens_y - 0.002, eye_centres[1].z + 0.008 + 0.004 * (1 - abs(x) / gap)))
         for x in (-gap, 0.0, gap)],
        [0.0024] * 3,
        sides=4,
    )
    smooth(bridge)
    parts.append(bridge)
    for part in parts:
        paint(part, COLOURS['frames'])
    return parts


def build_pack(armature, tee):
    """A soft daypack, with a lid and a front pocket, its straps over my
    shoulders and down my front."""
    parts = []
    back = max((tee.matrix_world @ v.co).y for v in tee.data.vertices if 1.1 < (tee.matrix_world @ v.co).z < 1.35)
    middle = (world_bone(armature, 'spine_02')[0].z + world_bone(armature, 'spine_03')[0].z) / 2 + 0.05

    def block(name, at, size, round_by, colour):
        obj = primitive('cube', name, size=1, location=at)
        obj.scale = size
        select_only(obj)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        bevel(obj, round_by, 2)
        apply_modifiers(obj)
        smooth(obj)
        paint(obj, COLOURS[colour])
        parts.append(obj)

    block('pack', Vector((0, back + 0.07, middle)), (0.3, 0.14, 0.4), 0.05, 'pack')
    block('lid', Vector((0, back + 0.07, middle + 0.195)), (0.28, 0.155, 0.07), 0.025, 'pack_trim')
    block('pocket', Vector((0, back + 0.15, middle - 0.1)), (0.22, 0.05, 0.16), 0.02, 'pack_trim')
    find = surface_of(tee)
    tree = BVHTree.FromObject(tee, bpy.context.evaluated_depsgraph_get())
    for side in (1, -1):
        x = side * 0.1
        top, _, _, _ = tree.ray_cast(Vector((x * 1.15, 0.0, 2.0)), Vector((0, 0, -1)))
        points = [
            Vector((x, back + 0.01, middle + 0.15)),
            find(x * 1.05, top.z - 0.06, forward=1, out=0.01)[0],
            top + Vector((0, 0, 0.008)),
            find(x * 1.08, top.z - 0.07, out=0.02)[0],
            find(x * 1.05, middle, out=0.02)[0],
            find(x * 0.98, middle - 0.15, out=0.019)[0],
        ]
        strap = tube('strap', points, [0.014] * 6, sides=6)
        smooth(strap)
        paint(strap, COLOURS['pack_trim'])
        parts.append(strap)
    return parts


def rigid(obj, armature, bone):
    """Moves all of an object with one bone."""
    obj.vertex_groups.clear()
    obj.vertex_groups.new(name=bone).add([v.index for v in obj.data.vertices], 1.0, 'REPLACE')
    obj.parent = armature
    modifier = obj.modifiers.new('skeleton', 'ARMATURE')
    modifier.object = armature


def add_blink(me, eye_centres):
    """Blinking squashes my eyes down to a line, and brings my lids down
    over them, about their middles."""
    select_only(me)
    if not me.data.shape_keys:
        me.shape_key_add(name='Basis')
    blink = me.shape_key_add(name='blink')
    eye_group = me.vertex_groups['eyes'].index
    lid_group = me.vertex_groups.get('lids')
    for vertex in me.data.vertices:
        groups = {g.group for g in vertex.groups}
        side = 1 if vertex.co.x > 0 else -1
        centre = eye_centres[side]
        co = vertex.co.copy()
        if eye_group in groups:
            co.z = centre.z + (co.z - centre.z) * 0.1
        elif lid_group and lid_group.index in groups and co.z > centre.z:
            co.z = centre.z + (co.z - centre.z) * 0.25
        blink.data[vertex.index].co = co


# ---------------------------------------------------------------------------
# Everything together.

def build():
    armature, body, eyes, brows, hair = load_base()
    meshes = [body, eyes, brows, hair]

    # From the base's T-pose to the game's rest pose: my arms down, a little
    # out from my sides.
    turn_about_forward(armature, {'upperarm_l': math.radians(85), 'upperarm_r': math.radians(-85)})
    rest_as_posed(armature, meshes)
    add_contacts(armature)
    slim(armature, body)

    paint_skin(body)
    paint_eyes(eyes)
    paint(brows, COLOURS['brow'])
    tufts = style_hair(hair)
    clothes = dress(armature, body)

    eye_centres = centres_of(eyes)
    ear_x = max(abs((body.matrix_world @ v.co).x) for v in body.data.vertices
                if abs((body.matrix_world @ v.co).z - eye_centres[1].z) < 0.03
                and (body.matrix_world @ v.co).y > eye_centres[1].y)
    glasses = build_glasses(eye_centres, ear_x)
    pack = build_pack(armature, clothes[0])

    # My eyelids: the skin just round my eyes, which blinking brings down.
    lids = body.vertex_groups.new(name='lids')
    for vertex in body.data.vertices:
        at = body.matrix_world @ vertex.co
        for centre in eye_centres.values():
            offset = at - centre
            if abs(offset.x) < 0.022 and 0 < offset.z < 0.016 and offset.y < 0.004:
                lids.add([vertex.index], 1.0, 'REPLACE')
    eyes.vertex_groups.new(name='eyes').add([v.index for v in eyes.data.vertices], 1.0, 'REPLACE')
    for part in (eyes, brows):
        part.vertex_groups.new(name='unshaded').add(
            [v.index for v in part.data.vertices], 1.0, 'REPLACE')
    for part in tufts:
        rigid(part, armature, 'Head')
    for part in glasses:
        rigid(part, armature, 'Head')
        part.vertex_groups.new(name='unshaded').add(
            [v.index for v in part.data.vertices], 1.0, 'REPLACE')
    for part in pack:
        rigid(part, armature, 'spine_03')

    matte = material('matte')
    gloss = material('gloss', alpha=0.6, roughness=0.2)
    everything = [body, eyes, brows, hair] + tufts + clothes + pack
    for part in everything:
        part.data.materials.clear()
        part.data.materials.append(matte)
    for part in glasses:
        part.data.materials.clear()
        part.data.materials.append(gloss)
    for label, group in (('body', [body]), ('face', [eyes, brows]), ('hair', [hair] + tufts),
                         ('clothes', clothes), ('glasses', glasses), ('pack', pack)):
        count = sum(len(p.vertices) - 2 for part in group for p in part.data.polygons)
        print(f'ME: {label} {count} triangles')
    # What I made faces outwards, as three.js only draws front faces. (The
    # base's own meshes already do: recalculating them, cut open where my
    # clothes are, would turn some inside out.)
    for part in tufts + clothes[2:] + pack + glasses:
        select_only(part)
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.mesh.normals_make_consistent(inside=False)
        bpy.ops.object.mode_set(mode='OBJECT')
    me = join(everything + glasses, 'me')
    for modifier in list(me.modifiers):
        me.modifiers.remove(modifier)
    modifier = me.modifiers.new('skeleton', 'ARMATURE')
    modifier.object = armature
    me.parent = armature

    bake_shading(me)
    me.vertex_groups.remove(me.vertex_groups['unshaded'])
    add_blink(me, eye_centres)
    for name in ('eyes', 'lids'):
        me.vertex_groups.remove(me.vertex_groups[name])

    triangles = sum(len(p.vertices) - 2 for p in me.data.polygons)
    print(f'ME: {triangles} triangles')
    return me, armature


def export(me, armature):
    bpy.ops.object.select_all(action='DESELECT')
    me.select_set(True)
    armature.select_set(True)
    options = dict(
        filepath=OUT,
        export_format='GLB',
        use_selection=True,
        export_yup=True,
        export_apply=False,
        export_texcoords=False,
        export_normals=True,
        export_morph=True,
        export_morph_normal=False,
        export_skins=True,
        export_def_bones=False,
        export_animations=False,
        export_materials='EXPORT',
    )
    try:
        bpy.ops.export_scene.gltf(**options, export_vertex_color='ACTIVE')
    except TypeError:
        bpy.ops.export_scene.gltf(**options, export_colors=True)


def preview(directory):
    """Renders me from the front, the side and up close, to look at."""
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 32
    scene.render.resolution_x = 700
    scene.render.resolution_y = 900
    scene.view_settings.view_transform = 'Standard'
    world = bpy.data.worlds.new('sky')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.75, 0.8, 0.85, 1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.8
    scene.world = world
    sun = link(bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')))
    sun.data.energy = 3
    sun.rotation_euler = (math.radians(50), 0, math.radians(30))
    ground = primitive('plane', 'ground', size=6, location=(0, 0, 0))
    ground.data.materials.append(material('matte'))
    camera = link(bpy.data.objects.new('camera', bpy.data.cameras.new('camera')))
    scene.camera = camera
    os.makedirs(directory, exist_ok=True)
    views = [
        ('front', (0.0, -3.6, 1.15), (0, 0, 0.95), 50),
        ('three-quarter', (2.4, -2.6, 1.3), (0, 0, 0.95), 50),
        ('back', (-1.2, 3.2, 1.4), (0, 0, 0.95), 50),
        ('face', (0.25, -0.75, 1.75), (0, 0, 1.69), 60),
    ]
    for pose, extra in ((None, views), ('star', views[:2])):
        if pose:
            pose_star(bpy.data.objects['skeleton'])
        for name, at, target, lens in extra:
            if pose:
                name = f'{pose}-{name}'
            render_view(scene, camera, directory, name, at, target, lens)


def pose_star(armature):
    """Strikes my star pose, as the game does: my arms right up over my
    head and my legs out, each turned about my body's forward axis."""
    select_only(armature)
    bpy.ops.object.mode_set(mode='POSE')
    for name, angle in (('upperarm_l', -2.27), ('upperarm_r', 2.27), ('thigh_l', -0.5), ('thigh_r', 0.5)):
        bone = armature.pose.bones[name]
        head = bone.head.copy()
        bone.matrix = (
            Matrix.Translation(head) @ Matrix.Rotation(angle, 4, 'Y')
            @ Matrix.Translation(-head) @ bone.matrix
        )
        bpy.context.view_layer.update()
    bpy.ops.object.mode_set(mode='OBJECT')


def render_view(scene, camera, directory, name, at, target, lens):
    """Renders me from a point, looking at another."""
    camera.location = at
    direction = Vector(target) - Vector(at)
    camera.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
    camera.data.lens = lens
    scene.render.filepath = os.path.join(directory, f'{name}.png')
    bpy.ops.render.render(write_still=True)


def main():
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    me, armature = build()
    export(me, armature)
    print(f'ME: written to {OUT}')
    if '--preview' in args:
        preview(args[args.index('--preview') + 1])


main()
