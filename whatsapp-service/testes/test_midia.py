import sys, os, types, importlib.util, re
src = open(os.path.join(os.path.dirname(__file__), "..", "app.py"), encoding="utf8").read()
ini = src.index("MIDIAS = ("); fim = src.index("def drive_put(")
ns = {}
exec(src[ini:fim], ns)

class Msg:
    def __init__(self, **campos): self.__dict__.update(campos)
    def HasField(self, n): return self.__dict__.get(n) is not None
class Sub:
    def __init__(self, **k): self.__dict__.update(k)

audio = Sub(mimetype="audio/ogg; codecs=opus", PTT=True, seconds=14, fileLength=20480, caption="", fileName="")
puro = Msg(audioMessage=audio)
emb = Msg(ephemeralMessage=Sub(message=Msg(viewOnceMessage=Sub(message=puro))))
r = ns["detectar_midia"](ns["desembrulhar"](emb))
assert r == ("audio", "audio/ogg", "", "", True, 14, 20480), r
print("ok áudio de voz OGG/Opus dentro de ephemeral+viewOnce:", r)

doc = Msg(documentWithCaptionMessage=Sub(message=Msg(documentMessage=Sub(mimetype="application/pdf", caption="contrato", fileName="contrato.pdf", fileLength=5000, seconds=0))))
r = ns["detectar_midia"](ns["desembrulhar"](doc))
assert r[:4] == ("documento", "application/pdf", "contrato", "contrato.pdf"), r
print("ok documento com legenda (antes virava 'não suportado'):", r[:4])

img = Msg(imageMessage=Sub(mimetype="image/jpeg", caption="foto", fileName="", fileLength=999))
assert ns["detectar_midia"](ns["desembrulhar"](img))[0] == "imagem"
assert ns["detectar_midia"](Msg(conversation="oi")) is None
print("ok imagem e texto puro")
