"""Models me in Blender, from scratch, and exports me as models/me.glb.

Run headless: `pnpm models:me` (Blender on the PATH, or BLENDER set to it).
Pass `-- --preview DIR` to also render previews of me into DIR.

What the game needs of the model (the skeleton, the `blink` shape key and
materials named for their finishes) is in models/README.md. Blender's axes:
Z is up and I face -Y, so my left (+X) is the game's +X too.
"""

import math
import os
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..')
OUT = os.path.join(ROOT, 'models', 'me.glb')

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


def subdivide(obj, levels=1):
    modifier = obj.modifiers.new('subdivide', 'SUBSURF')
    modifier.levels = levels
    modifier.render_levels = levels
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


# ---------------------------------------------------------------------------
# Where my joints are (the game's own numbers: see src/game/character.ts).

HIPS = Vector((0, 0, 0.95))
NECK_TOP = Vector((0, 0, 1.57))
SHOULDER = Vector((0.235, 0, 1.46))
HAND = Vector((0.29, -0.02, 0.772))
HIP = Vector((0.1, 0, 0.95))
FOOT = Vector((0.1, -0.04, 0.05))
HEAD_CENTRE = Vector((0, 0.005, 1.712))


def mirrored(v):
    return Vector((-v.x, v.y, v.z))


# ---------------------------------------------------------------------------
# My body: one continuous skin over a stick skeleton, from my neck to my
# ankles and fingertips, coloured by what I'm wearing.

def build_body():
    verts = []
    edges = []
    radii = []

    def add(at, radius, parent=None):
        verts.append(tuple(at))
        radii.append(radius)
        index = len(verts) - 1
        if parent is not None:
            edges.append((parent, index))
        return index

    pelvis = add((0, 0.0, 0.90), (0.155, 0.105))
    waist = add((0, 0.0, 1.06), (0.15, 0.1), pelvis)
    chest = add((0, -0.005, 1.27), (0.18, 0.115), waist)
    upper = add((0, 0.0, 1.40), (0.17, 0.11), chest)
    neck = add((0, 0.0, 1.50), (0.066, 0.064), upper)
    add((0, 0.006, 1.6), (0.058, 0.056), neck)

    for side in (1, -1):
        shoulder = add((side * 0.19, 0, 1.445), (0.078, 0.074), upper)
        arm = add((side * 0.238, 0, 1.425), (0.074, 0.07), shoulder)
        elbow = add((side * 0.264, -0.008, 1.13), (0.052, 0.049), arm)
        wrist = add((side * 0.284, -0.018, 0.86), (0.035, 0.03), elbow)
        palm = add((side * 0.29, -0.02, 0.80), (0.024, 0.041), wrist)
        # Four fingers, hanging, a little curled, and a thumb in front.
        for i, along in enumerate((-0.026, -0.009, 0.008, 0.024)):
            length = 0.07 - abs(i - 1.5) * 0.008
            knuckle = add(
                (side * 0.29, -0.02 + along, 0.765), (0.0125, 0.0125), palm
            )
            tip = add(
                (side * 0.284, -0.026 + along, 0.765 - length),
                (0.0105, 0.0105),
                knuckle,
            )
            verts[tip] = verts[tip]
        add((side * 0.278, -0.062, 0.79), (0.0135, 0.0135), palm)

        hip = add((side * 0.095, 0, 0.88), (0.088, 0.088), pelvis)
        knee = add((side * 0.1, -0.012, 0.5), (0.068, 0.068), hip)
        add((side * 0.1, 0.0, 0.13), (0.058, 0.058), knee)

    body = mesh_object('body', verts, edges=edges)
    skin = body.modifiers.new('skin', 'SKIN')
    skin.use_smooth_shade = True
    skin.branch_smoothing = 1.0
    for vertex, radius in zip(body.data.skin_vertices[0].data, radii):
        vertex.radius = radius
    body.data.skin_vertices[0].data[pelvis].use_root = True
    subdivide(body, 1)
    apply_modifiers(body)
    smooth(body)

    def colour(at):
        is_arm = abs(at.x) > 0.205 and at.z < 1.47
        if at.z > 1.5:
            return COLOURS['skin']
        if is_arm:
            # A short sleeve, down to just above my elbow.
            return COLOURS['shirt'] if at.z > 1.26 else COLOURS['skin']
        if at.z > 0.92:
            return COLOURS['shirt']
        return COLOURS['trousers']

    paint(body, colour)
    return body


# ---------------------------------------------------------------------------
# My head: a jaw that narrows to the chin, full cheeks, a brow, ears, a
# nose, eyes that blink, a big grin, spiky sandy hair and clear glasses.

def build_head():
    head = primitive(
        'uv_sphere', 'head', segments=28, ring_count=16, radius=1,
        location=HEAD_CENTRE,
    )
    for vertex in head.data.vertices:
        x, y, z = vertex.co
        # Round, a little deeper than wide, and taller than either.
        x *= 0.118
        y *= 0.127
        z *= 0.15
        if z < 0:
            # The jaw narrows a little down to a rounded chin.
            t = smoothstep(0, -0.15, z)
            x *= 1 - 0.24 * t
            y *= 1 - 0.1 * t
        if y < 0:
            # A flatter face, a brow over my eyes, and full cheeks.
            y *= 0.95
            y -= 0.009 * math.exp(-((z - 0.04) / 0.016) ** 2) * max(0.0, 1 - abs(x) / 0.1)
            cheek = math.exp(-((z + 0.035) / 0.03) ** 2) * math.exp(-((abs(x) - 0.06) / 0.03) ** 2)
            y -= 0.007 * cheek
        vertex.co = (x, y, z)
    smooth(head)
    paint(head, COLOURS['skin'])
    parts = [head]
    find = surface_of(head)

    # Nose: a soft, rounded wedge, out and down from between my eyes.
    hit, _ = find(0, HEAD_CENTRE.z - 0.01)
    nose = primitive(
        'uv_sphere', 'nose', segments=10, ring_count=6, radius=1,
        location=hit + Vector((0, -0.006, 0)),
        rotation=(-0.45, 0, 0),
    )
    nose.scale = (0.015, 0.02, 0.03)
    select_only(nose)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    smooth(nose)
    paint(nose, COLOURS['skin'])
    parts.append(nose)

    # Ears.
    for side in (1, -1):
        ear = primitive(
            'uv_sphere', 'ear', segments=10, ring_count=6, radius=1,
            location=HEAD_CENTRE + Vector((side * 0.112, 0.01, -0.005)),
        )
        ear.scale = (0.014, 0.024, 0.034)
        ear.rotation_euler = (0, side * 0.15, side * -0.25)
        select_only(ear)
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        smooth(ear)
        paint(ear, COLOURS['skin'])
        parts.append(ear)

    # Eyes: dark and oval, set into my face. They blink (see `blink`).
    eyes = []
    eye_centres = {}
    for side in (1, -1):
        hit, _ = find(side * 0.043, HEAD_CENTRE.z + 0.018)
        centre = hit + Vector((0, 0.003, 0))
        eye_centres[side] = centre
        eye = primitive(
            'uv_sphere', 'eye', segments=10, ring_count=6, radius=1,
            location=centre,
        )
        eye.scale = (0.0145, 0.008, 0.019)
        select_only(eye)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        smooth(eye)
        paint(eye, COLOURS['eye'])
        eyes.append(eye)
    parts.extend(eyes)

    # Brows, arched over them, on my brow.
    for side in (1, -1):
        points = []
        for x, h in ((0.02, -0.002), (0.042, 0.004), (0.064, -0.003)):
            hit, _ = find(side * x, HEAD_CENTRE.z + 0.048 + h, out=0.003)
            points.append(hit)
        brow = tube('brow', points, [0.0045, 0.0062, 0.0035])
        smooth(brow)
        paint(brow, COLOURS['brow'])
        parts.append(brow)

    # A big grin: a row of teeth over a dark mouth, on my face.
    mouth_z = HEAD_CENTRE.z - 0.052
    columns, rows = 11, 5
    verts = []
    faces = []
    for j in range(rows + 1):
        for i in range(columns + 1):
            u = i / columns * 2 - 1
            v = j / rows
            x = u * 0.042
            z = mouth_z + 0.01 * u * u - v * 0.028 * (1 - u * u) ** 0.8
            hit, _ = find(x, z, out=0.0012)
            verts.append(tuple(hit))
    for j in range(rows):
        for i in range(columns):
            a = j * (columns + 1) + i
            # Wound to face out of my face (three.js only draws front faces).
            faces.append((a, a + columns + 1, a + columns + 2, a + 1))
    grin = mesh_object('grin', verts, faces)
    smooth(grin)
    paint(grin, lambda at: COLOURS['teeth'] if at.z > mouth_z - 0.009 + 0.01 * (at.x / 0.042) ** 2 else COLOURS['mouth'])
    grin['unshaded'] = True
    parts.append(grin)

    return parts, eyes, eye_centres, find


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


def build_hair(find):
    """Short and sandy, swept up and back into spiky tufts, and a quiff."""
    tufts = []
    centre = HEAD_CENTRE + Vector((0, 0.01, 0.015))
    seed = 7

    def random():
        nonlocal seed
        seed = (seed * 16807) % 2147483647
        return (seed - 1) / 2147483646

    # A close crop over my skull: the top of a sphere, tipped back, so it's
    # high at my forehead and low at my nape.
    crop = primitive(
        'uv_sphere', 'crop', segments=22, ring_count=12, radius=1,
        location=centre,
    )
    for vertex in crop.data.vertices:
        x, y, z = vertex.co
        vertex.co = (x * 0.124, y * 0.134, z * 0.152)
    bm = bmesh.new()
    bm.from_mesh(crop.data)
    tilt = Matrix.Rotation(-0.3, 3, 'X')
    for vertex in list(bm.verts):
        tipped = tilt @ vertex.co
        line = -0.03 + 0.1 * smoothstep(0.0, -0.11, tipped.y)
        if tipped.z < line:
            bm.verts.remove(vertex)
    bm.to_mesh(crop.data)
    bm.free()
    solidify = crop.modifiers.new('solidify', 'SOLIDIFY')
    solidify.thickness = 0.006
    apply_modifiers(crop)
    smooth(crop)
    tufts.append(crop)

    up = Vector((0, 0, 1))
    back = Vector((0, 1, 0))
    for i in range(40):
        ring = i // 10
        elevation = 0.55 + ring * 0.26 + random() * 0.12
        azimuth = (i / 10) * 2 * math.pi + ring * 0.45 + random() * 0.35
        direction = Vector((
            math.cos(azimuth) * math.cos(elevation),
            math.sin(azimuth) * math.cos(elevation),
            math.sin(elevation),
        ))
        base = centre + Vector((direction.x * 0.118, direction.y * 0.128, direction.z * 0.145))
        lean = (direction * 0.55 + up * 0.85 + back * 0.45).normalized()
        across = up.cross(direction) if abs(direction.z) < 0.95 else Vector((1, 0, 0))
        tufts.append(tuft(
            base, lean, across,
            length=0.03 + random() * 0.025,
            width=0.024 + random() * 0.01,
            bend=0.01,
        ))
    # The quiff, up and forward over my forehead.
    for i in range(-4, 5):
        x = i * 0.017
        base = centre + Vector((x, -0.09, 0.09 - abs(i) * 0.004))
        tufts.append(tuft(
            base, Vector((x * 0.6, -0.35, 1.0)), Vector((1, 0, 0)),
            length=0.055 - abs(i) * 0.004,
            width=0.022,
            bend=0.015,
        ))
    for lock in tufts:
        smooth(lock)
        # Darker at the roots, so the tufts stand out from each other.
        paint(lock, lambda at: mix(
            COLOURS['hair_root'], COLOURS['hair'],
            smoothstep(0.0, 0.05, (at - centre).length - 0.11),
        ))
    return tufts


def build_glasses(eye_centres, find):
    """Clear-framed glasses, their arms back over my ears."""
    parts = []
    lens_y = min(c.y for c in eye_centres.values()) - 0.018
    for side in (1, -1):
        centre = eye_centres[side]
        frame = primitive(
            'torus', 'frame', major_radius=1, minor_radius=0.11,
            major_segments=16, minor_segments=3,
            location=Vector((centre.x + side * 0.004, lens_y, centre.z + 0.002)),
            rotation=(math.pi / 2, 0, side * -0.18),
        )
        frame.scale = (0.027, 0.02, 0.027)
        select_only(frame)
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        smooth(frame)
        parts.append(frame)
        arm = tube(
            'temple',
            [Vector((side * 0.072, lens_y + 0.008, centre.z + 0.008)),
             Vector((side * 0.112, lens_y + 0.045, centre.z + 0.01)),
             Vector((side * 0.118, HEAD_CENTRE.y + 0.0, centre.z + 0.0)),
             Vector((side * 0.11, HEAD_CENTRE.y + 0.03, centre.z - 0.025))],
            [0.0026] * 4,
            sides=4,
        )
        smooth(arm)
        parts.append(arm)
    bridge = tube(
        'bridge',
        [Vector((x, lens_y - 0.002, eye_centres[1].z + 0.008 + 0.004 * (1 - abs(x) / 0.018)))
         for x in (-0.018, 0.0, 0.018)],
        [0.0025] * 3,
        sides=4,
    )
    smooth(bridge)
    parts.append(bridge)
    for part in parts:
        paint(part, COLOURS['frames'])
    return parts


def build_clothes():
    """The edges of my tee, so it reads as clothes: its collar and hem; and
    trail shoes. (My sleeves and trouser legs end where their colour does:
    a ring round a limb stands off it as the limb bends.)"""
    parts = []

    def ring(name, at, radius, thickness, scale=(1, 1, 1), rotation=(0, 0, 0), colour='shirt', bone='body'):
        obj = primitive(
            'torus', name, major_radius=radius, minor_radius=thickness,
            major_segments=18, minor_segments=4, location=at, rotation=rotation,
        )
        obj.scale = scale
        select_only(obj)
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        smooth(obj)
        paint(obj, COLOURS[colour])
        # Each edge moves with what it's round, as one.
        obj['bone'] = bone
        parts.append(obj)

    ring('collar', Vector((0, 0.002, 1.505)), 0.058, 0.008, scale=(1, 0.95, 1))
    ring('hem', Vector((0, 0, 0.915)), 0.158, 0.007, scale=(1, 0.68, 1))
    for side in (1, -1):
        limb = 'L' if side > 0 else 'R'

        # A trail shoe: a rounded upper, wider at the toe, on a darker sole.
        upper = primitive(
            'cube', 'shoe', size=1,
            location=Vector((side * 0.1, -0.05, 0.07)),
        )
        upper.scale = (0.112, 0.27, 0.095)
        select_only(upper)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        for vertex in upper.data.vertices:
            x, y, z = vertex.co
            toe = smoothstep(0.0, -0.12, y)
            vertex.co = (x * (1 + 0.1 * toe), y, z - 0.025 * toe * (1 if z > 0 else 0))
        bevel(upper, 0.02, 3)
        apply_modifiers(upper)
        smooth(upper)
        paint(upper, COLOURS['shoes'])
        upper['bone'] = f'leg.{limb}'
        parts.append(upper)
        sole = primitive(
            'cube', 'sole', size=1,
            location=Vector((side * 0.1, -0.052, 0.016)),
        )
        sole.scale = (0.12, 0.282, 0.032)
        select_only(sole)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        bevel(sole, 0.01, 2)
        apply_modifiers(sole)
        smooth(sole)
        paint(sole, COLOURS['soles'])
        sole['bone'] = f'leg.{limb}'
        parts.append(sole)
    return parts


def build_pack(body):
    """A soft daypack, with a lid and a front pocket, its straps over my
    shoulders."""
    parts = []

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

    block('pack', Vector((0, 0.2, 1.22)), (0.3, 0.15, 0.4), 0.05, 'pack')
    block('lid', Vector((0, 0.2, 1.415)), (0.28, 0.165, 0.07), 0.025, 'pack_trim')
    block('pocket', Vector((0, 0.285, 1.12)), (0.22, 0.05, 0.16), 0.02, 'pack_trim')
    find = surface_of(body)
    tree = BVHTree.FromObject(body, bpy.context.evaluated_depsgraph_get())
    for side in (1, -1):
        x = side * 0.105
        # Over the top of my shoulder, found from above.
        top, _, _, _ = tree.ray_cast(Vector((x * 1.1, 0.0, 2.0)), Vector((0, 0, -1)))
        points = [
            find(x, 1.38, forward=1, out=0.012)[0],
            find(x * 1.05, 1.47, forward=1, out=0.01)[0],
            top + Vector((0, 0, 0.008)),
            find(x * 1.08, 1.45, out=0.008)[0],
            find(x * 1.05, 1.3, out=0.007)[0],
            find(x * 0.98, 1.14, out=0.007)[0],
        ]
        strap = tube('strap', points, [0.016] * 6, sides=6)
        smooth(strap)
        paint(strap, COLOURS['pack_trim'])
        parts.append(strap)
    return parts


# ---------------------------------------------------------------------------
# The skeleton the game turns (models/README.md), and how each part of me
# moves with it.

BONES = [
    ('body', HIPS, HIPS + Vector((0, 0, 0.55)), None, True),
    ('head', NECK_TOP, NECK_TOP + Vector((0, 0, 0.25)), 'body', True),
    ('arm.L', SHOULDER, HAND + Vector((0, 0, 0.04)), 'body', True),
    ('arm.R', mirrored(SHOULDER), mirrored(HAND) + Vector((0, 0, 0.04)), 'body', True),
    ('leg.L', HIP, FOOT + Vector((0, 0.04, 0.1)), 'body', True),
    ('leg.R', mirrored(HIP), mirrored(FOOT) + Vector((0, 0.04, 0.1)), 'body', True),
    ('hand.L', HAND, HAND + Vector((0, 0, -0.06)), 'arm.L', False),
    ('hand.R', mirrored(HAND), mirrored(HAND) + Vector((0, 0, -0.06)), 'arm.R', False),
    ('foot.L', FOOT, FOOT + Vector((0, -0.1, 0)), 'leg.L', False),
    ('foot.R', mirrored(FOOT), mirrored(FOOT) + Vector((0, -0.1, 0)), 'leg.R', False),
]


def build_armature():
    data = bpy.data.armatures.new('skeleton')
    armature = link(bpy.data.objects.new('skeleton', data))
    select_only(armature)
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


def weights_at(at):
    """How much each bone moves a point on me: my shoulders, hips and neck
    bend smoothly, between my body and each limb."""
    weights = {}
    # My head, from the top of my neck.
    head = smoothstep(1.53, 1.6, at.z)
    # My arms, out from my shoulders.
    side = 1 if at.x > 0 else -1
    shoulder = SHOULDER if side > 0 else mirrored(SHOULDER)
    hand = HAND if side > 0 else mirrored(HAND)
    along = (hand - shoulder).normalized()
    reach = (at - shoulder).dot(along)
    arm = smoothstep(-0.05, 0.07, reach) * smoothstep(0.15, 0.21, abs(at.x))
    # My legs, down from my hips, each its own side.
    leg = smoothstep(0.95, 0.8, at.z) * (1 - smoothstep(1.3, 1.4, at.z))
    left = smoothstep(-0.025, 0.025, at.x)
    if at.z > 1.5 or abs(at.x) < 0.12:
        arm = 0.0
    weights['head'] = head
    rest = 1 - head
    weights['arm.L' if side > 0 else 'arm.R'] = arm * rest
    rest -= arm * rest
    weights['leg.L'] = leg * left * rest
    weights['leg.R'] = leg * (1 - left) * rest
    rest -= leg * rest
    weights['body'] = max(rest, 0.0)
    return weights


def skin_to(obj, armature, rigid=None, keep=False):
    """Weights an object to the skeleton: all of it to one bone, or (keeping
    the weights it has) with every bone's group there to join."""
    for name, *_ in BONES:
        if name not in obj.vertex_groups:
            obj.vertex_groups.new(name=name)
    if keep:
        return
    matrix = obj.matrix_world
    for vertex in obj.data.vertices:
        weights = {rigid: 1.0} if rigid else weights_at(matrix @ vertex.co)
        for name, weight in weights.items():
            if weight > 0.001:
                obj.vertex_groups[name].add([vertex.index], weight, 'REPLACE')


# ---------------------------------------------------------------------------
# Light and shade painted on: ambient occlusion, baked into the colours.

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
# Everything together.

def build():
    reset()
    armature = build_armature()

    body = build_body()
    head_parts, eyes, eye_centres, find = build_head()
    hair = build_hair(find)
    glasses = build_glasses(eye_centres, find)
    clothes = build_clothes()
    pack = build_pack(body)

    # My body bends where Blender's heat weighting says, smoothly from each
    # bone to the next; everything else moves with one bone, as one.
    bpy.ops.object.select_all(action='DESELECT')
    body.select_set(True)
    armature.select_set(True)
    bpy.context.view_layer.objects.active = armature
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    for modifier in list(body.modifiers):
        body.modifiers.remove(modifier)
    body.parent = None
    skin_to(body, armature, keep=True)
    for part in head_parts + hair + glasses:
        skin_to(part, armature, 'head')
    for part in clothes + pack:
        skin_to(part, armature, part.get('bone', 'body'))
    for eye in eyes:
        eye.vertex_groups.new(name='eyes').add(
            [v.index for v in eye.data.vertices], 1.0, 'REPLACE'
        )
        eye['unshaded'] = True
    for part in head_parts + glasses:
        if part.get('unshaded') or part.name.startswith('brow') or part in glasses:
            part.vertex_groups.new(name='unshaded').add(
                [v.index for v in part.data.vertices], 1.0, 'REPLACE'
            )

    matte = material('matte')
    gloss = material('gloss', alpha=0.6, roughness=0.2)
    for part in [body] + head_parts + hair + clothes + pack:
        part.data.materials.clear()
        part.data.materials.append(matte)
    for part in glasses:
        part.data.materials.clear()
        part.data.materials.append(gloss)
    for label, group in (('body', [body]), ('head', head_parts), ('hair', hair),
                         ('glasses', glasses), ('clothes', clothes), ('pack', pack)):
        count = sum(len(p.vertices) - 2 for part in group for p in part.data.polygons)
        print(f'ME: {label} {count} triangles')
    # Every closed part faces outwards, as three.js only draws front faces.
    for part in [body] + head_parts + hair + clothes + pack + glasses:
        if part.get('unshaded') and part.name.startswith('grin'):
            continue
        select_only(part)
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.mesh.normals_make_consistent(inside=False)
        bpy.ops.object.mode_set(mode='OBJECT')
    me = join([body] + head_parts + hair + clothes + pack + glasses, 'me')

    bake_shading(me)
    me.vertex_groups.remove(me.vertex_groups['unshaded'])

    # Blinking squashes my eyes down to a line, about their middles.
    select_only(me)
    me.shape_key_add(name='Basis')
    blink = me.shape_key_add(name='blink')
    eye_group = me.vertex_groups['eyes'].index
    centres = eye_centres
    for vertex in me.data.vertices:
        if any(g.group == eye_group for g in vertex.groups):
            centre = centres[1 if vertex.co.x > 0 else -1]
            co = vertex.co.copy()
            co.z = centre.z + (co.z - centre.z) * 0.15
            blink.data[vertex.index].co = co
    me.vertex_groups.remove(me.vertex_groups['eyes'])

    modifier = me.modifiers.new('skeleton', 'ARMATURE')
    modifier.object = armature
    me.parent = armature

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
    for name, angle in (('arm.L', -2.27), ('arm.R', 2.27), ('leg.L', -0.5), ('leg.R', 0.5)):
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
