// ═══════════════════ Albedo (基础颜色) ═══════════════════

// ═══ Albedo (基础颜色) ═══
#define ALBEDO_MAP_FROM 3  // 基础颜色贴图来源
#define ALBEDO_MAP_UV_FLIP 0  // 基础颜色UV翻转
#define ALBEDO_MAP_APPLY_SCALE 0  // 应用颜色缩放
#define ALBEDO_MAP_APPLY_DIFFUSE 1  // 应用PMX漫反射色
#define ALBEDO_MAP_APPLY_MORPH_COLOR 0  // 应用变形颜色
#define ALBEDO_MAP_FILE "albedo.png"  // 基础颜色贴图文件"
const float3 albedo = 1.0;  // 基础颜色值 (RGB)
const float2 albedoMapLoopNum = 1.0;  // 基础颜色贴图平铺次数

// ═══════════════════ SubAlbedo (次级颜色) ═══════════════════
#define ALBEDO_SUB_ENABLE 0
#define ALBEDO_SUB_MAP_FROM 0
#define ALBEDO_SUB_MAP_UV_FLIP 0
#define ALBEDO_SUB_MAP_APPLY_SCALE 0
#define ALBEDO_SUB_MAP_FILE "albedo.png"
const float3 albedoSub = 1.0;
const float2 albedoSubMapLoopNum = 1.0;

// ═══════════════════ Alpha (透明度) ═══════════════════
#define ALPHA_MAP_FROM 3
#define ALPHA_MAP_UV_FLIP 0
#define ALPHA_MAP_SWIZZLE 3
#define ALPHA_MAP_FILE "alpha.png"
const float alpha = 1.0;
const float alphaMapLoopNum = 1.0;

// ═══════════════════ Normal (法线贴图) ═══════════════════
#define NORMAL_MAP_FROM 1
#define NORMAL_MAP_TYPE 0
#define NORMAL_MAP_UV_FLIP 0
#define NORMAL_MAP_FILE "texture/accessory_Normal.png"
const float normalMapScale = 2.0;
const float normalMapLoopNum = 1.0;

// ═══════════════════ SubNormal (次级法线) ═══════════════════
#define NORMAL_SUB_MAP_FROM 0
#define NORMAL_SUB_MAP_TYPE 0
#define NORMAL_SUB_MAP_UV_FLIP 0
#define NORMAL_SUB_MAP_FILE "normal.png"
const float normalSubMapScale = 1.0;
const float normalSubMapLoopNum = 1.0;

// ═══════════════════ Smoothness (光滑度) ═══════════════════

// ═══ Smoothness (光滑度) ═══
#define SMOOTHNESS_MAP_FROM 0  // 光滑度贴图来源
#define SMOOTHNESS_MAP_TYPE 0
#define SMOOTHNESS_MAP_UV_FLIP 0
#define SMOOTHNESS_MAP_SWIZZLE 0
#define SMOOTHNESS_MAP_APPLY_SCALE 0
#define SMOOTHNESS_MAP_FILE "smoothness.png"
const float smoothness = 0.4;  // 光滑度值 (0.0-1.0)
const float smoothnessMapLoopNum = 1.0;

// ═══════════════════ Metalness (金属度) ═══════════════════

// ═══ Metalness (金属度) ═══
#define METALNESS_MAP_FROM 0  // 金属度贴图来源
#define METALNESS_MAP_UV_FLIP 0
#define METALNESS_MAP_SWIZZLE 0
#define METALNESS_MAP_APPLY_SCALE 0
#define METALNESS_MAP_FILE "metalness.png"
const float metalness = 0.0;  // 金属度值 (0.0-1.0)
const float metalnessMapLoopNum = 1.0;

// ═══════════════════ Specular (高光) ═══════════════════
#define SPECULAR_MAP_FROM 0
#define SPECULAR_MAP_TYPE 0
#define SPECULAR_MAP_UV_FLIP 0
#define SPECULAR_MAP_SWIZZLE 0
#define SPECULAR_MAP_APPLY_SCALE 0
#define SPECULAR_MAP_FILE "specular.png"
const float3 specular = 0.5;
const float2 specularMapLoopNum = 1.0;

// ═══════════════════ Occlusion (环境光遮蔽) ═══════════════════
#define OCCLUSION_MAP_FROM 0
#define OCCLUSION_MAP_TYPE 0
#define OCCLUSION_MAP_UV_FLIP 0
#define OCCLUSION_MAP_SWIZZLE 0
#define OCCLUSION_MAP_APPLY_SCALE 0
#define OCCLUSION_MAP_FILE "occlusion.png"
const float occlusion = 1.0;
const float occlusionMapLoopNum = 1.0;

// ═══════════════════ Parallax (视差贴图) ═══════════════════
#define PARALLAX_MAP_FROM 0
#define PARALLAX_MAP_TYPE 0
#define PARALLAX_MAP_UV_FLIP 0
#define PARALLAX_MAP_SWIZZLE 0
#define PARALLAX_MAP_FILE "height.png"
const float parallaxMapScale = 1.0;
const float parallaxMapLoopNum = 1.0;

// ═══════════════════ Emissive (自发光) ═══════════════════

// ═══ Emissive (自发光) ═══
#define EMISSIVE_ENABLE 0  // 启用自发光
#define EMISSIVE_MAP_FROM 0
#define EMISSIVE_MAP_UV_FLIP 0
#define EMISSIVE_MAP_APPLY_SCALE 0
#define EMISSIVE_MAP_APPLY_MORPH_COLOR 0
#define EMISSIVE_MAP_APPLY_MORPH_INTENSITY 0
#define EMISSIVE_MAP_APPLY_BLINK 0
#define EMISSIVE_MAP_FILE "emissive.png"
const float3 emissive = 1.0;  // 自发光颜色 (RGB)
const float3 emissiveBlink = 1.0;
const float emissiveIntensity = 1.0;  // 自发光强度
const float2 emissiveMapLoopNum = 1.0;

// ═══════════════════ Custom (自定义着色) ═══════════════════

// ═══ Custom (自定义着色) ═══
#define CUSTOM_ENABLE 0  // 自定义着色模型 (0=默认, 1=皮肤, 4=玻璃, 5=布料...)
#define CUSTOM_A_MAP_FROM 0
#define CUSTOM_A_MAP_UV_FLIP 0
#define CUSTOM_A_MAP_COLOR_FLIP 0
#define CUSTOM_A_MAP_SWIZZLE 0
#define CUSTOM_A_MAP_APPLY_SCALE 0
#define CUSTOM_A_MAP_FILE "custom.png"
const float customA = 0.0;
const float customAMapLoopNum = 1.0;
#define CUSTOM_B_MAP_FROM 0
#define CUSTOM_B_MAP_UV_FLIP 0
#define CUSTOM_B_MAP_COLOR_FLIP 0
#define CUSTOM_B_MAP_APPLY_SCALE 0
#define CUSTOM_B_MAP_FILE "custom.png"
const float3 customB = 0.0;
const float2 customBMapLoopNum = 1.0;

#include "material_common_2.0.fxsub"
