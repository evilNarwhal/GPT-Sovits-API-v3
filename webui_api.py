from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from urllib.parse import urlparse
import numpy as np
import io
import scipy.io.wavfile as wav
import traceback
import logging
import os
import requests
import json
import importlib
# 定义端口
PORT = 9876
# 定义主机
HOST = "0.0.0.0"
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
    ref_audio_path: str
    prompt_text: str
    prompt_lang: str = "中文"
    text: str
    text_lang: str = "中文"
    text_split_method: str = "不切"
    top_k: int = 20
    top_p: float = 0.6
    temperature: float = 0.6
    ref_text_free: bool = False
    speed_factor: float = 1.0
    batch_size: int = 20
    split_bucket: bool = True
    fragment_interval: float = 0.3
    seed: int = -1
    keep_random: bool = True
    parallel_infer: bool = True
    repetition_penalty: float = 1.35

# 设置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(message)s'  # 只显示消息内容，不显示其他信息
)
logger = logging.getLogger("uvicorn")



# 导入源码并执行初始化
from GPT_SoVITS import inference_webui
from GPT_SoVITS import inference_webui_fast

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

# 添加全局异常处理器
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    # 统一校验错误返回结构，方便前端/调用方处理。
    logger.error("请求参数验证错误:")
    logger.error(str(exc))
    return JSONResponse(
        status_code=422,
        content={"detail": f"参数验证错误: {str(exc)}"}
    )


@app.post("/tts")
async def tts_api(request: TTSRequest):
    # 标准推理接口：支持本地路径或URL参考音频。
    try:
        # 支持 ref_wav_path 为 URL：先下载到临时文件，再走推理。
        # 检查是否是网络链接
        if request.ref_wav_path.startswith(('http://', 'https://')):
            # 下载音频文件
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
        if request.ref_wav_path == "temp_ref.wav":
            try:
                os.remove(request.ref_wav_path)
            except:
                pass
        
        return StreamingResponse(audio_bytes, media_type="audio/wav")
    except Exception as e:
        logger.error(f"错误: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=422, detail=str(e)) 

@app.post("/change_sovits_weights")
async def change_sovits_weights_api(request: ChangeSovitsRequest):
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

@app.post("/tts_fast")
async def tts_fast_api(request: TTSFastRequest):
    # fast 版本推理接口：用于更快的推理管线。
    try:
        # fast 版本推理接口，支持 URL 参考音频。
        # 检查是否是网络链接
        if request.ref_audio_path.startswith(('http://', 'https://')):
            # 下载音频文件
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
        sr, audio_opt = next(inference_webui_fast.inference(
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
            repetition_penalty=request.repetition_penalty
        ))

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

        return StreamingResponse(audio_bytes, media_type="audio/wav")
    except Exception as e:
        logger.error(f"错误: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=422, detail=str(e))

def check_current_weights():
    """检查当前使用的模型"""
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
    # 重新加载推理模块以应用新的版本环境变量与全局状态。
    global inference_webui, inference_webui_fast
    inference_webui = importlib.reload(inference_webui)
    inference_webui_fast = importlib.reload(inference_webui_fast)

@app.post("/change_version")
async def change_version_api(request: ChangeVersionRequest):
    # 切换版本并重载推理模块，确保按新版本初始化。
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

# 启动服务
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=HOST, port=PORT) 
