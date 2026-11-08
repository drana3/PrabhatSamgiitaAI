"""Which glyphs a font really has. Run from apps/mobile: python3 scripts/i18n/glyph-check.py
Prints, per language sample, the characters a font file cannot draw (docs/localization.md, fonts plan).
Add a sample string for a new language and a font path to check it."""
import struct,sys
def cmap(path):
    d=open(path,'rb').read()
    n=struct.unpack('>H',d[4:6])[0]
    tabs={}
    for i in range(n):
        tag,cs,off,ln=struct.unpack('>4sIII',d[12+16*i:28+16*i]); tabs[tag]=off
    o=tabs[b'cmap']; nt=struct.unpack('>H',d[o+2:o+4])[0]
    best=None
    for i in range(nt):
        pid,eid,so=struct.unpack('>HHI',d[o+4+8*i:o+12+8*i])
        fmt=struct.unpack('>H',d[o+so:o+so+2])[0]
        if fmt in (4,12) and (pid,eid) in ((3,1),(3,10),(0,3),(0,4)):
            if best is None or fmt==12: best=(o+so,fmt)
    p,fmt=best; cps=set()
    if fmt==12:
        ng=struct.unpack('>I',d[p+12:p+16])[0]
        for i in range(ng):
            s,e,g=struct.unpack('>III',d[p+16+12*i:p+28+12*i]); cps.update(range(s,e+1))
    else:
        sc=struct.unpack('>H',d[p+6:p+8])[0]//2
        ends=struct.unpack('>%dH'%sc,d[p+14:p+14+2*sc]); st=struct.unpack('>%dH'%sc,d[p+16+2*sc:p+16+4*sc])
        for s,e in zip(st,ends):
            if s!=0xFFFF: cps.update(range(s,e+1))
    return cps
samples={"Portuguese (pt-BR)":"Início Músicas Configurações ação coração não é ê ü","Spanish":"Búsqueda ¿Qué? ñ","Russian":"Поиск Настройки","Hindi (hi)":"खोजें सेटिंग्स भाषा हिन्दी","Chinese TW":"搜尋 設定 語言 繁體中文","Korean":"검색 설정 언어 한국어"}
for name,path in (("Roboto 400","node_modules/@expo-google-fonts/roboto/400Regular/Roboto_400Regular.ttf"),("Noto Sans Devanagari 400","node_modules/@expo-google-fonts/noto-sans-devanagari/400Regular/NotoSansDevanagari_400Regular.ttf")):
    c=cmap(path); print(name,len(c),"glyph codes")
    for lang,txt in samples.items():
        miss=sorted({ch for ch in txt if not ch.isspace() and ord(ch) not in c})
        print("  %-20s %s"%(lang,"all present" if not miss else "missing %d: %s"%(len(miss),"".join(miss))))
