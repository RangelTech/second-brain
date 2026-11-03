# Captura da tela inteira (para conferir a janela real do app): python scripts/tela.py <saida.png>
import sys
from PIL import ImageGrab
ImageGrab.grab().save(sys.argv[1])
