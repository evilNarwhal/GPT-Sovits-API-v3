# =========================================================
# 基础配置 & 依赖
# =========================================================

from fastapi import FastAPI, HTTPException, Request, UploadFile, File, Form
from fastapi.staticfiles import StaticFiles
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List
from urllib.parse import urlparse
import numpy as np
import io
import scipy.io.wavfile as wav
import traceback
import logging
import os
import requests
import json
import uuid
import shutil
import importlib
import sys
import subprocess
# =========================================================
# 服务配置
# =========================================================

# 定义端口
PORT = 9876
# 定义主机
HOST = "0.0.0.0"
# =========================================================
# 请求体模型
# =========================================================

# 定义请求体模型
class TTSRequest(BaseModel):
    ref_wav_path: str
    prompt_text: str
    prompt_language: str = "中文"
    text: str
    text_language: str = "中文"
    how_to_cut: str = "不切"
    top_k: int = 15
    top_p: float = 0.6
    temperature: float = 0.6
    ref_free: bool = False
    speed: float = 1.0
    if_freeze: bool = False
    sample_steps: int = 32
    if_sr: bool = False
    pause_second: float = 0.3

# 添加新的请求体模型
class ChangeSovitsRequest(BaseModel):
    sovits_path: str
    prompt_language: str = "中文"
    text_language: str = "中文"

class ChangeGptRequest(BaseModel):
    gpt_path: str

# version switch request
class ChangeVersionRequest(BaseModel):
    version: str

# 为fast版本添加新的请求体模型
class TTSFastRequest(BaseModel):
    #  参考音频路径
    ref_audio_path: str
    # 参考文本
    prompt_text: str
    # 参考文本语言
    prompt_lang: str = "中文"
    # 合成文本
    text: str
    # 合成文本语言
    text_lang: str = "中文"
    # 切分方式 不切 凑四句一切 凑50字一切 按中文句号。切 按英文句号.切 按标点符号切
    text_split_method: str = "不切"
    top_k: int = 20
    top_p: float = 0.6
    temperature: float = 0.6
    # 无参考文本模式
    ref_text_free: bool = False
    speed_factor: float = 1.0
    batch_size: int = 20
    split_bucket: bool = True
    fragment_interval: float = 0.3
    # 种子
    seed: int = -1
    keep_random: bool = True
    # 并行推理
    parallel_infer: bool = True
    repetition_penalty: float = 1.35
    # 采样步数（v3/4 生效）
    sample_steps: int = 32
    # 超采样（v3 生效）
    super_sampling: bool = False

# =========================================================
# 日志 & 目录
# =========================================================

# 设置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(message)s'  # 只显示消息内容，不显示其他信息
)
logger = logging.getLogger("uvicorn")

# 参考音频保存目录（整合包内）
REF_AUDIO_DIR = os.path.join(os.getcwd(), "ref_audios")
TEMP_REF_AUDIO_DIR = os.path.join(os.getcwd(), "ref_audios_tmp")
os.makedirs(REF_AUDIO_DIR, exist_ok=True)
os.makedirs(TEMP_REF_AUDIO_DIR, exist_ok=True)
# 参考音频解析为文字目录
ASR_TEMP_DIR = os.path.join(os.getcwd(), "asr_tmp")
ASR_OUTPUT_DIR = os.path.join(os.getcwd(), "asr_output")
os.makedirs(ASR_TEMP_DIR, exist_ok=True)
os.makedirs(ASR_OUTPUT_DIR, exist_ok=True)
# 导入源码并执行初始化
from GPT_SoVITS import inference_webui
from GPT_SoVITS import inference_webui_fast

# 获取模型自带的asr路径
ASR_ROOT = os.environ.get("GPT_SOVITS_ROOT") or os.environ.get("ASR_ROOT") or os.getcwd()
if ASR_ROOT not in sys.path:
    sys.path.append(ASR_ROOT)
try:
    from tools.asr.config import asr_dict
except Exception:
    asr_dict = None

# =========================================================
# FastAPI 初始化
# =========================================================

# 创建FastAPI应用
app = FastAPI()

# 添加CORS中间件，设置跨域
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 挂载静态目录，提供参考音频 URL 访问
app.mount("/ref_audios", StaticFiles(directory=REF_AUDIO_DIR), name="ref_audios")
app.mount("/ref_audios_tmp", StaticFiles(directory=TEMP_REF_AUDIO_DIR), name="ref_audios_tmp")

LOCAL_HOSTS = {"localhost", "127.0.0.1", "0.0.0.0"}

# =========================================================
# 工具函数
# =========================================================

# URL 指向本机静态目录时，直接转本地路径避免自调用阻塞
def resolve_local_ref_audio(url):
    # 解析指向本机静态目录的 URL，映射为本地路径
    try:
        parsed = urlparse(url)
        host = parsed.hostname
        path = parsed.path or ""
        if host in LOCAL_HOSTS:
            if path.startswith("/ref_audios_tmp/"):
                return os.path.join(TEMP_REF_AUDIO_DIR, os.path.basename(path))
            if path.startswith("/ref_audios/"):
                return os.path.join(REF_AUDIO_DIR, os.path.basename(path))
    except Exception:
        return None
    return None

# =========================================================
# 全局异常处理
# =========================================================

# 添加全局异常处理器
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    # 统一参数校验错误的返回格式，便于前端处理
    # 统一校验错误返回结构，方便前端/调用方处理。
    logger.error("请求参数验证错误:")
    logger.error(str(exc))
    return JSONResponse(
        status_code=422,
        content={"detail": f"参数验证错误: {str(exc)}"}
    )

# =========================================================
# 推理接口
# =========================================================

# 标准推理接口：支持本地路径/URL/网络URL作为参考音频
# 网络URL不会下载到整合包目录，而是作为临时文件使用，生成语音后删除
@app.post("/tts")
async def tts_api(request: TTSRequest):
    """标准 TTS 推理接口（非 fast 版本）。"""
    # 处理参考音频来源并调用推理
    # 将 PCM 写入内存 WAV 并流式返回
    try:
        # 支持 ref_wav_path 为 URL：优先判断是否本机静态目录
        # 检查是否是网络链接
        if request.ref_wav_path.startswith(('http://', 'https://')):
            # 若 URL 指向本机静态目录，直接映射为本地文件
            local_path = resolve_local_ref_audio(request.ref_wav_path)
            if local_path and os.path.exists(local_path):
                request.ref_wav_path = local_path
            else:
                # 外部 URL 才走网络下载
                response = requests.get(request.ref_wav_path)
                if response.status_code != 200:
                    raise ValueError(f"无法下载音频文件: {request.ref_wav_path}")

                audio_data = response.content
                # 保存音频文件
                temp_audio_path = "temp_audio.wav"
                with open(temp_audio_path, "wb") as f:
                    f.write(audio_data)
                request.ref_wav_path = temp_audio_path
       

        # 调用推理函数生成音频（返回采样率和PCM）。
        sr, audio_opt = next(get_tts_wav(
            ref_wav_path=request.ref_wav_path,
            prompt_text=request.prompt_text,
            prompt_language=request.prompt_language,
            text=request.text,
            text_language=request.text_language,
            how_to_cut=request.how_to_cut,
            top_k=request.top_k,
            top_p=request.top_p,
            temperature=request.temperature,
            ref_free=request.ref_free,
            speed=request.speed,
            if_freeze=request.if_freeze,
            sample_steps=request.sample_steps,
            if_sr=request.if_sr,
            pause_second=request.pause_second
        ))
        
        # 将PCM写入内存WAV，作为流式响应返回。
        audio_bytes = io.BytesIO()
        wav.write(audio_bytes, sr, audio_opt)
        audio_bytes.seek(0)

        # 清理临时文件（仅当使用了临时路径）。
        if request.ref_wav_path == "temp_audio.wav":
            try:
                os.remove(request.ref_wav_path)
            except:
                pass
        
        return StreamingResponse(audio_bytes, media_type="audio/wav")
    except Exception as e:
        logger.error(f"错误: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=422, detail=str(e)) 

# =========================================================
# 权重与模型切换
# =========================================================

@app.post("/change_sovits_weights")
async def change_sovits_weights_api(request: ChangeSovitsRequest):
    """切换 SoVITS 权重，并记录前后配置。"""
    # 切换 SoVITS 权重并记录前后配置
    # 切换 SoVITS 权重路径，并记录前后状态。
    try:
        # 记录切换前后状态，便于排查版本/路径是否正确更新。
        # 记录切换前的配置
        logger.info("切换前的配置:")
        check_current_weights()
        
        # 执行切换
        result = inference_webui.change_sovits_weights(
            sovits_path=request.sovits_path,
            prompt_language=request.prompt_language,
            text_language=request.text_language
        )
        
        # 记录切换后的配置
        logger.info("切换后的配置:")
        check_current_weights()
            
        return result
    except Exception as e:
        logger.error(f"错误: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=422, detail=str(e))

@app.post("/change_gpt_weights")
async def change_gpt_weights(data: dict):
    """切换 GPT 权重，并记录前后配置。"""
    # 切换 GPT 权重并记录前后配置
    # 切换 GPT 权重路径，并记录前后状态。
    try:
        # 仅需传入 gpt_path，立即切换当前权重。
        gpt_path = data["gpt_path"]
        
        # 记录切换前的配置
        logger.info("切换前的配置:")
        check_current_weights()
        
        # 执行切换
        inference_webui.change_gpt_weights(gpt_path)
        
        # 记录切换后的配置
        logger.info("切换后的配置:")
        check_current_weights()
            
        return {"status": "success", "message": "GPT 模型切换成功"}
    except Exception as e:
        logger.error(f"错误: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=422, detail=str(e))

@app.post("/change_choices")
async def change_choices_api():
    """刷新并返回当前可用模型列表。"""
    # 刷新并返回可用模型列表
    # 返回当前扫描到的可用模型列表。
    try:
        # 返回可用模型列表，等价于 WebUI 的“刷新模型路径”。
        # 记录当前配置
        logger.info("检查当前使用的json模型:")
        check_current_weights()
        
        # 调用 inference_webui 中的 change_choices 函数
        result = inference_webui.change_choices()
        
        # 从结果中提取 choices
        sovits_choices = result[0]["choices"]
        gpt_choices = result[1]["choices"]
        
        # 打印可用的模型列表
        logger.info("可用的模型列表:")
        logger.info(f"SoVITS 模型: {sovits_choices}")
        logger.info(f"GPT 模型: {gpt_choices}")
        
        return sovits_choices, gpt_choices
        
    except Exception as e:
        logger.error(f"错误: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=422, detail=str(e))


# fast 版本推理接口：用于更快的推理管线。
@app.post("/tts_fast")
async def tts_fast_api(request: TTSFastRequest):
    """Fast TTS 推理接口，返回音频流并在响应头中带回 seed。"""
    # Fast 推理接口，支持 URL 参考音频并返回音频流
    # 响应头携带实际使用的 seed
    # fast 版本推理接口：用于更快的推理管线。
    try:
        # fast 版本推理接口，支持 URL 参考音频。
        # 检查是否是网络链接
        if request.ref_audio_path.startswith(('http://', 'https://')):
            # 若 URL 指向本机静态目录，直接映射为本地文件
            local_path = resolve_local_ref_audio(request.ref_audio_path)
            if local_path and os.path.exists(local_path):
                request.ref_audio_path = local_path
            else:
                # 外部 URL 才走网络下载
                response = requests.get(request.ref_audio_path)
                if response.status_code != 200:
                    raise ValueError(f"无法下载音频文件: {request.ref_audio_path}")

                audio_data = response.content
                # 保存音频文件
                temp_audio_path = "temp_audio.wav"
                with open(temp_audio_path, "wb") as f:
                    f.write(audio_data)
                request.ref_audio_path = temp_audio_path

        # 调用 fast 推理函数（返回采样率和PCM）。
        # inference_webui_fast.inference 会 yield (audio_result, seed)
        # audio_result 是 (sr, audio_opt)，因此需要先拆出 audio_result
        audio_result, actual_seed = next(inference_webui_fast.inference(
            text=request.text,
            text_lang=request.text_lang,
            ref_audio_path=request.ref_audio_path,
            aux_ref_audio_paths=None,  # 暂不支持多参考音频
            prompt_text=request.prompt_text,
            prompt_lang=request.prompt_lang,
            top_k=request.top_k,
            top_p=request.top_p,
            temperature=request.temperature,
            text_split_method=request.text_split_method,
            batch_size=request.batch_size,
            speed_factor=request.speed_factor,
            ref_text_free=request.ref_text_free,
            split_bucket=request.split_bucket,
            fragment_interval=request.fragment_interval,
            seed=request.seed,
            keep_random=request.keep_random,
            parallel_infer=request.parallel_infer,
            repetition_penalty=request.repetition_penalty,
            sample_steps=request.sample_steps,
            super_sampling=request.super_sampling,
        ))
        sr, audio_opt = audio_result

        # 将PCM写入内存WAV，作为流式响应返回。
        audio_bytes = io.BytesIO()
        wav.write(audio_bytes, sr, audio_opt)
        audio_bytes.seek(0)

        # 如果使用了临时文件，删除它
        if request.ref_audio_path == "temp_audio.wav":
            try:
                os.remove(request.ref_audio_path)
            except:
                pass

        return StreamingResponse(
            audio_bytes,
            media_type="audio/wav",
            headers={"X-Seed": str(actual_seed)},
        )
    except Exception as e:
        logger.error(f"错误: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=422, detail=str(e))

# =========================================================
# 参考音频管理
# =========================================================

@app.post("/upload_ref_audio")
async def upload_ref_audio(file: UploadFile = File(...), request: Request = None):
    """上传参考音频到临时目录，返回临时 URL。"""
    # 上传参考音频到临时目录并返回临时 URL
    try:
        if not file or not file.filename:
            raise ValueError("未收到音频文件")
        safe_name = os.path.basename(file.filename)
        ext = os.path.splitext(safe_name)[1] or ".wav"
        unique_name = f"{uuid.uuid4().hex}{ext}"
        save_path = os.path.join(TEMP_REF_AUDIO_DIR, unique_name)
        with open(save_path, "wb") as f:
            f.write(await file.read())
        base = str(request.base_url) if request else "http://localhost/"
        temp_url = f"{base}ref_audios_tmp/{unique_name}"
        return {"temp_url": temp_url, "name": safe_name, "temp_name": unique_name}
    except Exception as e:
        logger.error(f"上传参考音频失败: {str(e)}")
        raise HTTPException(status_code=422, detail=str(e))

@app.post("/promote_ref_audio")
async def promote_ref_audio(temp_name: str, request: Request = None):
    """将临时参考音频转存到正式目录，返回可访问 URL。"""
    # 将临时参考音频转存到正式目录并返回 URL
    try:
        if not temp_name:
            raise ValueError("temp_name is required")
        temp_path = os.path.join(TEMP_REF_AUDIO_DIR, os.path.basename(temp_name))
        if not os.path.exists(temp_path):
            raise ValueError("临时音频不存在")
        final_name = os.path.basename(temp_name)
        final_path = os.path.join(REF_AUDIO_DIR, final_name)
        shutil.move(temp_path, final_path)
        base = str(request.base_url) if request else "http://localhost/"
        url = f"{base}ref_audios/{final_name}"
        return {"url": url, "name": final_name}
    except Exception as e:
        logger.error(f"转存参考音频失败: {str(e)}")
        raise HTTPException(status_code=422, detail=str(e))


# =========================================================
# ASR（自动提取参考文本，耗时较久，需要拉取对应模型）
# =========================================================

def run_asr_with_webui_logic(input_dir, output_dir, asr_model, model_size, lang, precision):
    """复用 webui 的 ASR 调用方式执行识别任务。"""
    # 校验 ASR 配置并调用脚本执行识别
    # 返回 .list 输出路径及实际参数
    if asr_dict is None:
        raise RuntimeError("ASR 配置未加载，请确认 tools/asr/config.py 可用")
    if asr_model not in asr_dict:
        raise ValueError("ASR 模型不存在")
    model_cfg = asr_dict[asr_model]
    if model_size not in model_cfg.get("size", []):
        # 未匹配到时优先回退到 large-v3（整合包通常自带）
        model_size = "large-v3" if "large-v3" in model_cfg.get("size", []) else model_cfg.get("size", [model_size])[0]
    if lang not in model_cfg.get("lang", []):
        lang = model_cfg.get("lang", [lang])[0]
    if precision not in model_cfg.get("precision", []):
        precision = model_cfg.get("precision", [precision])[0]

    script_path = os.path.join(ASR_ROOT, "tools", "asr", model_cfg["path"])
    if not os.path.exists(script_path):
        raise FileNotFoundError(f"ASR 脚本不存在: {script_path}")

    cmd = [
        sys.executable,
        "-s",
        script_path,
        "-i",
        input_dir,
        "-o",
        output_dir,
        "-s",
        model_size,
        "-l",
        lang,
        "-p",
        precision,
    ]
    subprocess.run(cmd, check=True, cwd=ASR_ROOT)

    output_file_name = os.path.basename(input_dir)
    output_file_path = os.path.abspath(os.path.join(output_dir, f"{output_file_name}.list"))
    return output_file_path, {"model": asr_model, "size": model_size, "lang": lang, "precision": precision}


@app.post("/asr")
async def asr_api(
    files: List[UploadFile] = File(...),
    asr_model: str = Form("Faster Whisper (多语种)"),
    asr_model_size: str = Form("large-v3"),
    asr_lang: str = Form("zh"),
    asr_precision: str = Form("int8"),
):
    """ASR 接口：上传音频 -> 调用 tools/asr 脚本 -> 读取 .list 输出。"""
    # 保存上传音频并调用 ASR 脚本
    # 解析 .list 输出并清理临时目录
    # 复用 webui 的 ASR 调用逻辑：写入临时目录 -> 调用 tools/asr 脚本 -> 读取 .list 输出
    task_id = uuid.uuid4().hex
    input_dir = os.path.join(ASR_TEMP_DIR, task_id)
    output_dir = os.path.join(ASR_OUTPUT_DIR, task_id)
    os.makedirs(input_dir, exist_ok=True)
    os.makedirs(output_dir, exist_ok=True)
    try:
        if not files:
            raise ValueError("未收到音频文件")
        for f in files:
            if not f or not f.filename:
                continue
            safe_name = os.path.basename(f.filename)
            save_path = os.path.join(input_dir, safe_name)
            with open(save_path, "wb") as fp:
                fp.write(await f.read())

        output_file_path, used_args = run_asr_with_webui_logic(
            input_dir=input_dir,
            output_dir=output_dir,
            asr_model=asr_model,
            model_size=asr_model_size,
            lang=asr_lang,
            precision=asr_precision,
        )

        if not os.path.exists(output_file_path):
            raise FileNotFoundError("ASR 输出文件不存在")

        results = []
        with open(output_file_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                parts = line.split("|", 3)
                if len(parts) == 4:
                    file_path, folder_name, lang, text = parts
                else:
                    file_path, folder_name, lang, text = parts[0], "", "", line
                results.append(
                    {
                        "file_path": file_path,
                        "folder": folder_name,
                        "lang": lang,
                        "text": text,
                    }
                )

        return {"items": results, "used": used_args}
    except Exception as e:
        logger.error(f"ASR 失败: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=422, detail=str(e))
    finally:
        try:
            shutil.rmtree(input_dir, ignore_errors=True)
            shutil.rmtree(output_dir, ignore_errors=True)
        except Exception:
            pass


# =========================================================
# 权重 & 版本管理
# =========================================================

def check_current_weights():
    """检查当前使用的模型"""
    # 读取 weight.json 并打印当前模型配置
    # 读取 weight.json，输出各版本对应的 GPT/SoVITS 权重路径。
    with open("./weight.json", 'r', encoding="utf-8") as f:
        data = json.load(f)
        # 检查所有版本
        sovits_models = data["SoVITS"]
        gpt_models = data["GPT"]
        logger.info(f"SoVITS 模型: {sovits_models}")
        logger.info(f"GPT 模型: {gpt_models}")
        
        return data

def reload_inference_modules():
    """重载推理模块以应用新的版本环境变量与全局状态。"""
    # 重载推理模块以应用版本切换
    global inference_webui, inference_webui_fast
    inference_webui = importlib.reload(inference_webui)
    inference_webui_fast = importlib.reload(inference_webui_fast)

@app.post("/change_version")
async def change_version_api(request: ChangeVersionRequest):
    """切换版本并重载推理模块，确保按新版本初始化。"""
    # 切换版本并重载推理模块
    try:
        # 切换版本：更新环境变量并重载模块。
        os.environ["version"] = request.version
        reload_inference_modules()
        logger.info("当前版本已切换为: %s", request.version)
        check_current_weights()
        return {"status": "success", "version": request.version}
    except Exception as e:
        logger.error(f"错误: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=422, detail=str(e))

# =========================================================
# 启动服务
# =========================================================

# 启动服务
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=HOST, port=PORT) 
