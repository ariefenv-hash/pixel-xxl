#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
gen-bridge-catalog.py — 生成 shell-src/src/bridge/catalog.ts（桥接目录，单一真源）

职责（#23 立项 · 桥接协议 v1）：
  从 project.json（零构建忠实态，机器可读真源）提取：
    1. 全部舞台（全局）变量：名称 / 初值 / 引用数 / 写入数（引用数=0 即「声明但未使用」
       ——用户观察的「空壳」的第一层机器实证，如 控制中心打开？ 等五个控制中心变量）；
    2. 全部广播：名称 / 发送方 target 列表 / 接收方 target 列表
       （QS 磁贴等 DOM 壳层只允许复用工程既有事件链，不发明新语义——
       实证链：个性化APP 写 壁纸编号/亮度模式 → SEND 广播「壁纸」 → zz 收到 →
       SEND 广播「取色」 → 全 UI 重取色）；
  输出 TypeScript 常量模块，供 shell-src 的 VMBridge 与磁贴绑定消费。

纪律：
  - 本脚本可重复执行（幂等）；catalog.ts 顶部带 AUTO-GENERATED 横幅，禁止手改；
  - 输出含 project.json sha256 前 16 位指纹，运行时可对账（版本漂移即发现）；
  - 只读 project.json，不触碰任何运行时文件（core/app 逐字节红线无关）。

用法：
  python3 scripts/gen-bridge-catalog.py            # 写 shell-src/src/bridge/catalog.ts
  python3 scripts/gen-bridge-catalog.py --check    # 只校验已生成文件是否与真源一致（CI 用）
"""

import hashlib
import json
import os
import sys

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJECT_JSON = os.path.join(REPO_ROOT, "project.json")
OUT_PATH = os.path.join(REPO_ROOT, "shell-src", "src", "bridge", "catalog.ts")

# 引用变量的全部 opcode（sb3 序列化格式；fields.VARIABLE = [name, id]）
WRITE_OPS = {"data_setvariableto", "data_changevariableby"}
REF_OPS = WRITE_OPS | {"data_variable", "data_showvariable", "data_hidevariable"}


def walk_blocks(blocks):
    """遍历一个 target 的 blocks 字典，产出 (opcode, block_dict)。压缩层（list 形态）
    为 sb3 的脚本压缩存储，官方 loader 语义等价——本工程 project.json 为未压缩明文，
    此处按 dict 形态处理即可，list 形态跳过（与 scratch-vm deserialize 行为一致）。"""
    for blk in blocks.values():
        if isinstance(blk, dict):
            yield blk.get("opcode", ""), blk


def variable_usage(pj):
    """统计舞台变量 id 在全部 target blocks 中的引用/写入次数。"""
    refs, writes = {}, {}
    for t in pj["targets"]:
        for op, blk in walk_blocks(t["blocks"]):
            if op not in REF_OPS:
                continue
            f = blk.get("fields", {}).get("VARIABLE")
            if not f:
                continue
            vid = f[1]
            refs[vid] = refs.get(vid, 0) + 1
            if op in WRITE_OPS:
                writes[vid] = writes.get(vid, 0) + 1
    return refs, writes


def broadcast_name(v):
    """广播表值兼容两种形态：Scratch2 旧格式字符串 "name" / sb3 数组 ["name"]。
    本工程 project.json 为旧格式（TurboWarp 兼容装载）。"""
    return v if isinstance(v, str) else (v[0] if isinstance(v, list) and v else "")


def broadcast_graph(pj):
    """广播图：{name: {"senders": [...], "receivers": [...]}}（target 名保序去重）。"""
    stage = pj["targets"][0]
    bid2name = {bid: broadcast_name(v) for bid, v in stage["broadcasts"].items()}
    graph = {}
    for name in bid2name.values():
        if name:
            graph[name] = {"senders": [], "receivers": []}
    for t in pj["targets"]:
        for op, blk in walk_blocks(t["blocks"]):
            if op in ("event_broadcast", "event_broadcastandwait"):
                inp = blk.get("inputs", {}).get("BROADCAST_INPUT")
                # BROADCAST_INPUT = [1, [11, name, id]]（sb3 广播输入形态）
                if inp and isinstance(inp[1], list) and len(inp[1]) > 1 and inp[1][0] == 11:
                    # id 为真源（name 字段可能是陈旧缓存），查不到再回退 name
                    name = inp[1][1] or bid2name.get(inp[1][2], "")
                    if name and t["name"] not in graph[name]["senders"]:
                        graph[name]["senders"].append(t["name"])
            elif op == "event_whenbroadcastreceived":
                f = blk.get("fields", {}).get("BROADCAST_OPTION")
                if f:
                    name = f[0] or bid2name.get(f[1], "")
                    if name and t["name"] not in graph.setdefault(name, {"senders": [], "receivers": []})["receivers"]:
                        graph[name]["receivers"].append(t["name"])
    return graph


def fmt_value(v):
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, str):
        return json.dumps(v, ensure_ascii=False)
    return json.dumps(v)


def build_ts(pj, sha16):
    stage = pj["targets"][0]
    refs, writes = variable_usage(pj)
    graph = broadcast_graph(pj)

    var_lines = []
    for vid, v in sorted(stage["variables"].items(), key=lambda kv: (-refs.get(kv[0], 0), kv[1][0])):
        name, initial = v[0], v[1]
        r, w = refs.get(vid, 0), writes.get(vid, 0)
        note = "  // 空壳：声明但无脚本引用" if r == 0 else ""
        var_lines.append(
            '  { name: %s, initial: %s, refs: %d, writes: %d },%s'
            % (json.dumps(name, ensure_ascii=False), fmt_value(initial), r, w, note)
        )

    bc_lines = []
    for bid, v in stage["broadcasts"].items():
        name = broadcast_name(v)
        g = graph.get(name) or {"senders": [], "receivers": []}
        bc_lines.append(
            "  { name: %s, senders: [%s], receivers: [%s] },"
            % (
                json.dumps(name, ensure_ascii=False),
                ", ".join(json.dumps(s, ensure_ascii=False) for s in g["senders"]),
                ", ".join(json.dumps(s, ensure_ascii=False) for s in g["receivers"]),
            )
        )

    unused = sum(1 for vid, v in stage["variables"].items() if refs.get(vid, 0) == 0)

    return """/*! AUTO-GENERATED by scripts/gen-bridge-catalog.py —— 禁止手改；重生成：
 *      python3 scripts/gen-bridge-catalog.py
 * 真源：/project.json（零构建忠实态，sha256 前 16 位 = %s）
 * 口径：
 *   - STAGE_VARIABLES = 舞台（全局）变量全量，refs/writes 为 sb3 blocks 图中
 *     引用/写入次数（按变量 id 精确统计，跨全部 target）。refs=0 即「声明但
 *     未使用」＝用户观察「空壳」的第一层机器实证（控制中心五变量即属此类，
 *     DOM 壳层不得对空壳变量发明语义——只读展示或留白，见 docs/SHELL.md §5）。
 *   - BROADCASTS = 广播全量 + 发送/接收 target 图（QS 磁贴只允许复用工程
 *     既有事件链：写变量 → 广播「壁纸」→ zz 自转「取色」，不发明新语义）。
 */
// biome-ignore-all: generated file

export interface BridgeVar {
  /** 变量名（工程内真名，桥接按名寻址，与 v1.06 readVar 先例同口径） */
  readonly name: string;
  /** project.json 初始值（原始类型：string | number | boolean） */
  readonly initial: string | number | boolean;
  /** blocks 图引用次数（0 = 空壳变量） */
  readonly refs: number;
  /** blocks 图写入次数（data_setvariableto / data_changevariableby） */
  readonly writes: number;
}

export interface BridgeBroadcast {
  readonly name: string;
  /** 发送方 target 名列表（event_broadcast / event_broadcastandwait） */
  readonly senders: readonly string[];
  /** 接收方 target 名列表（event_whenbroadcastreceived 帽子） */
  readonly receivers: readonly string[];
}

/** 真源指纹：project.json sha256 前 16 位（VMBridge.attach 时可对账） */
export const PROJECT_SHA256_16 = %s as const;

export const STAGE_VARIABLES: readonly BridgeVar[] = [
%s
];

export const STAGE_VARIABLE_COUNT = %d as const;
export const STAGE_VARIABLE_UNUSED_COUNT = %d as const;

/** 按名索引（桥接主寻址方式；O(1)，运行时零线性扫描） */
export const STAGE_VARIABLE_MAP: ReadonlyMap<string, BridgeVar> =
  new Map(STAGE_VARIABLES.map((v) => [v.name, v]));

export const BROADCASTS: readonly BridgeBroadcast[] = [
%s
];

export const BROADCAST_MAP: ReadonlyMap<string, BridgeBroadcast> =
  new Map(BROADCASTS.map((b) => [b.name, b]));
""" % (
        sha16,
        json.dumps(sha16, ensure_ascii=False),
        "\n".join(var_lines),
        len(stage["variables"]),
        unused,
        "\n".join(bc_lines),
    )


def main():
    with open(PROJECT_JSON, "rb") as f:
        raw = f.read()
    sha16 = hashlib.sha256(raw).hexdigest()[:16]
    pj = json.loads(raw.decode("utf-8"))
    ts = build_ts(pj, sha16)
    if "--check" in sys.argv:
        with open(OUT_PATH, "r", encoding="utf-8") as f:
            current = f.read()
        if current != ts:
            print("MISMATCH: catalog.ts 与 project.json 真源不一致，请重跑生成器", file=sys.stderr)
            sys.exit(1)
        print("OK: catalog.ts 与真源一致（sha16=%s）" % sha16)
        return
    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        f.write(ts)
    stage = pj["targets"][0]
    refs, _ = variable_usage(pj)
    unused = sum(1 for vid in stage["variables"] if refs.get(vid, 0) == 0)
    print(
        "WROTE %s（%d 变量 / %d 空壳 / %d 广播，sha16=%s）"
        % (os.path.relpath(OUT_PATH, REPO_ROOT), len(stage["variables"]), unused, len(stage["broadcasts"]), sha16)
    )


if __name__ == "__main__":
    main()
