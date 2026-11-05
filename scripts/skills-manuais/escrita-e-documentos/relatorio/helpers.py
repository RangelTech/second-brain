"""
helpers.py — Skill 'relatorio'
Blocos reutilizáveis para gerar DOCX corporativo + diagramas em matplotlib.

Uso: copie as seções necessárias para o seu `generate_<doc>.py`, ou importe.
Requisitos: python-docx, matplotlib, pillow.
    pip install python-docx matplotlib pillow

Padrão de script gerador:
    1) gerar PNGs em docs/assets/  (funções diagram_*)
    2) montar o DOCX (helpers H/P/bullet/table/code/image + capa)
    3) doc.save(...)
Sempre abra os PNGs e revise sobreposições antes de finalizar.
"""
import os
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch

from docx import Document
from docx.shared import Pt, RGBColor, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

# ─── Paleta corporativa azul-marinho ─────────────────────────────────────────────
NAVY   = "#003366"
BLUE   = "#006699"
TEAL   = "#4A90A4"
LIGHT  = "#E8F0F5"
LIGHT2 = "#DCEAF2"
GREY   = "#8A8A8A"
ORANGE = "#E8871E"
GREEN  = "#2E8B57"
WHITE  = "#FFFFFF"
NAVY_RGB = (0, 51, 102)

# ══════════════════════════════════════════════════════════════════════════════
# PRIMITIVAS DE DIAGRAMA (matplotlib)
# ══════════════════════════════════════════════════════════════════════════════
def box(ax, x, y, w, h, text, face=WHITE, edge=NAVY, fs=9, tcolor=NAVY,
        bold=False, radius=0.02, lw=1.4):
    """Caixa arredondada com texto centralizado."""
    ax.add_patch(FancyBboxPatch(
        (x, y), w, h, boxstyle=f"round,pad=0.01,rounding_size={radius}",
        linewidth=lw, edgecolor=edge, facecolor=face, zorder=2))
    ax.text(x + w / 2, y + h / 2, text, ha="center", va="center",
            fontsize=fs, color=tcolor, weight="bold" if bold else "normal", zorder=3)

def band(ax, x, y, w, h, text, face=NAVY, tcolor=WHITE, fs=10):
    """Faixa horizontal preenchida (ex.: CI/CD, Governança, Observabilidade).
    IMPORTANTE: texto não quebra — encurte ou reduza fs se vazar."""
    ax.add_patch(FancyBboxPatch(
        (x, y), w, h, boxstyle="round,pad=0.01,rounding_size=0.015",
        linewidth=0, facecolor=face, zorder=1))
    ax.text(x + w / 2, y + h / 2, text, ha="center", va="center",
            fontsize=fs, color=tcolor, weight="bold", zorder=3)

def arrow(ax, x1, y1, x2, y2, color=TEAL, lw=1.8, style="-|>"):
    ax.add_patch(FancyArrowPatch((x1, y1), (x2, y2), arrowstyle=style,
                 mutation_scale=14, linewidth=lw, color=color, zorder=1))

def save(fig, path):
    plt.tight_layout()
    fig.savefig(path, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    return path

# ══════════════════════════════════════════════════════════════════════════════
# RECEITAS DE DIAGRAMA (adapte labels/cores ao seu documento)
# ══════════════════════════════════════════════════════════════════════════════
def diagram_arquitetura_camadas(path):
    """Arquitetura em camadas: bandas horizontais + colunas + fluxo L→R.
    Zonas Y reservadas p/ evitar colisão: colunas 60–82, bandas 43–57, base 35."""
    fig, ax = plt.subplots(figsize=(11.5, 6.6), dpi=200)
    ax.set_xlim(0, 160); ax.set_ylim(0, 96); ax.axis("off")

    band(ax, 3, 88, 154, 6.5, "FAIXA DO TOPO  ·  ex.: GitHub · Terraform · CI/CD", face=NAVY, fs=10.5)
    for lbl, xc in [("COLUNA A", 16), ("COLUNA B", 46), ("CENTRO", 98), ("DIREITA", 148)]:
        ax.text(xc, 84.5, lbl, ha="center", fontsize=9.5, color=GREY, weight="bold")

    for i, t in enumerate(["Item A1", "Item A2", "Item A3", "Item A4"]):
        box(ax, 4, 78 - i * 5.7, 24, 4.7, t, face=LIGHT, fs=8)
    for i, t in enumerate(["Item B1", "Item B2", "Item B3"]):
        box(ax, 34, 78 - i * 5.7, 24, 4.7, t, face=LIGHT2, fs=8)

    box(ax, 64, 66, 20, 9, "CAMADA 1", face=WHITE, edge=BLUE, tcolor=BLUE, bold=True, fs=8.5)
    box(ax, 88, 66, 20, 9, "CAMADA 2", face=WHITE, edge=BLUE, tcolor=BLUE, bold=True, fs=8.5)
    box(ax, 112, 66, 22, 9, "CAMADA 3", face=BLUE, edge=BLUE, tcolor=WHITE, bold=True, fs=8.5)
    arrow(ax, 84, 70.5, 88, 70.5); arrow(ax, 108, 70.5, 112, 70.5)

    band(ax, 34, 51, 100, 6, "BANDA MEIO 1  ·  ex.: Governança & Segurança", face=TEAL, fs=8)
    band(ax, 34, 43, 100, 6, "BANDA MEIO 2  ·  ex.: Orquestração", face=BLUE, fs=8.5)

    box(ax, 137, 74, 20, 6.5, "Saída A", face=LIGHT, fs=8)
    box(ax, 137, 65.5, 20, 6.5, "Saída B", face=LIGHT, fs=8)
    box(ax, 137, 55, 20, 7.5, "Destaque 1", face=WHITE, edge=GREEN, tcolor=GREEN, bold=True, fs=8)
    box(ax, 137, 45.5, 20, 7.5, "Destaque 2", face=WHITE, edge=ORANGE, tcolor=ORANGE, bold=True, fs=8)

    arrow(ax, 28, 69, 34, 69); arrow(ax, 58, 69, 64, 70.5)
    arrow(ax, 134, 70.5, 137, 77); arrow(ax, 134, 69, 137, 68.5); arrow(ax, 134, 67, 137, 58)

    band(ax, 3, 35, 154, 6, "BANDA BASE  ·  ex.: Observabilidade / Monitoramento", face=NAVY, fs=8.5)
    return save(fig, path)


def diagram_mapa_esquerda_direita(path, esquerda, direita, mapa):
    """Colunas esquerda→direita com setas de mapeamento.
    esquerda: [str]; direita: [(titulo, sub, cor)]; mapa: [(i_esq, i_dir)]."""
    fig, ax = plt.subplots(figsize=(11.5, 5.2), dpi=200)
    ax.set_xlim(0, 160); ax.set_ylim(0, 78); ax.axis("off")
    ax.text(38, 73, "ORIGEM", ha="center", fontsize=11, color=NAVY, weight="bold")
    ax.text(122, 73, "DESTINO", ha="center", fontsize=11, color=NAVY, weight="bold")

    stepL = 58 / max(len(esquerda), 1)
    stepR = 55 / max(len(direita), 1)
    for i, d in enumerate(esquerda):
        box(ax, 6, 58 - i * (stepL + 2), 52, 8, d, face=LIGHT, edge=GREY, fs=8.5)
    for i, (t, s, c) in enumerate(direita):
        box(ax, 100, 55 - i * (stepR + 2), 54, 9, f"{t}\n{s}", face=WHITE, edge=c, tcolor=c, bold=True, fs=8.8)
    for a, b in mapa:
        y1 = 58 - a * (stepL + 2) + 4
        y2 = 55 - b * (stepR + 2) + 4.5
        arrow(ax, 58, y1, 100, y2, color=GREY, lw=1.1)
    return save(fig, path)


def diagram_fases(path, fases):
    """Blocos de fases em linha ligados por setas. fases: [(titulo, sub, cor)]."""
    fig, ax = plt.subplots(figsize=(11.5, 3.4), dpi=200)
    ax.set_xlim(0, 160); ax.set_ylim(0, 40); ax.axis("off")
    n = len(fases); w = 23; gap = 3
    x0 = (160 - (n * w + (n - 1) * gap)) / 2
    for i, (t, s, c) in enumerate(fases):
        x = x0 + i * (w + gap)
        box(ax, x, 12, w, 16, f"{t}\n\n{s}", face=c, edge=c, tcolor=WHITE, bold=True, fs=8.6, radius=0.06)
        if i < n - 1:
            arrow(ax, x + w, 20, x + w + gap, 20, color=GREY, lw=1.6)
    return save(fig, path)


def diagram_gantt(path, tarefas, semanas_max=26, nota=""):
    """Cronograma. tarefas: [(label, semana_inicio, duracao, cor, tracejado_bool)]."""
    fig, ax = plt.subplots(figsize=(11.5, 5.0), dpi=200)
    n = len(tarefas)
    for i, (label, ini, dur, cor, dash) in enumerate(tarefas):
        y = n - i - 1
        if dash:
            ax.barh(y, dur, left=ini, height=0.55, color="white",
                    edgecolor=cor, hatch="////", linewidth=1.3, zorder=3)
        else:
            ax.barh(y, dur, left=ini, height=0.55, color=cor, edgecolor=cor, zorder=3)
        ax.text(ini + dur / 2, y, f"{dur} sem", ha="center", va="center",
                fontsize=8, color=(GREY if dash else "white"), weight="bold", zorder=4)
        ax.text(ini - 0.4, y, label, ha="right", va="center", fontsize=8.6, color=NAVY)
    ax.set_xlim(-0.4, semanas_max - 0.5); ax.set_ylim(-0.7, n - 0.3)
    ax.set_yticks([])
    ax.set_xticks(range(0, semanas_max, 2))
    ax.set_xticklabels([f"S{w}" for w in range(0, semanas_max, 2)], fontsize=8, color=GREY)
    for x in range(1, semanas_max):
        ax.axvline(x, color="#EDEDED", linewidth=0.6, zorder=0)
    ax.set_xlabel("Semanas de projeto", fontsize=9, color=NAVY)
    for sp in ["top", "right", "left"]:
        ax.spines[sp].set_visible(False)
    ax.spines["bottom"].set_color(GREY)
    if nota:
        ax.text(semanas_max - 0.6, -0.6, nota, ha="right", fontsize=8, color=GREY, style="italic")
    return save(fig, path)

# ══════════════════════════════════════════════════════════════════════════════
# HELPERS DE DOCX (python-docx)
# ══════════════════════════════════════════════════════════════════════════════
def new_doc():
    doc = Document()
    s = doc.sections[0]
    s.page_width = Inches(8.5); s.page_height = Inches(11)
    s.left_margin = s.right_margin = Inches(1)
    s.top_margin = s.bottom_margin = Inches(1)
    return doc

def capa(doc, titulo, subtitulo, cliente, rodape_linhas=()):
    doc.add_paragraph().add_run("\n\n\n")
    for txt, sz, col, bold in [
        (titulo, 26, (0, 51, 102), True),
        (subtitulo, 16, (0, 102, 153), False),
        (cliente, 14, (74, 144, 164), True),
    ]:
        p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r = p.add_run(txt); r.font.size = Pt(sz); r.bold = bold
        r.font.color.rgb = RGBColor(*col)
    doc.add_paragraph("\n")
    m = doc.add_paragraph(); m.alignment = WD_ALIGN_PARAGRAPH.CENTER
    for ln in rodape_linhas:
        m.add_run(ln + "\n")
    doc.add_page_break()

def H(doc, text, level=1, color=NAVY_RGB):
    h = doc.add_heading(text, level=level)
    if color:
        for r in h.runs:
            r.font.color.rgb = RGBColor(*color)
    return h

def P(doc, text, bold=False, italic=False, size=11):
    p = doc.add_paragraph(); r = p.add_run(text)
    r.bold = bold; r.italic = italic; r.font.size = Pt(size)
    return p

def bullet(doc, lead, rest=""):
    p = doc.add_paragraph(style="List Bullet")
    p.add_run(lead).bold = bool(rest)
    if rest:
        p.add_run(rest)
    return p

def numbered(doc, title, desc):
    p = doc.add_paragraph(style="List Number")
    p.add_run(title + ": ").bold = True; p.add_run(desc)

def code(doc, text):
    p = doc.add_paragraph(); r = p.add_run(text)
    r.font.name = "Courier New"; r.font.size = Pt(9)
    sh = OxmlElement("w:shd"); sh.set(qn("w:fill"), "F2F2F2")
    p._p.get_or_add_pPr().append(sh)
    return p

def table(doc, headers, rows):
    t = doc.add_table(rows=1 + len(rows), cols=len(headers))
    t.style = "Table Grid"
    hdr = t.rows[0].cells
    for i, h in enumerate(headers):
        hdr[i].text = h
        for r in hdr[i].paragraphs[0].runs:
            r.bold = True; r.font.color.rgb = RGBColor(255, 255, 255)
        sh = OxmlElement("w:shd"); sh.set(qn("w:fill"), "003366")
        hdr[i]._tc.get_or_add_tcPr().append(sh)
    for ri, row in enumerate(rows):
        cells = t.rows[ri + 1].cells
        for ci, val in enumerate(row):
            cells[ci].text = val
            for r in cells[ci].paragraphs[0].runs:
                r.font.size = Pt(9.5)
    return t

def image(doc, path, width=6.4, caption=None):
    doc.add_picture(path, width=Inches(width))
    doc.paragraphs[-1].alignment = WD_ALIGN_PARAGRAPH.CENTER
    if caption:
        c = doc.add_paragraph(); c.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r = c.add_run(caption); r.italic = True; r.font.size = Pt(9)
        r.font.color.rgb = RGBColor(128, 128, 128)

def rodape(doc, texto):
    doc.add_paragraph()
    p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run(texto); r.font.size = Pt(9); r.italic = True
    r.font.color.rgb = RGBColor(128, 128, 128)

# ══════════════════════════════════════════════════════════════════════════════
# EXEMPLO MÍNIMO (rode: python helpers.py  → gera exemplo_relatorio.docx)
# ══════════════════════════════════════════════════════════════════════════════
if __name__ == "__main__":
    assets = os.path.join(os.getcwd(), "assets_exemplo")
    os.makedirs(assets, exist_ok=True)
    ig = diagram_gantt(
        os.path.join(assets, "gantt.png"),
        tarefas=[
            ("E0 · Discovery (com o cliente)", 1, 2, NAVY, False),
            ("E1 · Fundação", 3, 4, BLUE, False),
            ("E2 · Construção", 6, 5, TEAL, False),
            ("E3 · Entrega & handover", 10, 3, ORANGE, False),
            ("Sustentação contínua", 8, 6, GREY, True),
        ],
        nota="Total ~12 semanas + sustentação",
    )
    doc = new_doc()
    capa(doc, "RELATÓRIO / PROPOSTA", "Subtítulo do documento", "Cliente: Exemplo",
         rodape_linhas=["Gerado com a skill 'relatorio'", "Julho 2026"])
    H(doc, "1. Introdução")
    P(doc, "Texto de exemplo demonstrando os helpers de DOCX.")
    bullet(doc, "Ponto-chave: ", "com destaque em negrito no início.")
    table(doc, ["Coluna A", "Coluna B"], [["a1", "b1"], ["a2", "b2"]])
    H(doc, "2. Cronograma")
    image(doc, ig, width=6.5, caption="Figura 1 — Cronograma (Gantt).")
    rodape(doc, "Documento de exemplo — skill relatorio")
    out = os.path.join(os.getcwd(), "exemplo_relatorio.docx")
    doc.save(out)
    print("OK:", out)
