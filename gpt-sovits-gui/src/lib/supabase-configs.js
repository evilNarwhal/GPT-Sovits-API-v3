import { supabase } from "./supabase";

// 统一清洗名称，避免空格或空字符串进入数据库
const safeName = (value) => (value || "").trim();

export async function loadSupabaseConfigs() {
  // 读取 configs，并联表拿到人物/情感名称用于回填界面
  const { data, error } = await supabase
    .from("configs")
    .select(
      `
      id,
      config_name,
      params,
      ref_audio_url,
      characters:character_id ( id, name ),
      emotions:emotion_id ( id, name )
    `
    )
    .order("created_at", { ascending: false });

  if (error) throw error;
  // 将 DB 字段转换为前端需要的字段结构
  return (data || []).map((item) => ({
    id: item.id,
    name: item.config_name || "",
    characterName: item.characters?.name || "",
    refEmotion: item.emotions?.name || "",
    refAudioUrl: item.ref_audio_url || "",
    ...(item.params || {}),
  }));
}

// 读取人物列表，用于下拉框展示
export async function loadSupabaseCharacters() {
  const { data, error } = await supabase
    .from("characters")
    .select("id,name")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map((item) => ({
    id: item.id,
    name: item.name || "",
  }));
}

// 删除配置（根据唯一 id）
export async function deleteSupabaseConfig(id) {
  if (!id) throw new Error("config id is required");
  const { error } = await supabase.from("configs").delete().eq("id", id);
  if (error) throw error;
  return true;
}

async function upsertCharacter(name) {
  // 如果人物为空，直接返回 null，表示不绑定人物
  const cleaned = safeName(name);
  if (!cleaned) return null;
  // upsert：存在则返回已存在记录，不存在则创建
  const { data, error } = await supabase
    .from("characters")
    .upsert({ name: cleaned }, { onConflict: "name" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function upsertEmotion(characterId, name) {
  // 情感必须依赖人物：没有人物 id 则不创建
  const cleaned = safeName(name);
  if (!characterId || !cleaned) return null;
  // 同一人物下情感名称唯一
  const { data, error } = await supabase
    .from("emotions")
    .upsert(
      { character_id: characterId, name: cleaned },
      { onConflict: "character_id,name" }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function saveSupabaseConfigs(configs) {
  // 逐条保存配置：先保证人物/情感存在，再写入 configs
  const list = Array.isArray(configs) ? configs : [];
  for (const config of list) {
    // 1) 人物不存在则创建/更新，拿到人物 id
    const character = await upsertCharacter(config.characterName);
    // 2) 情感不存在则创建/更新，绑定人物 id
    const emotion = await upsertEmotion(character?.id, config.refEmotion);
    // 3) 组装 params：移除不应该存入 params 的字段
    const {
      name,
      id,
      characterName,
      refEmotion,
      refAudioUrl,
      text,
      textLang,
      textSplitMethod,
      ...rest
    } = config || {};
    const params = { ...rest };

    // 4) 写入 configs（含人物/情感 id 和参考音频 URL）
    const { error } = await supabase.from("configs").upsert(
      {
        config_name: safeName(name),
        character_id: character?.id || null,
        emotion_id: emotion?.id || null,
        ref_audio_url: refAudioUrl || "",
        params,
      },
      { onConflict: "config_name,character_id,emotion_id" }
    );
    if (error) throw error;
  }
  return true;
}
