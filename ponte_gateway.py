"""Ponte única app <-> gateway do Hermes (spec 34, fase 0, protótipo).

Um processo para TODAS as conversas, no lugar de um `hermes-acp` por chat. Conecta no gateway com o próprio
cliente do Hermes (`hermes_cli.gateway_client.connect_gateway`: sobe o gateway se preciso, pega o tíquete
pelo canal privado e abre o WebSocket canônico) e fala com o app por linhas JSON em stdin/stdout:

  app -> ponte   {"id": 1, "method": "session.create", "params": {...}}
  ponte -> app   {"id": 1, "result": {...}}  ou  {"id": 1, "error": {"message": "...", "code": "..."}}
  ponte -> app   {"evento": {...}}           (notificação do gateway: message.delta, tool.start, approval.request...)
  ponte -> app   {"pronta": true, "ms": 812} (uma vez, quando conectou)

Rodar com o Python do Hermes e o workspace no sys.path (o bench faz isso).
"""
from __future__ import annotations

import asyncio
import json
import sys
import time


def escrever(obj) -> None:
    sys.stdout.write(json.dumps(obj, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def cron_local(p: dict) -> dict:
    acao = p.get("action")
    jid = str(p.get("name") or "")
    if acao == "update":
        from tools.cronjob_tools import cronjob
        campos = {k: p[k] for k in ("prompt", "schedule", "name_novo") if p.get(k)}
        if "name_novo" in campos:
            campos["name"] = campos.pop("name_novo")
        return json.loads(cronjob(action="update", job_id=jid, **campos))
    if acao == "run":
        # roda num processo separado (o CLI executa até o fim e grava a saída); a ponte não fica presa
        import subprocess
        import os
        flags = 0x08000000 if os.name == "nt" else 0  # sem janela de console
        subprocess.Popen([sys.executable, "-m", "hermes_cli.main", "cron", "run", jid], stdin=subprocess.DEVNULL,
                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, creationflags=flags,
                         env={**os.environ, "PYTHONPATH": os.pathsep.join(x for x in sys.path if x)})
        return {"success": True, "started": True}
    raise ValueError(f"ação desconhecida: {acao}")


async def principal() -> None:
    t0 = time.perf_counter()
    from hermes_cli.gateway_client import connect_gateway, GatewayRPCError

    loop = asyncio.get_running_loop()

    async with connect_gateway() as cliente:
        escrever({"pronta": True, "ms": round((time.perf_counter() - t0) * 1000)})

        async def eventos():
            while True:
                frame = await cliente.events.get()
                if isinstance(frame, Exception):
                    escrever({"caiu": str(frame)})
                    return
                escrever({"evento": frame.get("params", frame)})

        async def atender(pedido):
            rid = pedido.get("id")
            if pedido.get("method") == "local.cron":
                # o gateway só cria/pausa/apaga; editar e rodar agora vão direto na ferramenta do Hermes (mesmo jobs.json)
                try:
                    escrever({"id": rid, "result": await asyncio.to_thread(cron_local, pedido.get("params") or {})})
                except Exception as e:  # noqa: BLE001
                    escrever({"id": rid, "error": {"message": f"{type(e).__name__}: {e}", "code": "cron"}})
                return
            try:
                r = await cliente.rpc(pedido["method"], _timeout=pedido.get("timeout"), **(pedido.get("params") or {}))
                escrever({"id": rid, "result": r})
            except GatewayRPCError as e:
                escrever({"id": rid, "error": {"message": str(e), "code": getattr(e, "code", None), "data": getattr(e, "data", None)}})
            except Exception as e:  # noqa: BLE001
                escrever({"id": rid, "error": {"message": f"{type(e).__name__}: {e}", "code": "transporte"}})

        tarefa = asyncio.create_task(eventos())
        while True:
            linha = await loop.run_in_executor(None, sys.stdin.buffer.readline)  # Windows: stdin de pipe nao entra no IOCP do asyncio
            if not linha:
                break
            try:
                pedido = json.loads(linha)
            except ValueError:
                continue
            asyncio.create_task(atender(pedido))
        tarefa.cancel()


if __name__ == "__main__":
    asyncio.run(principal())
