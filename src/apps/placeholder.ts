/**
 * placeholder.ts — 同构占位页
 *
 * 原工程里 6 个 app（相册/商店/通知/视频/电话/bilibili）本来就是 213 块的
 * 同构占位壳。这里保持同样的诚实度：给出应用定位、原工程规模与后续计划，
 * 不做假界面。真功能 app（计算器/时钟/个性化/音乐）另有实现。
 */
import { el } from '../core/dom';
import type { AppModule } from '../core/registry';
import './placeholder.css';

export interface PlaceholderSpec {
  title: string;
  icon: string;
  desc: string;
  /** 原工程的积木规模（用于标注移植进度，取自 project.json） */
  blocks?: number;
  features: string[];
}

export function createPlaceholder(spec: PlaceholderSpec): AppModule {
  return {
    mount(root) {
      const wrap = el('div', { class: 'ph' });
      wrap.innerHTML =
        `<div class="ph__hero"><span class="ph__icon"><svg><use href="#ic-${spec.icon}"/></svg></span>` +
        `<h1 class="ph__title">${spec.title}</h1>` +
        `<p class="ph__desc">${spec.desc}</p></div>` +
        '<div class="ph__card">' +
        '<p class="ph__card-title">计划中的能力</p>' +
        '<ul class="ph__list">' +
        spec.features.map((f) => `<li>${f}</li>`).join('') +
        '</ul></div>' +
        '<p class="ph__note">' +
        (spec.blocks
          ? `原工程以 ${spec.blocks} 块积木实现的同构占位页；v2 保留占位语义，等真功能立项后按 AOSP 对齐重做。`
          : '该页面为占位，等真功能立项后按 AOSP 对齐重做。') +
        '</p>';
      root.append(wrap);
      return () => wrap.remove();
    },
  };
}
