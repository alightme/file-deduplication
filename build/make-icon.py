# -*- coding: utf-8 -*-
# 应用图标生成脚本：绘制「文件去重」主题图标并输出多尺寸资源。
# 执行方式：使用带 Pillow 的 Python 运行本脚本（系统内置运行环境已包含 Pillow）。
# 输出文件：
#   build/icon.png —— 1024x1024 PNG 母版（预览 / 文档用）；
#   build/icon.ico —— 含 256/128/64/48/32/24/16 多尺寸的 Windows 图标。
# 设计说明：
#   - 蓝色渐变圆角方块作为品牌底色；
#   - 两张白色文档页前后错位叠放（后页半透明）表示「重复文件」；
#   - 右下角绿色圆形对勾徽章表示「保留 / 核对通过」。
# 绘制方法：在 4096x4096 画布绘制（等效超采样抗锯齿），再降采样到各目标尺寸。
# 注意：半透明元素先画到独立图层，再用 alpha_composite 合成，保证与底色正确混合。
import os
from PIL import Image, ImageDraw

# 画布边长：超采样基准，越大抗锯齿效果越好。
S = 4096

# 品牌渐变底色：顶部 / 底部 RGB。
TOP_COLOR = (79, 132, 245)    # #4F84F5
BOTTOM_COLOR = (29, 78, 216)  # #1D4ED8

# 辅助函数：把画布边长比例换算为像素整数。
def P(x):
    return int(round(x * S))

# 绘制垂直渐变底色：先生成 1xS 渐变色带，再放大为 SxS（避免逐像素循环）。
def make_gradient():
    grad = Image.new('RGBA', (1, S))
    for y in range(S):
        t = y / (S - 1)
        color = tuple(int(TOP_COLOR[i] + (BOTTOM_COLOR[i] - TOP_COLOR[i]) * t) for i in range(3)) + (255,)
        grad.putpixel((0, y), color)
    return grad.resize((S, S), Image.BILINEAR)

# 初始化透明画布，并叠加圆角渐变底色：圆角内不透明，圆角外透明。
img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
mask = Image.new('L', (S, S), 0)
ImageDraw.Draw(mask).rounded_rectangle(
    [P(0.06), P(0.06), P(0.94), P(0.94)], radius=P(0.22), fill=255)
img.paste(make_gradient(), (0, 0), mask)

# 后页文档：白色 150/255 半透明，向右下错位露出右/下边缘，表现「重复文件」。
# 先画到独立透明图层，再合成到底图，确保与蓝色渐变正确混合。
back_layer = Image.new('RGBA', (S, S), (0, 0, 0, 0))
ImageDraw.Draw(back_layer).rounded_rectangle(
    [P(0.325), P(0.265), P(0.705), P(0.865)], radius=P(0.05), fill=(255, 255, 255, 150))
img.alpha_composite(back_layer)

d = ImageDraw.Draw(img)

# 前页文档：纯白，叠在后页之上。
d.rounded_rectangle([P(0.28), P(0.22), P(0.66), P(0.82)], radius=P(0.05), fill=(255, 255, 255, 255))

# 前页正文占位线条：左对齐 4 条浅灰圆角线（模拟文档内容）。
line_x0 = P(0.355)
line_h = P(0.024)
for yc, w in [(0.33, 0.24), (0.42, 0.21), (0.51, 0.17), (0.60, 0.11)]:
    d.rounded_rectangle(
        [line_x0, P(yc - 0.012), line_x0 + P(w), P(yc + 0.012)],
        radius=line_h // 2, fill=(178, 190, 208, 255))

# 绿色对勾徽章：位于前页右下角，白勾表示「保留 / 核对通过」。
cx, cy, R = P(0.685), P(0.72), P(0.095)
d.ellipse([cx - R, cy - R, cx + R, cy + R], fill=(34, 197, 94, 255))

# 白勾三段端点坐标（A 左低 → B 中高 → C 右低）。
A = (cx - int(0.34 * R), cy + int(0.14 * R))
B = (cx - int(0.02 * R), cy - int(0.18 * R))
C = (cx + int(0.34 * R), cy + int(0.14 * R))
w = max(1, int(0.24 * R))
d.line([A, B], fill=(255, 255, 255, 255), width=w)
d.line([B, C], fill=(255, 255, 255, 255), width=w)
# 用端点小圆把勾的线帽补圆，视觉更顺滑。
for pt in (A, B, C):
    r = w // 2
    d.ellipse([pt[0] - r, pt[1] - r, pt[0] + r, pt[1] + r], fill=(255, 255, 255, 255))

# 输出目录：脚本所在目录 build/。
out_dir = os.path.dirname(os.path.abspath(__file__))

# PNG 母版：1024x1024。
img.resize((1024, 1024), Image.LANCZOS).save(os.path.join(out_dir, 'icon.png'))

# Windows 图标：以 256x256 为基准，PIL 自动降采样生成各尺寸帧。
ico_sizes = [(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (24, 24), (16, 16)]
img.resize((256, 256), Image.LANCZOS).save(os.path.join(out_dir, 'icon.ico'), sizes=ico_sizes)

print('icon generated ->', out_dir)