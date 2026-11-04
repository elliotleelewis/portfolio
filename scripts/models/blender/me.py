"""Models me in Blender, in the world's folded-paper style, and exports me as
models/me.glb.

Run headless: `pnpm models:me` (Blender 4.2 on the PATH, or BLENDER set to
it). Pass `-- --preview DIR` to also render previews of me into DIR.

The style is in models/README.md ("The style"): chunky folded paper, hard
facets, flat colour a little lighter or darker from fold to fold, faces
cut from paper, and a likeness made of what's recognisable from afar (my
hair, glasses, grin, tee and backpack), never a sculpted face. What the
game needs of the model (the skeleton, the `blink` shape key and materials
named for their finishes) is in models/README.md too. Blender's axes: Z is
up and I face -Y, so my left (+X) is the game's +X too.
"""

import math
import os
import random
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..')
OUT = os.path.join(ROOT, 'models', 'me.glb')

# The same "random" folds every time.
rng = random.Random(4)

# My colours (sRGB), from the hero photo, in the world's palette.
COLOURS = {
    'skin': '#f0c7ad',
    'blush': '#e9a08e',
    # Strawberry blond, darker underneath.
    'hair': '#d8b48e',
    'hair_under': '#bf9671',
    'tee': '#8c918a',
    'trousers': '#3f454c',
    'shoes': '#6a5440',
    'soles': '#2e2925',
    'pack': '#55605a',
    'pack_dark': '#414a45',
    # Clear grey frames.
    'frames': '#b9b6ae',
    'eye': '#2a2420',
    'mouth': '#7a3a34',
    'teeth': '#f6f1e6',
}

# How much lighter or darker each fold is than its paper's colour.
FOLD = 0.07

# Where I'm made in front of: my face is a flat sheet of paper this far in
# front of my head's middle.
HEAD = Vector((0, 0, 1.52))
HEAD_SIZE = 0.26
FACE_Y = -0.236


# ---------------------------------------------------------------------------
# Folded paper.

def linear(hex_colour):
    """An sRGB hex colour, in linear RGB, as Blender's colours are."""
    value = hex_colour.lstrip('#')
    channels = [int(value[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return [
        c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
        for c in channels
    ]


def finish(bm, name, colour, fold=FOLD):
    """A part, from its shape: flat colour per face, each fold a little
    lighter or darker, as folded paper catches the light."""
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    colours = mesh.color_attributes.new('Col', 'FLOAT_COLOR', 'CORNER')
    base = linear(colour)
    for polygon in mesh.polygons:
        k = 1 + rng.uniform(-fold, fold)
        value = [min(1.0, c * k) for c in base] + [1.0]
        for loop in polygon.loop_indices:
            colours.data[loop].color = value
        polygon.use_smooth = False
    return obj


def ball(name, at, size, colour, squash=(1, 1, 1), detail=1, fold=FOLD):
    """A faceted ball: a head, a hand, an ear."""
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=detail, radius=1)
    for v in bm.verts:
        v.co = Vector(at) + Vector((v.co.x * squash[0], v.co.y * squash[1], v.co.z * squash[2])) * size
    return finish(bm, name, colour, fold)


def prism(name, a, b, ra, rb, sides, colour, twist=0.0, flatten=1.0):
    """A tapering prism from a to b: a limb, a body."""
    bm = bmesh.new()
    a, b = Vector(a), Vector(b)
    axis = (b - a).normalized()
    across = Vector((1, 0, 0)) if abs(axis.x) < 0.9 else Vector((0, 1, 0))
    side = axis.cross(across).normalized()
    other = axis.cross(side)
    rings = []
    for end, r in ((a, ra), (b, rb)):
        ring = []
        for k in range(sides):
            t = 2 * math.pi * k / sides + twist
            ring.append(bm.verts.new(end + (side * math.cos(t) * flatten + other * math.sin(t)) * r))
        rings.append(ring)
    for k in range(sides):
        n = (k + 1) % sides
        bm.faces.new((rings[0][k], rings[0][n], rings[1][n], rings[1][k]))
    bm.faces.new(rings[0])
    bm.faces.new(rings[1])
    return finish(bm, name, colour)


def block(name, at, size, colour, bevel=0.0):
    """A box: a shoe, a pack."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
    if bevel:
        bmesh.ops.bevel(bm, geom=bm.edges[:], offset=bevel, segments=1, affect='EDGES')
    bmesh.ops.translate(bm, vec=Vector(at), verts=bm.verts)
    return finish(bm, name, colour)


def spike(name, base, lean, r, h, colour):
    """A spike of hair: a four-sided cone, leaning."""
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=4, radius1=r, radius2=0, depth=h)
    bmesh.ops.translate(bm, vec=Vector((0, 0, h / 2)), verts=bm.verts)
    turn = Vector((0, 0, 1)).rotation_difference(Vector(lean).normalized()).to_matrix()
    bmesh.ops.rotate(bm, cent=Vector(), matrix=turn, verts=bm.verts)
    bmesh.ops.translate(bm, vec=Vector(base), verts=bm.verts)
    return finish(bm, name, colour, 0.1)


def cut_out(name, outline, at, colour, lift=0.0):
    """A flat shape cut from paper and stuck on my face, facing front."""
    bm = bmesh.new()
    verts = [bm.verts.new(Vector(at) + Vector((x, -lift, z))) for x, z in outline]
    face = bm.faces.new(verts)
    face.normal_update()
    if face.normal.y > 0:
        face.normal_flip()
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    colours = mesh.color_attributes.new('Col', 'FLOAT_COLOR', 'CORNER')
    for loop in mesh.loops:
        colours.data[loop.index].color = linear(colour) + [1.0]
    return obj


def oval(rx, rz, n=10):
    return [(math.cos(2 * math.pi * k / n) * rx, math.sin(2 * math.pi * k / n) * rz) for k in range(n)]


# ---------------------------------------------------------------------------
# The skeleton: the game's humanoid skeleton (models/README.md), Unreal's
# bone names, with a palm and a sole where my hands and feet touch the
# ground.

def mirror(v):
    return Vector((-v[0], v[1], v[2]))


SHOULDER = Vector((0.28, 0, 1.13))
ELBOW = Vector((0.33, 0, 0.92))
WRIST = Vector((0.385, -0.02, 0.71))
HIP = Vector((0.11, 0, 0.72))
KNEE = Vector((0.11, 0, 0.42))
ANKLE = Vector((0.11, 0, 0.12))

BONES = [
    # name, head, tail, parent, moves anything
    ('pelvis', (0, 0, 0.72), (0, 0, 0.9), None, True),
    ('spine_03', (0, 0, 0.92), (0, 0, 1.2), 'pelvis', True),
    ('Head', (0, 0, 1.28), (0, 0, 1.6), 'spine_03', True),
]
for side, flip in (('l', lambda v: v), ('r', mirror)):
    BONES += [
        (f'upperarm_{side}', flip(SHOULDER), flip(ELBOW), 'spine_03', True),
        (f'lowerarm_{side}', flip(ELBOW), flip(WRIST), f'upperarm_{side}', True),
        (f'palm_{side}', flip(WRIST + Vector((0, 0, -0.07))), flip(WRIST + Vector((0, 0, -0.11))), f'lowerarm_{side}', False),
        (f'thigh_{side}', flip(HIP), flip(KNEE), 'pelvis', True),
        (f'calf_{side}', flip(KNEE), flip(ANKLE), f'thigh_{side}', True),
        (f'sole_{side}', flip(Vector((0.11, -0.05, 0.001))), flip(Vector((0.11, -0.15, 0.001))), f'calf_{side}', False),
    ]


def build_skeleton():
    data = bpy.data.armatures.new('skeleton')
    armature = bpy.data.objects.new('skeleton', data)
    bpy.context.collection.objects.link(armature)
    bpy.context.view_layer.objects.active = armature
    bpy.ops.object.mode_set(mode='EDIT')
    for name, head, tail, parent, deforms in BONES:
        bone = data.edit_bones.new(name)
        bone.head = head
        bone.tail = tail
        bone.use_deform = deforms
        if parent:
            bone.parent = data.edit_bones[parent]
    bpy.ops.object.mode_set(mode='OBJECT')
    return armature


# ---------------------------------------------------------------------------
# Me. Every part is stiff paper, so it moves with one bone, as one.

def build_me():
    parts = []

    def add(bone, obj):
        obj['bone'] = bone
        parts.append(obj)
        return obj

    C = COLOURS
    for side, flip in (('l', lambda v: v), ('r', mirror)):
        s = 1 if side == 'l' else -1
        # Legs, in walking trousers, bending at the knee.
        add(f'thigh_{side}', prism('thigh', flip(HIP + Vector((0, 0, 0.06))), flip(KNEE), 0.1, 0.088, 6, C['trousers']))
        add(f'calf_{side}', prism('shin', flip(KNEE + Vector((0, 0, 0.03))), flip(ANKLE + Vector((0, 0, 0.02))), 0.088, 0.08, 6, C['trousers']))
        # Trail shoes, on darker soles.
        add(f'calf_{side}', block('shoe', flip(Vector((0.11, -0.05, 0.075))), (0.17, 0.3, 0.12), C['shoes'], 0.02))
        add(f'calf_{side}', block('sole', flip(Vector((0.11, -0.05, 0.016))), (0.18, 0.31, 0.032), C['soles']))
        # Arms: a short sleeve, bare arms bending at the elbow, and hands.
        add(f'upperarm_{side}', prism('sleeve', flip(SHOULDER + Vector((-0.01, 0, 0.03))), flip(SHOULDER.lerp(ELBOW, 0.55)), 0.088, 0.082, 6, C['tee']))
        add(f'upperarm_{side}', prism('arm', flip(SHOULDER.lerp(ELBOW, 0.4)), flip(ELBOW), 0.06, 0.056, 5, C['skin']))
        add(f'lowerarm_{side}', ball('elbow', flip(ELBOW), 0.057, C['skin'], detail=1))
        add(f'lowerarm_{side}', prism('forearm', flip(ELBOW), flip(WRIST), 0.056, 0.048, 5, C['skin']))
        add(f'lowerarm_{side}', ball('hand', flip(WRIST + Vector((0, 0, -0.05))), 0.068, C['skin'], squash=(0.8, 0.9, 1.1)))
        # Ears, sticking out a little.
        add('Head', ball('ear', HEAD + Vector((s * 0.235, 0.02, -0.02)), 0.065, C['skin'], squash=(0.45, 0.8, 1)))

    # My middle: the top of my trousers, and a tee over my chest.
    add('pelvis', prism('hips', (0, 0, 0.62), (0, 0, 0.84), 0.2, 0.2, 7, C['trousers'], twist=0.3, flatten=1.0))
    add('spine_03', prism('tee', (0, 0, 0.78), (0, 0, 1.2), 0.205, 0.25, 7, C['tee'], twist=0.3))
    add('spine_03', prism('shoulders', (0, 0, 1.18), (0, 0, 1.25), 0.25, 0.14, 7, C['tee'], twist=0.3))
    # My daypack, with a lid, and its straps over my shoulders.
    add('spine_03', block('pack', (0, 0.28, 0.97), (0.36, 0.18, 0.44), C['pack'], 0.03))
    add('spine_03', block('lid', (0, 0.28, 1.19), (0.34, 0.2, 0.08), C['pack_dark'], 0.02))
    for s in (1, -1):
        add('spine_03', block('strap', (s * 0.13, -0.245, 1.0), (0.055, 0.02, 0.4), C['pack_dark']))
        add('spine_03', block('strap', (s * 0.15, 0.0, 1.235), (0.055, 0.5, 0.02), C['pack_dark']))
    add('spine_03', prism('neck', (0, 0, 1.2), (0, 0, 1.32), 0.075, 0.072, 6, C['skin']))

    # My head: a big, faceted ball.
    add('Head', ball('head', HEAD, HEAD_SIZE, C['skin'], squash=(0.92, 0.9, 1.0), detail=2, fold=0.05))

    # Hair: a folded cap, darker underneath, and tousled spikes, swept up and
    # forward at the front.
    add('Head', ball('cap', HEAD + Vector((0, 0.03, 0.09)), 0.255, C['hair_under'], squash=(0.96, 0.96, 0.72)))
    for k in range(26):
        t = 2 * math.pi * k / 26 + rng.uniform(-0.1, 0.1)
        ring = (0.18, 0.12, 0.06)[k % 3]
        base = HEAD + Vector((math.cos(t) * ring, math.sin(t) * ring + 0.02, 0.2 - ring * 0.25))
        front = max(0.0, -math.sin(t))
        lean = (math.cos(t) * 0.45, math.sin(t) * 0.45 - 0.35 * front, 1.0)
        add('Head', spike('spike', base, lean, 0.065 + rng.uniform(0, 0.015), 0.06 + rng.uniform(0, 0.03) + 0.05 * front, C['hair']))

    # My face, cut from paper: smiling eyes, rosy cheeks, a big grin with
    # teeth, and clear grey rectangular glasses.
    face = Vector((0, FACE_Y, 0))
    eyes = []
    for s in (1, -1):
        eye = cut_out('eye', oval(0.022, 0.026, 10), HEAD + face + Vector((s * 0.08, 0, 0.035)), C['eye'])
        eye['is_eye'] = True
        eyes.append(add('Head', eye))
        add('Head', cut_out('cheek', oval(0.034, 0.026, 10), HEAD + face + Vector((s * 0.14, 0.03, -0.045)), C['blush']))
        frame = []
        for x, z in ((-0.066, -0.047), (0.066, -0.047), (0.066, 0.047), (-0.066, 0.047)):
            frame.append((x, z))
        # The frame: a rectangle with a rectangle cut out of it, in four strips.
        for (x0, z0), (x1, z1) in zip(frame, frame[1:] + frame[:1]):
            inset = 0.013
            strip = [(x0, z0), (x1, z1), (x1 - math.copysign(inset, x1) * (x1 != x0 and 0 or 1), z1 - math.copysign(inset, z1)),
                     (x0 - math.copysign(inset, x0) * (x1 != x0 and 0 or 1), z0 - math.copysign(inset, z0))]
            add('Head', cut_out('frame', strip, HEAD + face + Vector((s * 0.085, 0, 0.04)), C['frames'], lift=0.012))
    add('Head', cut_out('bridge', [(-0.022, -0.006), (0.022, -0.006), (0.022, 0.006), (-0.022, 0.006)], HEAD + face + Vector((0, 0, 0.05)), C['frames'], lift=0.012))
    grin = [(math.cos(math.pi + math.pi * k / 10) * 0.075, math.sin(math.pi + math.pi * k / 10) * 0.05) for k in range(11)]
    add('Head', cut_out('mouth', grin, HEAD + face + Vector((0, 0, -0.07)), C['mouth'], lift=0.002))
    teeth = [(x * 0.86, max(z, -0.016) * 0.86) for x, z in grin]
    add('Head', cut_out('teeth', teeth, HEAD + face + Vector((0, 0, -0.072)), C['teeth'], lift=0.004))
    return parts, eyes


# ---------------------------------------------------------------------------
# Rigging, material, blink, export.

def material():
    """Matte paper, coloured by the folds' colours (the game remakes it in
    the `matte` finish)."""
    mat = bpy.data.materials.new('matte')
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    bsdf = nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (1, 1, 1, 1)
    bsdf.inputs['Roughness'].default_value = 0.9
    colour = nodes.new('ShaderNodeVertexColor')
    colour.layer_name = 'Col'
    mat.node_tree.links.new(colour.outputs['Color'], bsdf.inputs['Base Color'])
    return mat


def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    armature = build_skeleton()
    parts, eyes = build_me()
    paper = material()
    for part in parts:
        part.data.materials.append(paper)
        group = part.vertex_groups.new(name=part['bone'])
        group.add([v.index for v in part.data.vertices], 1.0, 'REPLACE')
        if part in eyes:
            part.vertex_groups.new(name='eyes').add([v.index for v in part.data.vertices], 1.0, 'REPLACE')
    # Every bone's group on every part, so they join.
    for part in parts:
        for name, *_ in BONES:
            if name not in part.vertex_groups:
                part.vertex_groups.new(name=name)
        if 'eyes' not in part.vertex_groups:
            part.vertex_groups.new(name='eyes')
    bpy.ops.object.select_all(action='DESELECT')
    for part in parts:
        part.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    me = bpy.context.active_object
    me.name = 'me'

    # Blinking squashes my eyes to a line, about their middles.
    me.shape_key_add(name='Basis')
    blink = me.shape_key_add(name='blink')
    eye_group = me.vertex_groups['eyes'].index
    middle_z = HEAD.z + 0.035
    for vertex in me.data.vertices:
        if any(g.group == eye_group for g in vertex.groups):
            co = vertex.co.copy()
            co.z = middle_z + (co.z - middle_z) * 0.15
            blink.data[vertex.index].co = co
    me.vertex_groups.remove(me.vertex_groups['eyes'])

    me.parent = armature
    me.modifiers.new('skeleton', 'ARMATURE').object = armature
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


def pose_star(armature):
    """Strikes my star pose, as the game does: my arms right up over my
    head and my legs out, each turned about my body's forward axis."""
    bpy.context.view_layer.objects.active = armature
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


def preview(directory, armature):
    """Renders me from the front, the side, the back, up close and in my
    star pose, to look at."""
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 32
    scene.render.resolution_x = 700
    scene.render.resolution_y = 900
    scene.view_settings.view_transform = 'Standard'
    world = bpy.data.worlds.new('sky')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.75, 0.8, 0.85, 1)
    scene.world = world
    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))
    bpy.context.collection.objects.link(sun)
    sun.data.energy = 3
    sun.rotation_euler = (math.radians(50), 0, math.radians(30))
    camera = bpy.data.objects.new('camera', bpy.data.cameras.new('camera'))
    bpy.context.collection.objects.link(camera)
    scene.camera = camera
    os.makedirs(directory, exist_ok=True)
    views = [
        ('front', (0.0, -3.6, 1.15), (0, 0, 0.95), 50),
        ('three-quarter', (2.4, -2.6, 1.3), (0, 0, 0.95), 50),
        ('back', (-1.2, 3.2, 1.4), (0, 0, 0.95), 50),
        ('face', (0.3, -1.2, 1.6), (0, 0, 1.52), 60),
    ]
    for pose, shots in ((None, views), ('star', views[:2])):
        if pose:
            pose_star(armature)
        for name, at, target, lens in shots:
            camera.location = at
            camera.rotation_euler = (Vector(target) - Vector(at)).to_track_quat('-Z', 'Y').to_euler()
            camera.data.lens = lens
            scene.render.filepath = os.path.join(directory, f'{pose + "-" if pose else ""}{name}.png')
            bpy.ops.render.render(write_still=True)


def main():
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    me, armature = build()
    export(me, armature)
    print(f'ME: written to {OUT}')
    if '--preview' in args:
        preview(args[args.index('--preview') + 1], armature)


main()
