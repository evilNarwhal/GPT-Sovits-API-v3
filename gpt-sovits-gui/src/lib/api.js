import axios from "axios";

export const DEFAULT_API_PORT = 9876;

const api = axios.create({
  baseURL: `http://localhost:${DEFAULT_API_PORT}`,
  timeout: 60000,
});

export function setApiBaseUrl(deployUrl, port = DEFAULT_API_PORT) {
  if (!deployUrl) return;
  const normalized = deployUrl.replace(/\/$/, "");
  const hasPort = /:\d+$/.test(normalized);
  api.defaults.baseURL = hasPort ? normalized : `${normalized}:${port}`;
}

export async function changeSovitsWeights(payload) {
  const { data } = await api.post("/change_sovits_weights", payload);
  return data;
}

export async function changeGptWeights(payload) {
  const { data } = await api.post("/change_gpt_weights", payload);
  return data;
}

export async function changeChoices() {
  const { data } = await api.post("/change_choices");
  // backend returns [sovitsChoices, gptChoices]
  return data;
}

export async function tts(payload) {
  // streaming wav; return an object URL for playback
  const res = await api.post("/tts", payload, { responseType: "arraybuffer" });
  const blob = new Blob([res.data], { type: "audio/wav" });
  const url = URL.createObjectURL(blob);
  return { url, blob };
}

export async function ttsFast(payload) {
  const res = await api.post("/tts_fast", payload, { responseType: "arraybuffer" });
  const blob = new Blob([res.data], { type: "audio/wav" });
  const url = URL.createObjectURL(blob);
  const seedHeader = res.headers?.["x-seed"];
  const seed = seedHeader !== undefined ? Number(seedHeader) : null;
  return { url, blob, seed };
}

export async function uploadRefAudio(file) {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post("/upload_ref_audio", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function promoteRefAudio(tempName) {
  const { data } = await api.post("/promote_ref_audio", null, {
    params: { temp_name: tempName },
  });
  return data;
}

export async function asrRecognize(files, options = {}) {
  const form = new FormData();
  const fileList = Array.isArray(files) ? files : [files];
  fileList.filter(Boolean).forEach((file) => form.append("files", file));
  if (options.asrModel) form.append("asr_model", options.asrModel);
  if (options.asrModelSize) form.append("asr_model_size", options.asrModelSize);
  if (options.asrLang) form.append("asr_lang", options.asrLang);
  if (options.asrPrecision) form.append("asr_precision", options.asrPrecision);
  const { data } = await api.post("/asr", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}


export async function changeVersion(payload) {
  const { data } = await api.post("/change_version", payload);
  return data;
}
