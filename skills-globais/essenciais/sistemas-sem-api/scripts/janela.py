"""Ajudante TESTADO para operar programas do Windows pela tela (skill sistemas-sem-api). Use estas funções em vez de escrever automação do zero.
Base: pywinauto com backend "uia" (acessibilidade do Windows), que funciona com programas novos (Windows 11, WinUI) e antigos (Delphi, VB6, Win32).
Instale uma vez no Python que for usar:  python -m pip install pywinauto

Pegadinhas que este arquivo já resolve:
- Programa que abre a janela em OUTRO processo (Bloco de Notas do Windows 11, apps da loja): achamos a janela NOVA pelo título, não pelo processo.
- Acentos e símbolos ao digitar: o texto vai pela área de transferência (Ctrl+V), não tecla por tecla.
- "Salvar como": acha a caixa de diálogo, escreve o caminho completo no campo do nome e confirma; responde "Sim" se perguntar para substituir.
- Antes de agir, sempre traz a janela para a frente e espera ela estar pronta.

Uso rápido:
    from janela import abrir, digitar, atalho, salvar_como, fechar, listar_controles
    w = abrir("notepad.exe", r".*Bloco de notas|.*Notepad")
    digitar(w, "Pedido 123 - cliente Ana")
    salvar_como(w, r"C:\\pasta\\pedido-123.txt")
    fechar(w)
"""
import os
import subprocess
import time

from pywinauto import Desktop, keyboard
from pywinauto.timings import wait_until

DESKTOP = Desktop(backend="uia")


def _janelas(titulo_re):
    try:
        return [w for w in DESKTOP.windows(title_re=titulo_re, visible_only=True)]
    except Exception:
        return []


def abrir(executavel, titulo_re, espera=30, argumentos=None):
    """Abre o programa e devolve a janela NOVA cujo título casa com titulo_re (regex)."""
    antes = {w.handle for w in _janelas(titulo_re)}
    subprocess.Popen([executavel] + list(argumentos or []))
    fim = time.time() + espera
    while time.time() < fim:
        novas = [w for w in _janelas(titulo_re) if w.handle not in antes]
        if novas:
            w = novas[-1]
            wait_until(espera, 0.3, lambda: w.is_visible() and w.is_enabled())
            focar(w)
            return w
        time.sleep(0.5)
    raise TimeoutError(f"a janela '{titulo_re}' não apareceu em {espera} s")


def achar(titulo_re, espera=10):
    """Janela que já está aberta (a mais recente com esse título)."""
    fim = time.time() + espera
    while time.time() < fim:
        js = _janelas(titulo_re)
        if js:
            return js[-1]
        time.sleep(0.5)
    raise TimeoutError(f"nenhuma janela '{titulo_re}' aberta")


def focar(w):
    try:
        if w.is_minimized():
            w.restore()
    except Exception:
        pass
    w.set_focus()
    time.sleep(0.3)


def _area_de_transferencia(texto):
    """Põe o texto na área de transferência como Unicode (direto na API do Windows: acentos nunca se perdem)."""
    import ctypes
    from ctypes import wintypes
    k32, u32 = ctypes.windll.kernel32, ctypes.windll.user32
    k32.GlobalAlloc.restype = wintypes.HGLOBAL
    k32.GlobalAlloc.argtypes = [wintypes.UINT, ctypes.c_size_t]
    k32.GlobalLock.restype = ctypes.c_void_p
    k32.GlobalLock.argtypes = [wintypes.HGLOBAL]
    k32.GlobalUnlock.argtypes = [wintypes.HGLOBAL]
    u32.SetClipboardData.argtypes = [wintypes.UINT, wintypes.HANDLE]
    dados = (texto + chr(0)).encode("utf-16-le")
    for _ in range(10):
        if u32.OpenClipboard(None):
            break
        time.sleep(0.1)
    else:
        raise RuntimeError("a área de transferência está ocupada")
    try:
        u32.EmptyClipboard()
        h = k32.GlobalAlloc(0x0042, len(dados))
        ptr = k32.GlobalLock(h)
        ctypes.memmove(ptr, dados, len(dados))
        k32.GlobalUnlock(h)
        u32.SetClipboardData(13, h)  # CF_UNICODETEXT
    finally:
        u32.CloseClipboard()


def digitar(w, texto, campo=None):
    """Escreve o texto no campo (controle pywinauto) ou no lugar onde o cursor está. Usa Ctrl+V: acentos e símbolos saem certos."""
    focar(w)
    if campo is not None:
        campo.set_focus()
        time.sleep(0.2)
    _area_de_transferencia(texto)
    keyboard.send_keys("^v")
    time.sleep(0.4)


def atalho(w, teclas):
    """Teclas no formato do pywinauto: ^s (Ctrl+S), %f (Alt+F), {ENTER}, {TAB}, {F2}..."""
    focar(w)
    keyboard.send_keys(teclas)
    time.sleep(0.4)


def _dialogo(titulo_re, espera=10):
    fim = time.time() + espera
    while time.time() < fim:
        for w in DESKTOP.windows(visible_only=True):
            try:
                if __import__("re").match(titulo_re, w.window_text() or ""):
                    return w
                for d in w.children(control_type="Window"):  # diálogo filho (WinUI põe o "Salvar como" dentro da janela)
                    if __import__("re").match(titulo_re, d.window_text() or ""):
                        return d
            except Exception:
                continue
        time.sleep(0.4)
    return None


def salvar_como(w, caminho, espera=15):
    """Ctrl+Shift+S (ou Ctrl+S num arquivo novo), escreve o caminho completo e confirma; substitui se já existir."""
    caminho = os.path.abspath(caminho)
    os.makedirs(os.path.dirname(caminho), exist_ok=True)
    atalho(w, "^+s")
    d = _dialogo(r"(Salvar como|Save As).*", espera)
    if d is None:
        atalho(w, "^s")
        d = _dialogo(r"(Salvar como|Save As).*", espera)
    if d is None:
        raise TimeoutError("a janela 'Salvar como' não apareceu")
    nome = None
    for c in d.descendants(control_type="Edit"):
        try:
            if (c.automation_id() == "1001") or "nome" in (c.window_text() or "").lower() or "name" in (c.element_info.name or "").lower():
                nome = c
                break
        except Exception:
            continue
    nome = nome or d.descendants(control_type="Edit")[0]
    nome.set_focus()
    keyboard.send_keys("^a{BACKSPACE}")
    _area_de_transferencia(caminho)
    keyboard.send_keys("^v")
    time.sleep(0.3)
    keyboard.send_keys("{ENTER}")
    time.sleep(1.0)
    conf = _dialogo(r"(Confirmar Salvar como|Confirm Save As).*", 3)
    if conf is not None:
        keyboard.send_keys("%s")  # Alt+S = Sim
        time.sleep(0.8)
    wait_until(espera, 0.5, lambda: os.path.exists(caminho))
    return caminho


def fechar(w, salvar=False):
    """Fecha a janela; se perguntar se quer salvar, responde conforme `salvar`."""
    try:
        focar(w)
        w.close()
    except Exception:
        keyboard.send_keys("%{F4}")
    d = _dialogo(r".*(Bloco de notas|Notepad|Salvar|Save).*", 2)
    if d is not None and d.handle != getattr(w, "handle", None):
        try:
            botoes = {(b.window_text() or "").lower(): b for b in d.descendants(control_type="Button")}
            alvo = next((b for t, b in botoes.items() if (("não" in t or "don't" in t or "nao" in t) and not salvar) or (t in ("salvar", "save") and salvar)), None)
            if alvo is not None:
                alvo.click_input()
        except Exception:
            pass


def listar_controles(w, limite=80):
    """Para descobrir a tela: nome, tipo e automation_id de cada controle (use para montar a macro)."""
    out = []
    for c in w.descendants()[:limite]:
        try:
            out.append({"tipo": c.element_info.control_type, "nome": (c.window_text() or "")[:60], "id": c.automation_id()})
        except Exception:
            continue
    return out


def controle(w, nome, tipo=None, espera=10):
    """Acha um controle pelo nome visível ou de acessibilidade (ex.: campo "Cliente", botão "Lançar"). tipo: Edit, Button, Text, ComboBox..."""
    fim = time.time() + espera
    while time.time() < fim:
        for c in w.descendants(control_type=tipo) if tipo else w.descendants():
            try:
                alvo = nome.strip().lower()
                if alvo in ((c.element_info.name or "").strip().lower(), (c.window_text() or "").strip().lower(), (c.automation_id() or "").strip().lower()):
                    return c
            except Exception:
                continue
        time.sleep(0.4)
    raise LookupError(f"não achei o controle '{nome}'" + (f" ({tipo})" if tipo else "") + "; use listar_controles(w) para ver os nomes")


def preencher(w, nome, texto):
    """Limpa o campo e escreve o texto (por Ctrl+V: acentos certos)."""
    c = controle(w, nome, "Edit")
    focar(w)
    c.set_focus()
    keyboard.send_keys("^a{BACKSPACE}")
    _area_de_transferencia(texto)
    keyboard.send_keys("^v")
    time.sleep(0.2)
    return c


def clicar(w, nome):
    c = controle(w, nome, "Button")
    focar(w)
    try:
        c.invoke()
    except Exception:
        c.click_input()
    time.sleep(0.5)


def ler(w, nome):
    c = controle(w, nome)
    try:
        return c.window_text() or c.element_info.name or ""
    except Exception:
        return ""
