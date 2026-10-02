const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();
app.use(cors());

const TAVILY_API_KEY = process.env.TAVILY_API_KEY || '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';

app.get('/api/search', async (req, res) => {
    const q = (req.query.q || '').trim();
    const type = req.query.type || 'web';   // web / news / images

    if (!q) {
        return res.status(400).json({ error: '缺少查询参数 q' });
    }

    try {
        const tavilyRes = await fetch('https://api.tavily.com/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                api_key: TAVILY_API_KEY,
                query: q,
                search_depth: 'basic',
                include_answer: false,
                include_images: type === 'images',
                include_raw_content: false,
                max_results: 15,
                topic: type === 'news' ? 'news' : 'general'
            })
        });

        if (!tavilyRes.ok) {
            const errText = await tavilyRes.text();
            console.error('Tavily 返回错误：', tavilyRes.status, errText);
            return res.status(tavilyRes.status).json({
                error: 'Tavily API 请求失败',
                status: tavilyRes.status,
                detail: errText.substring(0, 300)
            });
        }

        const data = await tavilyRes.json();

        // 整理成前端好渲染的结构
        const results = (data.results || []).map(item => ({
            title: item.title || '',
            url: item.url || '',
            content: item.content || '',
            score: item.score || 0
        }));

        res.json({
            query: q,
            type: type,
            results: results,
            images: data.images || [],
            response_time: data.response_time || 0
        });

    } catch (e) {
        console.error('服务器错误：', e);
        res.status(500).json({ error: e.message });
    }
});

// 健康检查
app.get('/', (req, res) => {
    res.send('Tavily 搜索后端已运行');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`服务器已启动，监听端口 ${PORT}`);
});
// ========== 翻译接口 ==========
app.get('/api/translate', async (req, res) => {
    const text = req.query.text || '';
    const to = req.query.to || 'zh-CN';
    const from = req.query.from || 'auto';

    if (!text) {
        return res.status(400).json({ error: '缺少 text 参数' });
    }

    try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${from}&tl=${to}&dt=t&q=${encodeURIComponent(text)}`;
        const r = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        if (!r.ok) {
            return res.status(r.status).json({ error: '翻译服务返回 ' + r.status });
        }

        const data = await r.json();
        // Google 返回格式：[[["译文","原文",...],...],...]
        const translated = (data[0] || []).map(item => item[0]).filter(Boolean).join('');
        const detectedLang = data[2] || from;

        res.json({
            text: text,
            translated: translated,
            from: detectedLang,
            to: to
        });
    } catch (e) {
        console.error('翻译失败：', e);
        res.status(500).json({ error: e.message });
    }
});
