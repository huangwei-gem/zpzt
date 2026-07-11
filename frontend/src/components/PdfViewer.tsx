import { useEffect, useRef, useState } from 'react';
import { Spin } from 'antd';

interface PdfViewerProps {
  pdfUrl: string;
}

export default function PdfViewer({ pdfUrl }: PdfViewerProps) {
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');

  useEffect(() => {
    let cancelled = false;
    const canvasNodes: HTMLCanvasElement[] = [];

    async function init() {
      try {
        // 动态加载 PDF.js
        const pdfjsLib: any = await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.min.js';
          script.onload = () => resolve((window as any).pdfjsLib);
          script.onerror = () => reject(new Error('无法加载 PDF.js 库'));
          document.head.appendChild(script);
        });

        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
        if (cancelled) return;

        const resp = await fetch(pdfUrl);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const arrayBuffer = await resp.arrayBuffer();
        if (cancelled) return;

        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        if (cancelled) return;

        const total = pdf.numPages;
        setProgress(`共 ${total} 页，正在渲染...`);

        // 计算缩放
        const containerWidth = canvasContainerRef.current?.clientWidth || 800;
        const firstPage = await pdf.getPage(1);
        const vp = firstPage.getViewport({ scale: 1 });
        const scale = Math.min(containerWidth / vp.width, 2);
        firstPage.cleanup();

        const container = canvasContainerRef.current;
        if (!container || cancelled) return;

        // 清空之前残留的画布（保留容器本身）
        container.innerHTML = '';

        // 并发渲染所有页面
        const pageNums = Array.from({ length: total }, (_, i) => i + 1);
        let completed = 0;

        async function renderOne(pageNum: number) {
          if (cancelled) return;
          const page = await pdf.getPage(pageNum);
          const scaledVp = page.getViewport({ scale });

          // 页面包裹 div（模拟纸张效果）
          const wrapper = document.createElement('div');
          wrapper.style.cssText = `
            margin: 8px auto;
            max-width: 100%;
            box-shadow: 0 2px 12px rgba(0,0,0,0.3);
            background: white;
          `;

          const canvas = document.createElement('canvas');
          canvas.width = scaledVp.width;
          canvas.height = scaledVp.height;
          canvas.style.cssText = 'display: block; width: 100%; height: auto;';
          wrapper.appendChild(canvas);
          container.appendChild(wrapper);
          canvasNodes.push(canvas);

          const ctx = canvas.getContext('2d');
          await page.render({ canvasContext: ctx!, viewport: scaledVp }).promise;
          page.cleanup();

          completed++;
          setProgress(`已渲染 ${completed} / ${total} 页`);
        }

        // 逐个渲染，避免同时过多请求
        for (const pn of pageNums) {
          await renderOne(pn);
        }

        if (!cancelled) setLoading(false);
      } catch (e: any) {
        if (!cancelled) {
          setError(e.message || '加载 PDF 失败');
          setLoading(false);
        }
      }
    }

    init();
    return () => {
      cancelled = true;
      canvasNodes.forEach(c => {
        const ctx = c.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, c.width, c.height);
      });
    };
  }, [pdfUrl]);

  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 12 }}>
        <div style={{ color: '#ff4d4f', fontSize: 16 }}>❌ 加载失败</div>
        <div style={{ color: '#666' }}>{error}</div>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#525659' }}>
      {/* 加载进度条 */}
      {loading && (
        <div style={{
          padding: '12px 16px',
          background: '#1a1a2e',
          color: '#ccc',
          fontSize: 13,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexShrink: 0,
        }}>
          <Spin size="small" />
          <span>{progress || '正在加载 PDF...'}</span>
        </div>
      )}

      {/* 可滚动预览区 */}
      <div
        ref={canvasContainerRef}
        style={{
          flex: 1,
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '4px 0',
        }}
      />
    </div>
  );
}
