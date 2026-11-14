"""Cena de PRODUTO cinematográfica no Blender, 100% em código (sem baixar modelos): pedestal, produto, luz de estúdio e câmera
em órbita com profundidade de campo. Gera os quadros PNG e o vídeo serve para a rolagem quadro a quadro do site ou para reels.

    blender -b -P cena_produto.py -- --saida "C:/.../render/" [--quadros 120] [--largura 1600 --altura 900] [--produto perfume|relogio|tenis]
                                     [--cor "#c8862a"] [--fundo "#05060a"] [--volta 300] [--amostras 32]

(-b = sem tela; tudo vem dos argumentos depois de "--"). Motor EEVEE (rápido, roda em GPU integrada)."""
import math
import sys

import bpy

args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def arg(nome, padrao):
    if "--" + nome in args:
        return args[args.index("--" + nome) + 1]
    return padrao


SAIDA = arg("saida", "//render/")
N = int(arg("quadros", 120))
W, H = int(arg("largura", 1600)), int(arg("altura", 900))
PRODUTO = arg("produto", "perfume")
VOLTA = float(arg("volta", 300))  # graus de órbita ao longo do vídeo
AMOSTRAS = int(arg("amostras", 32))


def hex_rgb(h, a=1.0):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple((x / 12.92) if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c) + (a,)  # sRGB -> linear


COR = hex_rgb(arg("cor", "#7a3e0e"))
FUNDO = hex_rgb(arg("fundo", "#05060a"))

# ---------------------------------------------------------------- cena limpa
bpy.ops.wm.read_factory_settings(use_empty=True)
cena = bpy.context.scene
cena.frame_start, cena.frame_end = 1, N
cena.render.resolution_x, cena.render.resolution_y = W, H
cena.render.fps = 30
cena.render.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items] else "BLENDER_EEVEE"
ee = cena.eevee
for nome, valor in (("taa_render_samples", AMOSTRAS), ("use_raytracing", True), ("use_shadows", True), ("use_gtao", True), ("use_bloom", True)):
    if hasattr(ee, nome):
        setattr(ee, nome, valor)
cena.view_settings.view_transform = "AgX" if "AgX" in [v.identifier for v in bpy.types.ColorManagedViewSettings.bl_rna.properties["view_transform"].enum_items] else "Filmic"
cena.view_settings.look = "AgX - Punchy" if cena.view_settings.view_transform == "AgX" else "None"

# fundo: degradê escuro (mundo)
mundo = bpy.data.worlds.new("mundo")
cena.world = mundo
mundo.use_nodes = True
bg = mundo.node_tree.nodes["Background"]
bg.inputs[0].default_value = FUNDO
bg.inputs[1].default_value = 0.6


def material(nome, base, metal=0.0, rug=0.4, trans=0.0, ior=1.45, emis=None, coat=0.0):
    m = bpy.data.materials.new(nome)
    m.use_nodes = True
    p = m.node_tree.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = base
    p.inputs["Metallic"].default_value = metal
    p.inputs["Roughness"].default_value = rug
    for k in ("Transmission Weight", "Transmission"):
        if k in p.inputs:
            p.inputs[k].default_value = trans
    p.inputs["IOR"].default_value = ior
    for k in ("Coat Weight", "Clearcoat"):
        if k in p.inputs:
            p.inputs[k].default_value = coat
    if emis is not None:
        for k in ("Emission Color", "Emission"):
            if k in p.inputs:
                p.inputs[k].default_value = emis
        if "Emission Strength" in p.inputs:
            p.inputs["Emission Strength"].default_value = 2.0
    if trans > 0 and hasattr(m, "surface_render_method"):
        m.surface_render_method = "DITHERED"
    if trans > 0 and hasattr(m, "use_raytrace_refraction"):
        m.use_raytrace_refraction = True
    return m


def suave(obj, nivel=2, chanfro=0.0):
    if chanfro:
        b = obj.modifiers.new("chanfro", "BEVEL")
        b.width, b.segments = chanfro, 6
    s = obj.modifiers.new("suave", "SUBSURF")
    s.levels = s.render_levels = nivel
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.shade_smooth()


# ---------------------------------------------------------------- palco
bpy.ops.mesh.primitive_cylinder_add(vertices=96, radius=1.5, depth=0.5, location=(0, 0, -0.25))
pedestal = bpy.context.object
pedestal.data.materials.append(material("pedestal", hex_rgb("#0b0b0e"), metal=0.2, rug=0.18, coat=1.0))
suave(pedestal, 1, 0.02)
bpy.ops.mesh.primitive_plane_add(size=40, location=(0, 0, -0.5))
chao = bpy.context.object
chao.data.materials.append(material("chao", FUNDO, rug=0.25, coat=0.5))

# ---------------------------------------------------------------- produto
alvo_z = 0.9
if PRODUTO == "relogio":
    bpy.ops.mesh.primitive_cylinder_add(vertices=128, radius=0.62, depth=0.16, location=(0, 0, 0.55), rotation=(math.radians(70), 0, 0))
    caixa = bpy.context.object
    caixa.data.materials.append(material("aco", hex_rgb("#d9d9de"), metal=1.0, rug=0.12))
    suave(caixa, 2, 0.03)
    bpy.ops.mesh.primitive_cylinder_add(vertices=128, radius=0.54, depth=0.17, location=(0, 0, 0.555), rotation=(math.radians(70), 0, 0))
    mostrador = bpy.context.object
    mostrador.data.materials.append(material("mostrador", COR, metal=0.6, rug=0.25))
    for i in range(12):
        a = i / 12 * 2 * math.pi
        bpy.ops.mesh.primitive_cube_add(size=0.05, location=(0.42 * math.sin(a), -0.09, 0.55 + 0.42 * math.cos(a) * math.sin(math.radians(70))))
        bpy.context.object.data.materials.append(material("indice", hex_rgb("#f5f5f5"), metal=1.0, rug=0.1))
    alvo_z = 0.55
elif PRODUTO == "tenis":
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0.35))
    sola = bpy.context.object
    sola.scale = (1.3, 0.48, 0.14)
    sola.data.materials.append(material("sola", hex_rgb("#f2f2f2"), rug=0.5))
    suave(sola, 2, 0.04)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=64, ring_count=32, radius=0.55, location=(-0.15, 0, 0.62))
    corpo = bpy.context.object
    corpo.scale = (1.15, 0.78, 0.62)
    corpo.data.materials.append(material("tecido", COR, rug=0.6))
    suave(corpo, 1)
    alvo_z = 0.55
else:  # perfume
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0.31))
    frasco = bpy.context.object
    frasco.scale = (0.62, 0.36, 0.62)  # base encostada no pedestal (altura 0,62 centrada em 0,31)
    # vidro âmbar LAQUEADO: no EEVEE o vidro transparente de verdade reflete o fundo escuro e sai preto; laqueado fica premium e rápido
    frasco.data.materials.append(material("vidro", COR, rug=0.06, coat=1.0))
    suave(frasco, 2, 0.05)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0.55))
    liquido = bpy.context.object
    liquido.scale = (0.54, 0.29, 0.44)
    liquido.hide_render = True  # (só faz sentido com vidro transparente, no Cycles)
    suave(liquido, 2, 0.04)
    bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=0.2, depth=0.34, location=(0, 0, 0.82))
    tampa = bpy.context.object
    tampa.data.materials.append(material("ouro", hex_rgb("#d4af37"), metal=1.0, rug=0.16))
    suave(tampa, 2, 0.03)
    bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=0.09, depth=0.12, location=(0, 0, 0.64))
    gargalo = bpy.context.object
    gargalo.data.materials.append(material("ouro2", hex_rgb("#d4af37"), metal=1.0, rug=0.2))
    alvo_z = 0.45

# ---------------------------------------------------------------- luz de estúdio (chave, recorte, topo)
def area(nome, loc, energia, tam, cor=(1, 1, 1)):
    bpy.ops.object.light_add(type="AREA", location=loc)
    luz = bpy.context.object
    luz.data.energy, luz.data.size, luz.data.color = energia, tam, cor
    alvo = bpy.data.objects.new("alvo_" + nome, None)
    cena.collection.objects.link(alvo)
    alvo.location = (0, 0, alvo_z)
    t = luz.constraints.new("TRACK_TO")
    t.target, t.track_axis, t.up_axis = alvo, "TRACK_NEGATIVE_Z", "UP_Y"
    return luz


area("chave", (3.2, -2.6, 3.0), 650, 2.5)
area("recorte", (-3.0, 2.8, 2.4), 900, 1.2, (1.0, 0.86, 0.7))
area("topo", (0, 0, 5.0), 110, 3.0)
area("contra", (0, 4.5, 1.2), 400, 1.5, (0.7, 0.8, 1.0))

# ---------------------------------------------------------------- câmera em órbita com profundidade de campo
piv = bpy.data.objects.new("pivo", None)
cena.collection.objects.link(piv)
piv.location = (0, 0, alvo_z)
bpy.ops.object.camera_add(location=(0, -5.2, alvo_z + 0.9))
cam = bpy.context.object
cam.parent = piv
cena.camera = cam
cam.data.lens = 58
cam.data.dof.use_dof = True
alvo_cam = bpy.data.objects.new("foco", None)
cena.collection.objects.link(alvo_cam)
alvo_cam.location = (0, 0, alvo_z)
cam.data.dof.focus_object = alvo_cam
cam.data.dof.aperture_fstop = 2.2
t = cam.constraints.new("TRACK_TO")
t.target, t.track_axis, t.up_axis = alvo_cam, "TRACK_NEGATIVE_Z", "UP_Y"
# órbita com início e fim suaves (movimento de câmera de cinema) + leve subida
piv.rotation_euler = (0, 0, math.radians(-VOLTA / 2))
piv.keyframe_insert("rotation_euler", frame=1)
piv.rotation_euler = (0, 0, math.radians(VOLTA / 2))
piv.keyframe_insert("rotation_euler", frame=N)
cam.location = (0, -5.4, alvo_z + 1.0)
cam.keyframe_insert("location", frame=1)
cam.location = (0, -4.4, alvo_z + 0.25)
cam.keyframe_insert("location", frame=N)
for obj in (piv, cam):
    if obj.animation_data and obj.animation_data.action:
        acao = obj.animation_data.action
        curvas = []
        try:
            curvas = list(acao.fcurves)
        except AttributeError:  # Blender 5: ações em camadas
            for camada in getattr(acao, "layers", []):
                for faixa in camada.strips:
                    for bag in getattr(faixa, "channelbags", []):
                        curvas += list(bag.fcurves)
        for fc in curvas:
            for k in fc.keyframe_points:
                k.interpolation = "BEZIER"
                k.easing = "EASE_IN_OUT"

# ---------------------------------------------------------------- render
cena.render.image_settings.file_format = "PNG"
cena.render.filepath = SAIDA.rstrip("/\\") + "/"
bpy.ops.render.render(animation=True)
print("RENDER_OK", N, W, H)
