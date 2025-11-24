import sys
import os
import json
from yt_dlp import YoutubeDL

def download_mp3(video_url, output_path, cookies_path=None):
    """
    Baixa o áudio de um vídeo do YouTube e salva como MP3.
    """
    try:
        # Configurações do yt-dlp
        ydl_opts = {
            'format': 'bestaudio/best',
            'extractor_args': {'youtube': {'player_client': 'web'}}, # Tentativa de contornar restrições
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '192',
            }],
            'outtmpl': output_path,
            'quiet': True,
            'noprogress': True,
            'force_ipv4': True,
            'extractor_retries': 3,
            'fragment_retries': 3,
            'socket_timeout': 30,
            'no_warnings': True,
            'no_check_formats': True,
            'no_cache_dir': True,
            'postprocessor_args': ['-metadata', 'title='], # Remove metadados de título
        }

        if cookies_path and os.path.exists(cookies_path):
            # yt-dlp é muito rigoroso com o formato Netscape.
            # O formato JSON é mais robusto e recomendado.
            # Se o arquivo for .json, ele tentará carregar como JSON.
            # Se for .txt, tentará carregar como Netscape.
            ydl_opts['cookiefile'] = cookies_path
            print(f"Usando cookies de: {cookies_path}", file=sys.stderr)
        
        with YoutubeDL(ydl_opts) as ydl:
            # O yt-dlp adiciona a extensão .mp3 automaticamente
            # O output_path deve ser passado SEM a extensão
            ydl.download([video_url])
        
        # O yt-dlp salva o arquivo com a extensão .mp3
        final_output_path = output_path + ".mp3"
        
        if os.path.exists(final_output_path):
            return {"success": True, "path": final_output_path}
        else:
            return {"success": False, "error": "Arquivo MP3 não encontrado após o download."}

    except Exception as e:
        return {"success": False, "error": str(e)}

if __name__ == "__main__":
    # Espera 3 argumentos: URL do vídeo, caminho de saída (sem extensão) e caminho do arquivo de cookies (opcional)
    if len(sys.argv) < 3:
        print(json.dumps({"success": False, "error": "Uso: python yt_download.py <video_url> <output_path_sem_extensao> [cookies_path]"}))
        sys.exit(1)

    video_url = sys.argv[1]
    output_path_base = sys.argv[2]
    cookies_path = sys.argv[3] if len(sys.argv) > 3 else None
    
    result = download_mp3(video_url, output_path_base, cookies_path)
    print(json.dumps(result))