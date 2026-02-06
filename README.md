# GS_webui_api for GPT-Sovits-v3
GPT-Sovtis推理页面的API，提供自定义通用便携的接口，允许通过调用API获取网页端调试好的声音，避免原生API参数与网页端不同导致声音不一致

[English Documentation](#english-version)

## 创建原因
### 1. 由于原生API（api.py文件）的参数与webui不同，为了准确获取再在webUI中调试的声音，这里直接提供webUI的API调用
### 2. 直接使用gradio网页端有跨域限制，且网页端不支持传输解析网络音频，不直接返回音频，故基于网页端实现该API调用形式


## 使用方法

### 1. 将webui_api.py文件和webui_api.bat文件放在整合包的根目录下（与go-webui.bat文件同级）

### 2. 在go-webui.py文件中修改对应启动参数（如端口号，跨域设置，也可以直接使用默认）

### 3. 在根目录创建weight.json文件，并添加模型路径(初始化时使用)

### 4. 配置完成后双击webui_api.bat文件，一键启动，API的输入和返回值与gradio相同（除了获取音频方法改为返回wav）

**注意：**

- 未填写weight.json的话，程序会默认在根目录创建一个weight.json

- 注意weight.json文件的格式,程序默认使用v2版本，在使用前将训练好的模型和版本写入json文件

- 接口的实现直接导入源文件中的原生方法，没有更改原来的代码，不影响原webUI的正常使用

- 该API更新基于GPT-SoVITS-v2pro-20250604更新。

## 接口说明

### 1. 获取音频 (POST /tts)
将文本转换为语音。支持从本地路径或网络URL获取参考音频。

请求参数：
- ref_wav_path: 参考音频路径（支持本地文件路径或网络URL）
- prompt_text: 提示文本（默认为空）
- prompt_language: 提示文本语言（默认："中文"）
- text: 需要转换的文本
- text_language: 文本语言（默认："中文"）
- how_to_cut: 切分方式（默认："不切"，可根据网页端的切分方式选择）
- top_k: Top K采样参数（默认：15）
- top_p: Top P采样参数（默认：0.6）
- temperature: 温度参数（默认：0.7）
- ref_free: 是否启用无文本参考模式（默认：false，v3模型暂不支持true）
- speed: 语速（默认：1.0）
- if_freeze: 是否根据上次合成的音频调整语速和音色（默认：false）
- sample_steps: 采样步数（默认：32）
- if_sr: 是否启用超分辨率（默认：false）
- pause_second: 停顿时长（默认：0.3）

返回：
- 音频文件（WAV格式）

### 2. 获取音频-快速版 (POST /tts_fast)
使用 fast 推理管线获取音频，参数与 fast 版推理接口一致。

请求参数：
- ref_audio_path: 参考音频路径（支持本地文件路径或网络URL）
- prompt_text: 提示文本（默认：空）
- prompt_lang: 提示文本语言（默认："中文"）
- text: 需要转换的文本
- text_lang: 文本语言（默认："中文"）
- text_split_method: 切分方式（默认："不切"）
- top_k: Top K 采样参数（默认：20）
- top_p: Top P 采样参数（默认：0.6）
- temperature: 温度参数（默认：0.6）
- ref_text_free: 是否启用无文本参考模式（默认：false）
- speed_factor: 语速（默认：1.0）
- batch_size: batch size（默认：20）
- split_bucket: 是否启用分桶（默认：true）
- fragment_interval: 片段间隔（默认：0.3）
- seed: 随机种子（默认：-1）
- keep_random: 是否保持随机（默认：true）
- parallel_infer: 是否并行推理（默认：true）
- repetition_penalty: 重复惩罚（默认：1.35）

返回：
- 音频文件（WAV格式）

### 3. 切换SoVITS模型 (POST /change_sovits_weights)
切换当前使用的SoVITS模型。

请求参数：
- sovits_path: SoVITS模型路径
- prompt_language: 提示文本语言
- text_language: 文本语言

返回：
- 切换状态信息

### 4. 切换GPT模型 (POST /change_gpt_weights)
切换当前使用的GPT模型。

请求参数：
- gpt_path: GPT模型路径

返回：
- 切换状态信息

### 5. 获取可用模型列表 (POST /change_choices)
获取系统中可用的SoVITS和GPT模型列表。

返回：
- sovits_choices: 可用的SoVITS模型列表
- gpt_choices: 可用的GPT模型列表

### 6. 切换版本 (POST /change_version)
切换推理版本，并重载推理模块以应用新版本配置。

请求参数：
- version: 目标版本（例如 "v2"、"v2Pro"、"v3"、"v4" 等）

返回：
- 切换状态信息

### 7. 上传参考音频 (POST /upload_ref_audio)
上传参考音频到临时目录，返回临时 URL。

请求参数：
- file: 参考音频文件（multipart/form-data）

返回：
- temp_url: 临时访问 URL
- name: 原始文件名
- temp_name: 临时文件名

### 8. 转存参考音频 (POST /promote_ref_audio)
将临时参考音频转存到正式目录，返回可访问 URL。

请求参数：
- temp_name: 临时文件名

返回：
- url: 正式访问 URL
- name: 文件名

### 9. 语音识别 ASR (POST /asr)
上传音频并调用 ASR 脚本进行识别，返回 .list 解析结果。

请求参数：
- files: 音频文件列表（multipart/form-data）
- asr_model: ASR 模型（默认："Faster Whisper (多语种)"）
- asr_model_size: 模型大小（默认："large-v3"）
- asr_lang: 语言（默认："zh"）
- asr_precision: 精度（默认："int8"）

返回：
- items: 识别结果列表（file_path、folder、lang、text）
- used: 实际使用的参数

## 函数说明（webui_api.py）
- resolve_local_ref_audio：解析指向本机静态目录的 URL，并映射到本地路径
- validation_exception_handler：统一参数校验错误的返回格式
- tts_api：标准 TTS 推理接口，支持本地/网络参考音频并流式返回 WAV
- change_sovits_weights_api：切换 SoVITS 权重并记录前后配置
- change_gpt_weights：切换 GPT 权重并记录前后配置
- change_choices_api：刷新并返回可用模型列表
- tts_fast_api：Fast 推理接口，返回音频流并在响应头携带 seed
- upload_ref_audio：上传参考音频到临时目录并返回临时 URL
- promote_ref_audio：将临时参考音频转存到正式目录并返回 URL
- run_asr_with_webui_logic：复用 WebUI 的 ASR 调用逻辑并执行脚本
- asr_api：上传音频批量识别并解析 .list 输出
- check_current_weights：读取 weight.json 并打印当前模型配置
- reload_inference_modules：重载推理模块以应用版本切换
- change_version_api：切换版本并重载推理模块

---

# <a name="english-version"></a>GS_webui_api for GPT-Sovits-v3
An API for GPT-Sovits inference web interface, providing customizable and portable interfaces to obtain the voice output tuned through the web interface.

## Why This API
### 1. Due to parameter differences in the native API (api.py), after tuning in WebUI, using the same model with the native API may require parameter readjustment. Using this WebUI API allows direct access to the tuned voice output.
### 2. Gradio's interface definitions are different and cross-origin settings are complicated
### 3. Gradio's API doesn't return audio directly and doesn't support network paths for audio transmission

## Setup Instructions

### 1. Place webui_api.py and webui_api.bat files in the GPT-Sovits root directory (same level as go-webui.bat)

### 2. Modify the startup parameters in go-webui.py (such as port number, CORS settings, or use defaults)

### 3. Create a weight.json file in the root directory and add model paths (used during initialization)

### 4. After configuration, double-click webui_api.bat for one-click startup. API inputs and returns are the same as gradio (except audio retrieval returns WAV)

**Notes:**

- Create weight.json in the root directory and add model paths (used during initialization). Note: There's another weight.json file in the GPT_Sovits folder - don't confuse them. The root directory one is API-specific, while the one in GPT_Sovits is for the web interface.

- If weight.json doesn't exist, it will be created with default model paths in v1 version

- Check the weight.json format and add your model paths to v2 version. Currently, both v2 and v3 custom models are placed in v2 version, only v3 base models are in v3 version. Each version can only have one model.

- The API implementation only calls native methods from "GPT-SoVITS-v3lora-20250228\GPT_SoVITS\inference_webui.py" without modifying the original code, so it won't affect normal web interface usage

- This API implementation is based on v3 version and parameters are not compatible with v2 and v1 versions

## API Documentation

### 1. Generate Audio (POST /tts)
Convert text to speech. Supports reference audio from local path or network URL.

Request Parameters:
- ref_wav_path: Reference audio path (supports local file path or URL)
- prompt_text: Prompt text (default: empty)
- prompt_language: Prompt text language (default: "Chinese")
- text: Text to convert
- text_language: Text language (default: "Chinese")
- how_to_cut: Cutting method (default: "不切", can choose from web interface options)
- top_k: Top K sampling parameter (default: 15)
- top_p: Top P sampling parameter (default: 0.6)
- temperature: Temperature parameter (default: 0.7)
- ref_free: Enable text-free reference mode (default: false, not supported in v3 models)
- speed: Speech speed (default: 1.0)
- if_freeze: Adjust speed and timbre based on last synthesis (default: false)
- sample_steps: Sampling steps (default: 32)
- if_sr: Enable super resolution (default: false)
- pause_second: Pause duration (default: 0.3)

Returns:
- Audio file (WAV format)

### 2. Generate Audio - Fast (POST /tts_fast)
Use the fast inference pipeline to generate audio.

Request Parameters:
- ref_audio_path: Reference audio path (supports local file path or URL)
- prompt_text: Prompt text (default: empty)
- prompt_lang: Prompt language (default: "Chinese")
- text: Text to convert
- text_lang: Text language (default: "Chinese")
- text_split_method: Split method (default: "ä¸åˆ‡")
- top_k: Top K sampling parameter (default: 20)
- top_p: Top P sampling parameter (default: 0.6)
- temperature: Temperature parameter (default: 0.6)
- ref_text_free: Enable text-free reference mode (default: false)
- speed_factor: Speech speed (default: 1.0)
- batch_size: Batch size (default: 20)
- split_bucket: Enable bucket splitting (default: true)
- fragment_interval: Fragment interval (default: 0.3)
- seed: Random seed (default: -1)
- keep_random: Keep randomness (default: true)
- parallel_infer: Parallel inference (default: true)
- repetition_penalty: Repetition penalty (default: 1.35)

Returns:
- Audio file (WAV format)

### 3. Switch SoVITS Model (POST /change_sovits_weights)
Switch the current SoVITS model.

Request Parameters:
- sovits_path: SoVITS model path
- prompt_language: Prompt text language
- text_language: Text language

Returns:
- Switch status information

### 4. Switch GPT Model (POST /change_gpt_weights)
Switch the current GPT model.

Request Parameters:
- gpt_path: GPT model path

Returns:
- Switch status information

### 5. Get Available Models (POST /change_choices)
Get list of available SoVITS and GPT models in the system.

Returns:
- sovits_choices: Available SoVITS models list
- gpt_choices: Available GPT models list

### 6. Switch Version (POST /change_version)
Switch inference version and reload inference modules.

Request Parameters:
- version: Target version (e.g. "v2", "v2Pro", "v3", "v4")

Returns:
- Switch status information

### 7. Upload Reference Audio (POST /upload_ref_audio)
Upload a reference audio file to the temp directory and return a temp URL.

Request Parameters:
- file: Audio file (multipart/form-data)

Returns:
- temp_url: Temporary access URL
- name: Original file name
- temp_name: Temporary file name

### 8. Promote Reference Audio (POST /promote_ref_audio)
Move a temporary reference audio file to the final directory and return a URL.

Request Parameters:
- temp_name: Temporary file name

Returns:
- url: Final access URL
- name: File name

### 9. ASR (POST /asr)
Upload audio and run ASR, returning parsed .list results.

Request Parameters:
- files: Audio file list (multipart/form-data)
- asr_model: ASR model (default: "Faster Whisper (Multilingual)")
- asr_model_size: Model size (default: "large-v3")
- asr_lang: Language (default: "zh")
- asr_precision: Precision (default: "int8")

Returns:
- items: Recognition results (file_path, folder, lang, text)
- used: Actual parameters used







