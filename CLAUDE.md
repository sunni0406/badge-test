# NYAFF Badge Generator

## 目标
批量生成 NYAFF 活动名牌。
输入：CSV 嘉宾名单 + 照片文件夹
输出：印刷级 PNG，每张独立文件

## 印刷规格
- 尺寸：4.09" × 5.65" @ 300dpi
- 像素：1227 × 1695 px
- pixelRatio: 3（Konva 导出用）

## 技术栈
- React + Vite
- Konva.js（Canvas 渲染，禁止用 HTML/CSS 生成名牌）
- 导出：stage.toDataURL()

## 文件位置
- 背景图：public/assets/images/
- 字体：public/assets/fonts/
- 模板配置：src/templates/

## 动态字段（每位嘉宾不同）
- NAME：嘉宾姓名，字号自适应（名字有长有短）
- ROLE：职位/角色，红色
- FILM_TITLE：片名，红色斜体
- PHOTO：头像，正方形裁切

## 固定元素
- 背景图（上半部分）：直接用 PNG
- 年份"2026"竖排：固定
- 品牌色：红色 #CC0000

## 布局规则
- 名字过长时自动换行，不得溢出边界
- 所有边距跟随品牌规范
- 字体从 public/assets/fonts/ 加载
