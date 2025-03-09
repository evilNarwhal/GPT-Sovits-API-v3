# GS_webui_api for GPT-Sovits-v3
GPT-Sovtis推理页面的API，提供自定义通用便携的接口，允许通过调用API获取网页调试好的声音
## 创建原因
### 1. 由于原生API（api.py文件）的参数不同，在WebUI中调试完成后，使用相同的模型调用原生API可能需要重新调整原API的参数，而直接调用webUI的API则能直接获取到调试后的声音
### 2. 由于gradio的限制，接口定义不同，且跨域设置较为麻烦
### 3. gradio的api并不直接返回音频，且不支持传输音频的网络路径

## 使用方法

### 1. 将webui_api.py文件和webui_api.bat文件放在GPT-Sovits的根目录下（与go-webui.bat文件同级）

### 2. 在go-webui.py文件中修改对应启动参数（如端口号，跨域设置，也可以直接使用默认）

### 3. 在根目录创建weight.json文件，并添加模型路径(初始化时使用)

### 4. 配置完成后双击webui_api.bat文件，一键启动，API的输入和返回值与gradio相同（除了获取音频方法改为返回wav）


** 注意：**

- 在根目录创建weight.json文件，并添加模型路径(初始化时使用)，注意：GPT_Sovits文件夹中也有一个weight.json文件，这里要区分，根目录的是API专用的，GPT_Sovits文件夹中的是网页端自带的

- 如果没有weight.json文件，则默认创建并在v1版本中添加默认模型路径

- 观看weight.json文件的格式，并根据格式将你的模型路径添加到v2版本，因为当前v2,v3自定义模型其实都是放在v2版本中，只有v3的底模是放在v3版本中，一个版本只能有一个模型

- 接口的实现只调用了"GPT-SoVITS-v3lora-20250228\GPT_SoVITS\inference_webui.py"中的原生方法，没有更改原本的代码，不会影响网页端的正常使用

- 该API的实现是基于v3版本，参数未兼容v2版本和v1版本

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

### 2. 切换SoVITS模型 (POST /change_sovits_weights)
切换当前使用的SoVITS模型。

请求参数：
- sovits_path: SoVITS模型路径
- prompt_language: 提示文本语言
- text_language: 文本语言

返回：
- 切换状态信息

### 3. 切换GPT模型 (POST /change_gpt_weights)
切换当前使用的GPT模型。

请求参数：
- gpt_path: GPT模型路径

返回：
- 切换状态信息

### 4. 获取可用模型列表 (POST /change_choices)
获取系统中可用的SoVITS和GPT模型列表。

返回：
- sovits_choices: 可用的SoVITS模型列表
- gpt_choices: 可用的GPT模型列表







