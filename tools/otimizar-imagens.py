#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Deixa as imagens do site leves para abrir no celular.

O que faz, em uma passada so:

1. Reduz a imagem original para no maximo 1600px no maior lado e regrava
   em JPEG progressivo (ou WebP/PNG, conforme a origem) sem os dados de
   camera. E a versao "grande", usada em telas grandes.
2. Cria assets/md/  -> ate 900px de largura. E a versao que o celular baixa
   nos cartoes do portfolio, no topo da ficha e na previa da planta.
3. Cria assets/mini/ -> ate 320px de largura. E a versao das miniaturas da
   galeria, das logos sobre a foto e das fotos do modal de compartilhar.

As tres versoes tem o MESMO nome de arquivo, so mudando a pasta. O site
monta o srcset a partir disso (ver imgSrcset em app.js).

Uso:
    python3 tools/otimizar-imagens.py            # aplica
    python3 tools/otimizar-imagens.py --simular  # so mostra o que faria

Precisa do Pillow:  pip install Pillow
"""

import argparse
import io
import os
import sys

from PIL import Image, ImageOps

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORIGEM = os.path.join(RAIZ, "assets")
PASTA_MD = os.path.join(ORIGEM, "md")
PASTA_MINI = os.path.join(ORIGEM, "mini")

# Pastas derivadas nao entram na varredura (senao otimizaria o proprio resultado).
IGNORAR_PASTAS = {"md", "mini"}

EXTENSOES = (".jpg", ".jpeg", ".png", ".webp")

LADO_MAX_GRANDE = 1600
LARGURA_MD = 900
LARGURA_MINI = 320

# Fotos aceitam mais compressao; planta, mapa e logo tem linha fina e texto,
# entao ficam com qualidade mais alta para nao "sujar" o desenho.
QUALIDADE_FOTO = 78
QUALIDADE_DESENHO = 86
QUALIDADE_MD = 74
QUALIDADE_MINI = 70

# Logos aparecem no maximo com 190px de largura na tela; 420px cobre telas 2x.
LARGURA_LOGO = 420
LOGOS = {
    "senger-logo.png",
    "senger-logo-branco.png",
    "ren-logo.png",
    "nvr3-logo.jpg",
}

# As imagens de previa do WhatsApp precisam continuar 1200x630: e o formato que
# o WhatsApp/Facebook esperam. Nessas so vale recomprimir.
SEM_REDIMENSIONAR = {"preview"}


def eh_desenho(nome):
    baixo = nome.lower()
    return any(marca in baixo for marca in ("planta", "mapa", "map", "logo", "urb", "folder"))


def listar():
    arquivos = []
    for pasta, subpastas, nomes in os.walk(ORIGEM):
        subpastas[:] = [s for s in subpastas if s not in IGNORAR_PASTAS]
        for nome in nomes:
            if nome.lower().endswith(EXTENSOES):
                arquivos.append(os.path.join(pasta, nome))
    return sorted(arquivos)


def abrir(caminho):
    imagem = Image.open(caminho)
    # Aplica a rotacao da foto e joga fora o EXIF: menos bytes e nenhuma foto deitada.
    imagem = ImageOps.exif_transpose(imagem)
    return imagem


def redimensionar_lado(imagem, lado_max):
    largura, altura = imagem.size
    maior = max(largura, altura)
    if maior <= lado_max:
        return imagem
    escala = lado_max / float(maior)
    return imagem.resize((max(1, round(largura * escala)), max(1, round(altura * escala))), Image.LANCZOS)


def redimensionar_largura(imagem, largura_max):
    largura, altura = imagem.size
    if largura <= largura_max:
        return imagem
    escala = largura_max / float(largura)
    return imagem.resize((largura_max, max(1, round(altura * escala))), Image.LANCZOS)


def gravar(imagem, formato, qualidade):
    """Devolve os bytes da imagem no formato pedido."""
    buffer = io.BytesIO()
    if formato == "PNG":
        # Logo/desenho com transparencia: paleta de 256 cores corta o arquivo em
        # varias vezes e, num desenho chapado, nao muda o que se ve.
        alvo = imagem
        if alvo.mode not in ("P", "L"):
            tem_alfa = "A" in alvo.getbands()
            alvo = alvo.convert("RGBA") if tem_alfa else alvo.convert("RGB")
            # RGBA so aceita octree; RGB fica melhor com mediancut.
            metodo = Image.FASTOCTREE if tem_alfa else Image.MEDIANCUT
            alvo = alvo.quantize(colors=256, method=metodo)
        alvo.save(buffer, format="PNG", optimize=True)
    elif formato == "WEBP":
        alvo = imagem if imagem.mode in ("RGB", "RGBA") else imagem.convert("RGBA")
        alvo.save(buffer, format="WEBP", quality=qualidade, method=6)
    else:
        alvo = imagem.convert("RGB")
        alvo.save(buffer, format="JPEG", quality=qualidade, optimize=True, progressive=True, subsampling="4:2:0")
    return buffer.getvalue()


def formato_de(caminho, imagem):
    ext = os.path.splitext(caminho)[1].lower()
    if ext == ".webp":
        return "WEBP"
    if ext == ".png":
        # PNG so vale a pena quando a imagem tem transparencia (logo, marca).
        # Foto salva em PNG pesa varias vezes mais do que precisa: vira JPEG e o
        # script avisa no fim para a referencia ser trocada em data.js/index.html.
        return "PNG" if tem_transparencia(imagem) else "JPEG"
    return "JPEG"


def tem_transparencia(imagem):
    if imagem.mode in ("RGBA", "LA"):
        canal = imagem.getchannel("A")
        return canal.getextrema()[0] < 255
    return imagem.mode == "P" and "transparency" in imagem.info


def escrever(caminho, dados, simular):
    if simular:
        return
    os.makedirs(os.path.dirname(caminho), exist_ok=True)
    with open(caminho, "wb") as saida:
        saida.write(dados)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--simular", action="store_true", help="mostra o resultado sem gravar nada")
    args = parser.parse_args()

    arquivos = listar()
    if not arquivos:
        print("Nenhuma imagem encontrada em assets/.")
        return 1

    antes_total = 0
    depois_total = 0
    derivadas_total = 0
    trocaram_de_extensao = []

    for caminho in arquivos:
        relativo = os.path.relpath(caminho, ORIGEM)
        nome = os.path.basename(caminho)
        pasta_relativa = os.path.dirname(relativo)
        antes = os.path.getsize(caminho)
        antes_total += antes

        imagem = abrir(caminho)
        formato = formato_de(caminho, imagem)
        desenho = eh_desenho(nome)
        qualidade = QUALIDADE_DESENHO if desenho else QUALIDADE_FOTO

        # PNG opaco vira JPEG: muda o arquivo de destino e apaga o antigo.
        if formato == "JPEG" and not nome.lower().endswith((".jpg", ".jpeg")):
            antigo = caminho
            nome = os.path.splitext(nome)[0] + ".jpg"
            relativo = os.path.join(pasta_relativa, nome) if pasta_relativa else nome
            caminho = os.path.join(ORIGEM, relativo)
            trocaram_de_extensao.append((os.path.relpath(antigo, RAIZ), os.path.relpath(caminho, RAIZ)))
            if not args.simular:
                os.remove(antigo)

        if nome in LOGOS:
            grande = redimensionar_largura(imagem, LARGURA_LOGO)
        elif pasta_relativa in SEM_REDIMENSIONAR:
            grande = imagem
        else:
            grande = redimensionar_lado(imagem, LADO_MAX_GRANDE)

        dados_grande = gravar(grande, formato, qualidade)
        # So troca o original se realmente ficou menor — a nao ser que o arquivo
        # tenha mudado de extensao, ai a gravacao e obrigatoria.
        virou_outro_arquivo = bool(trocaram_de_extensao) and trocaram_de_extensao[-1][1].endswith(relativo)
        if len(dados_grande) < antes or virou_outro_arquivo:
            escrever(caminho, dados_grande, args.simular)
            depois = len(dados_grande)
        else:
            depois = antes
        depois_total += depois

        # As imagens de previa do WhatsApp nunca aparecem dentro do site: quem as le
        # e o robo do WhatsApp/Facebook, sempre no tamanho cheio. Nao tem derivada.
        if pasta_relativa in SEM_REDIMENSIONAR:
            print(f"{relativo:44} {antes/1024:7.0f} KB -> {depois/1024:7.0f} KB")
            continue

        base = grande if len(dados_grande) < antes else imagem
        for pasta_destino, largura, q in (
            (PASTA_MD, LARGURA_MD, QUALIDADE_MD if not desenho else QUALIDADE_DESENHO),
            (PASTA_MINI, LARGURA_MINI, QUALIDADE_MINI),
        ):
            derivada = redimensionar_largura(base, largura)
            dados = gravar(derivada, formato, q)
            destino = os.path.join(pasta_destino, relativo)
            escrever(destino, dados, args.simular)
            derivadas_total += len(dados)

        print(f"{relativo:44} {antes/1024:7.0f} KB -> {depois/1024:7.0f} KB  (+md, +mini)")

    print("")
    if trocaram_de_extensao:
        print("Arquivos que mudaram de extensao — troque a referencia em data.js / index.html / styles.css:")
        for antigo, novo in trocaram_de_extensao:
            print(f"  {antigo}  ->  {novo}")
        print("")
    print(f"Originais: {antes_total/1024/1024:.1f} MB -> {depois_total/1024/1024:.1f} MB")
    print(f"Derivadas (md + mini): {derivadas_total/1024/1024:.1f} MB")
    if args.simular:
        print("(simulacao — nada foi gravado)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
